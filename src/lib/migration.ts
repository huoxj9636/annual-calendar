/**
 * 本地 localStorage 数据一键迁移到云端
 *
 * 适用场景:已有账号系统,但用户首次登录时 localStorage 已有大量数据
 * (老的"无账号版"积累下来的勾选/日程/笔记等)
 *
 * 设计原则:
 * - 拉数据库优先:对每个 key 先 GET 拉数据库,如果有数据 → 跳过(云端优先,避免覆盖)
 * - 数据库为空 → 用 localStorage 数据 POST 到对应 API
 * - 迁移成功后清 localStorage 对应 key
 *
 * 已支持迁移的 key(已迁库 → 数据库专用表):
 * - calendar-overrides-{year}     → /api/calendar-data  (overrides)
 * - calendar-notes-{year}         → /api/calendar-data  (notes)
 * - calendar-drawing-{year}       → /api/calendar-data  (drawing)
 * - dayview-events-{y}-{m}-{d}    → /api/day-data       (events)
 * - dayview-todos-{y}-{m}-{d}     → /api/day-data       (todos)
 * - daily-review-{y}-{m}-{d}      → /api/daily-review
 * - life-calendar-okr             → /api/okr
 *
 * 不在迁移范围(走 user_kv_store,由 SyncProvider 处理):
 * - knowledge-trees / knowledge-bookmarks / calendar-bookmarks
 * - life-calendar-progress
 * - achievements-*
 */

import { getSessionToken } from './supabase-browser';

interface MigrationResult {
  total: number; // 总共检查的 key 数
  success: number; // 成功迁移
  skipped: number; // 跳过(云端已有)
  failed: number; // 失败
  details: Array<{ key: string; status: 'success' | 'skipped' | 'failed'; reason?: string }>;
}

// 迁移模式 + 解析函数
type MigrationHandler = (key: string, value: string) => {
  endpoint: string;
  body: Record<string, unknown>;
} | null;

const MIGRATION_HANDLERS: Array<{ pattern: RegExp; handle: MigrationHandler }> = [
  // calendar-overrides-{year}
  {
    pattern: /^calendar-overrides-(\d{4})$/,
    handle: (key, value) => {
      const m = key.match(/^calendar-overrides-(\d{4})$/);
      if (!m) return null;
      return {
        endpoint: '/api/calendar-data',
        body: { type: 'overrides', year: Number(m[1]), data: JSON.parse(value) },
      };
    },
  },
  // calendar-notes-{year}
  {
    pattern: /^calendar-notes-(\d{4})$/,
    handle: (key, value) => {
      const m = key.match(/^calendar-notes-(\d{4})$/);
      if (!m) return null;
      return {
        endpoint: '/api/calendar-data',
        body: { type: 'notes', year: Number(m[1]), data: JSON.parse(value) },
      };
    },
  },
  // calendar-drawing-{year}
  {
    pattern: /^calendar-drawing-(\d{4})$/,
    handle: (key, value) => {
      const m = key.match(/^calendar-drawing-(\d{4})$/);
      if (!m) return null;
      return {
        endpoint: '/api/calendar-data',
        body: { type: 'drawing', year: Number(m[1]), data: { strokes: JSON.parse(value) } },
      };
    },
  },
  // dayview-events-{year}-{month}-{day}
  {
    pattern: /^dayview-events-(\d{4})-(\d{1,2})-(\d{1,2})$/,
    handle: (key, value) => {
      const m = key.match(/^dayview-events-(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!m) return null;
      const events = JSON.parse(value);
      // 转换格式:add-day-events 需要 start_hour/start_min/end_hour/end_min
      // day-data 接口更灵活(events 数组直接传),用 day-data
      return {
        endpoint: '/api/day-data',
        body: {
          year: Number(m[1]),
          month: Number(m[2]),
          day: Number(m[3]),
          events: Array.isArray(events) ? events : [],
        },
      };
    },
  },
  // dayview-todos-{year}-{month}-{day}
  {
    pattern: /^dayview-todos-(\d{4})-(\d{1,2})-(\d{1,2})$/,
    handle: (key, value) => {
      const m = key.match(/^dayview-todos-(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!m) return null;
      const todos = JSON.parse(value);
      return {
        endpoint: '/api/day-data',
        body: {
          year: Number(m[1]),
          month: Number(m[2]),
          day: Number(m[3]),
          todos: Array.isArray(todos) ? todos : [],
        },
      };
    },
  },
  // daily-review-{year}-{month}-{day}
  {
    pattern: /^daily-review-(\d{4})-(\d{1,2})-(\d{1,2})$/,
    handle: (key, value) => {
      const m = key.match(/^daily-review-(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!m) return null;
      const data = JSON.parse(value);
      return {
        endpoint: '/api/daily-review',
        body: {
          year: Number(m[1]),
          month: Number(m[2]),
          day: Number(m[3]),
          ...data, // {completed, goodThings, problems, mood, reflections, tomorrowTodo, moodScore, energy}
        },
      };
    },
  },
  // life-calendar-okr
  {
    pattern: /^life-calendar-okr$/,
    handle: (_key, value) => {
      const data = JSON.parse(value);
      return {
        endpoint: '/api/okr',
        body: { objectives: data?.objectives || [] },
      };
    },
  },
];

/**
 * 统计 localStorage 中待迁移的 key 数量
 * (排除:空值、UI 偏好、纯 localStorage 数据)
 */
export function countLocalMigratableData(): number {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    // 只统计 MIGRATION_HANDLERS 覆盖的 key
    if (!MIGRATION_HANDLERS.some((h) => h.pattern.test(key))) continue;
    const val = localStorage.getItem(key);
    // 跳过空值
    if (!val || val === '[]' || val === '{}' || val === '""' || val === 'null') continue;
    count++;
  }
  return count;
}

/**
 * 检查云端是否已有该 key 的数据(避免覆盖)
 * 返回 true 表示云端有数据(应跳过),false 表示云端空(可以迁移)
 */
async function checkCloudHasData(endpoint: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    let url = endpoint;
    const params = new URLSearchParams();
    if (body.type) params.set('type', String(body.type));
    if (body.year) params.set('year', String(body.year));
    if (body.month) params.set('month', String(body.month));
    if (body.day) params.set('day', String(body.day));
    if (params.toString()) url += `?${params.toString()}`;

    const token = await getSessionToken();
    const res = await fetch(url, {
      method: 'GET',
      headers: token ? { 'x-session': token } : {},
    });
    if (!res.ok) return false;
    const data = await res.json();
    // 检查返回数据是否非空
    if (Array.isArray(data)) return data.length > 0;
    if (data?.data) {
      if (Array.isArray(data.data)) return data.data.length > 0;
      if (typeof data.data === 'object') return Object.keys(data.data).length > 0;
    }
    if (data?.okr) return true;
    if (data?.success && data?.data) return true;
    // okr POST 之前没有 GET 接口 → 默认返回 false(允许迁移)
    if (endpoint === '/api/okr') return false;
    return false;
  } catch {
    return false; // 失败时允许迁移
  }
}

/**
 * 执行一键迁移
 * - 遍历 localStorage 中已迁库的 key
 * - 对每个 key:先 GET 云端,如有数据跳过;否则 POST localStorage 数据
 * - 成功后清 localStorage 对应 key
 */
export async function migrateLocalToCloud(): Promise<MigrationResult> {
  const result: MigrationResult = { total: 0, success: 0, skipped: 0, failed: 0, details: [] };
  const token = await getSessionToken();
  if (!token) {
    return { ...result, details: [{ key: '(auth)', status: 'failed', reason: '未登录' }] };
  }

  // 收集所有待迁移 key
  const keysToMigrate: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && MIGRATION_HANDLERS.some((h) => h.pattern.test(key))) {
      const val = localStorage.getItem(key);
      if (val && val !== '[]' && val !== '{}' && val !== '""' && val !== 'null') {
        keysToMigrate.push(key);
      }
    }
  }
  result.total = keysToMigrate.length;

  for (const key of keysToMigrate) {
    const val = localStorage.getItem(key);
    if (!val) continue;
    const handler = MIGRATION_HANDLERS.find((h) => h.pattern.test(key));
    if (!handler) continue;
    try {
      const parsed = handler.handle(key, val);
      if (!parsed) {
        result.failed++;
        result.details.push({ key, status: 'failed', reason: '解析失败' });
        continue;
      }
      // 先 GET 检查云端
      const cloudHas = await checkCloudHasData(parsed.endpoint, parsed.body);
      if (cloudHas) {
        result.skipped++;
        result.details.push({ key, status: 'skipped', reason: '云端已有数据' });
        // 清掉 localStorage(避免下次再检测)
        localStorage.removeItem(key);
        continue;
      }
      // POST 到云端
      const res = await fetch(parsed.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session': token },
        body: JSON.stringify(parsed.body),
      });
      if (res.ok) {
        localStorage.removeItem(key);
        result.success++;
        result.details.push({ key, status: 'success' });
      } else {
        const errText = await res.text().catch(() => '');
        result.failed++;
        result.details.push({ key, status: 'failed', reason: `HTTP ${res.status}: ${errText.slice(0, 100)}` });
      }
    } catch (e) {
      result.failed++;
      result.details.push({ key, status: 'failed', reason: String(e).slice(0, 100) });
    }
  }

  return result;
}
