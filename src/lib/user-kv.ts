/**
 * 用户数据同步共享工具
 * 监听/收集/推送 localStorage 中需要同步到数据库的 key
 * 供 SyncProvider（自动同步）和 signOut（登出前保底上传）复用
 *
 * 设计原则（基于"访客=本地 / 登录=云端"目标）:
 * - 大部分用户数据已迁到 Supabase 数据库专用表（calendar_overrides/day_events/...）
 *   通过 fetch API 直连云端,不走 localStorage,也不走 user_kv_store
 * - 本文件只覆盖"纯 localStorage 数据":知识树/人生旅途进度/成果/书签等
 * - UI 偏好（皮肤/面板/列宽等）不同步,保留在设备本地
 */

// 需要同步到数据库的 localStorage key（纯 localStorage 数据,未迁库）
const SYNCED_KEYS = [
  // 知识森林
  'knowledge-trees',
  'knowledge-bookmarks',
  // 日历书签
  'calendar-bookmarks',
  // 人生旅途进度（嵌套对象）
  'life-calendar-progress',
];

// 带后缀的 key 前缀（纯 localStorage 数据）
const SYNCED_PREFIX_KEYS = [
  'achievements-', // 成果面板（按 key）
];

// 登出/切账号时清空 localStorage 的范围
// (含已迁库 key 残留 + 纯 localStorage 数据)
// 实际判断逻辑在 auth-interceptor 中
import { CLEAR_ON_LOGOUT_KEY_PATTERNS } from './auth-interceptor';

// 当前设备已同步过的 userId 标记
const SYNCED_USER_KEY = 'synced-user-id';

// 判断 key 是否需要同步到云端（拦截已登录用户写入）
export function isSyncedKey(key: string): boolean {
  if (SYNCED_KEYS.includes(key)) return true;
  return SYNCED_PREFIX_KEYS.some((p) => key.startsWith(p));
}

// 判断 key 在登出/切账号时是否需要清空 localStorage
// 范围比 isSyncedKey 更宽：包括已迁库 key 的残留
export function isClearOnLogoutKey(key: string): boolean {
  for (const p of CLEAR_ON_LOGOUT_KEY_PATTERNS) {
    if (typeof p === 'string') {
      if (key === p) return true;
    } else {
      if (p.test(key)) return true;
    }
  }
  return false;
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

// 用云端数据覆盖 localStorage（清掉旧同步数据，写入云端最新值）
// 适用场景：登录后、登出后、切换账号后
// 返回被写入的 key 数量
export function replaceLocalWithCloud(
  cloudItems: Array<{ key: string; value: unknown }>,
): number {
  if (typeof window === 'undefined') return 0;
  // 先清掉所有需要登出时清空的 localStorage 项（更宽范围：含已迁库 key 残留）
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isClearOnLogoutKey(key)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  // 再写入云端数据
  let written = 0;
  for (const item of cloudItems) {
    if (!item || typeof item.key !== 'string') continue;
    try {
      localStorage.setItem(item.key, JSON.stringify(item.value));
      written++;
    } catch {
      // ignore quota
    }
  }
  return written;
}

// 清空 localStorage 中所有同步 keys（登出时调用：让 localStorage 不留登录用户数据）
// 返回被清掉的 key 数量
export function clearAllSyncedLocalData(): number {
  if (typeof window === 'undefined') return 0;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // 范围：含已迁库 key 残留 + 纯 localStorage 数据
    if (key && isClearOnLogoutKey(key)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  return keysToRemove.length;
}
