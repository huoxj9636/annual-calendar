/**
 * 用户数据同步共享工具
 * 监听/收集/推送 localStorage 中需要同步到数据库的 key
 * 供 SyncProvider（自动同步）和 signOut（登出前保底上传）复用
 */

// 需要同步到数据库的 localStorage key 列表
// 涵盖日历核心数据：满意度勾选、日程/待办、备忘录、知识树、人生旅途进度等
// 不同步的：纯 UI 偏好（皮肤/面板位置/时钟模式/甘特图列宽等）
const SYNCED_KEYS = [
  // 满意度勾选（按年）
  'calendar-overrides',
  // 日程/待办（按年月日）
  'dayview-events',
  'dayview-todos',
  // 备忘录（按年）
  'calendar-notes',
  // 知识森林
  'knowledge-trees',
  'knowledge-bookmarks',
  // 日历书签
  'calendar-bookmarks',
  // 人生旅途 OKR
  'life-calendar-okr',
  // 人生旅途进度（嵌套对象）
  'life-calendar-progress',
  // 甘特图行（按年月日）
  'gantt-rows',
  // 日历涂鸦（按年）
  'calendar-drawing',
  // 生日/座右铭（用户私有偏好，跨设备同步）
  'calendar-birth-year',
  'calendar-motto',
  // 复盘起始日期
  'calendar-review-start-date',
];

// 带年份/日期后缀的 key 前缀
const SYNCED_PREFIX_KEYS = [
  'achievements-', // 按年月日
  'daily-review-', // 按年月日
  'shown-', // 按日
  'note-', // 备用备忘录前缀
];

// 当前设备已同步过的 userId 标记
// 用于"首登检测"：标记不存在 = 设备未绑定账号 → 触发 localStorage → DB 上传
const SYNCED_USER_KEY = 'synced-user-id';

export function isSyncedKey(key: string): boolean {
  if (SYNCED_KEYS.includes(key)) return true;
  return SYNCED_PREFIX_KEYS.some((p) => key.startsWith(p));
}

// 收集所有需要同步的 localStorage 项
export function collectSyncedItems(): Array<{ key: string; value: unknown }> {
  if (typeof window === 'undefined') return [];
  const items: Array<{ key: string; value: unknown }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (!isSyncedKey(key)) continue;
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      items.push({ key, value: JSON.parse(raw) });
    } catch {
      // 非 JSON 字符串直接以字符串形式存
      items.push({ key, value: raw });
    }
  }
  return items;
}

// 把数据批量推送到云端
export async function pushUserData(
  token: string,
  items: Array<{ key: string; value: unknown }>,
): Promise<boolean> {
  if (items.length === 0) return true;
  try {
    const res = await fetch('/api/user-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session': token,
      },
      body: JSON.stringify({ items }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// 从云端拉取数据
export async function pullUserData(
  token: string,
): Promise<Array<{ key: string; value: unknown }> | null> {
  try {
    const res = await fetch('/api/user-data', {
      headers: { 'x-session': token },
    });
    if (!res.ok) return null;
    const data: { items?: Array<{ key: string; value: unknown }> } = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return null;
  }
}

// 读取"已同步用户"标记
export function getSyncedUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(SYNCED_USER_KEY);
  } catch {
    return null;
  }
}

// 写"已同步用户"标记
export function setSyncedUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNCED_USER_KEY, userId);
  } catch {
    // ignore quota
  }
}

// 清"已同步用户"标记（登出时调用，下次登录会触发首登上传）
export function clearSyncedUserId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SYNCED_USER_KEY);
  } catch {
    // ignore
  }
}

// 通知页面：数据已从云端同步完成
export function dispatchDataSyncedEvent(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('user-data-synced'));
}

// 把云端数据合并到 localStorage（不覆盖本地已有值，保留最新本地编辑）
export function mergeCloudToLocal(
  cloudItems: Array<{ key: string; value: unknown }>,
): number {
  if (typeof window === 'undefined') return 0;
  let merged = 0;
  for (const item of cloudItems) {
    if (!item || typeof item.key !== 'string') continue;
    if (localStorage.getItem(item.key) !== null) continue; // 本地有，不覆盖
    try {
      localStorage.setItem(item.key, JSON.stringify(item.value));
      merged++;
    } catch {
      // ignore quota
    }
  }
  return merged;
}
