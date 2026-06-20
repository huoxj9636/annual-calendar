/**
 * setItem 拦截器 - 渐进式登录核心
 *
 * 工作机制:
 * 1. 重写 Storage.prototype.setItem
 * 2. 维护"需要登录才能写"的 localStorage key 白名单
 * 3. 未登录时写入这些 key → 拦截 + 入队 pendingWrites + 触发登录弹窗
 * 4. 用户在弹窗内登录成功 → flushPendingWrites() 补写所有被拦截的操作
 * 5. 已登录时正常透传
 *
 * 设计原则（基于"访客=本地 / 登录=云端"目标）:
 * - 大部分用户数据已迁到 Supabase 数据库专用表（day_events/calendar_overrides/...）
 *   → 通过 fetch API 直连云端,不走 localStorage,也不走 user_kv_store
 * - 本拦截器只覆盖"纯 localStorage 数据"(知识树/人生旅途进度/成果等)
 *   → 这部分数据需要拦截已登录用户写入,以同步到 user_kv_store(多设备)
 * - UI 偏好类 key(皮肤/面板/列宽等)不拦截,允许匿名用户保存偏好
 *
 * 已迁库的 key(不要再写到 user_kv_store,数据库已经有):
 *   calendar-overrides-{year}      → calendar_overrides 表
 *   calendar-notes-{year}          → calendar_notes 表
 *   calendar-drawing-{year}        → calendar_drawings 表
 *   gantt-rows-{y}-{m}-{d}         → 走 /api/calendar-data
 *   dayview-events-{y}-{m}-{d}     → day_events 表
 *   dayview-todos-{y}-{m}-{d}      → day_todos 表
 *   life-calendar-okr              → okr_* 表
 *   daily-review-{date}            → daily_reviews 表
 *   month-reviews-*                → month_reviews 表
 */

// 需要登录才能保存的 key（纯 localStorage 数据,未迁库）
const SYNCED_KEY_PATTERNS: Array<string | RegExp> = [
  // 精确匹配的 key
  'calendar-bookmarks',
  'knowledge-trees',
  'knowledge-bookmarks',
  'life-calendar-progress', // 人生旅途 9 阶段进度
  // 成果面板（achievements-${key}）
  /^achievements-[\w-]+$/,
  // life-calendar-* 其他（除 skin/panel）
  /^life-calendar-(?!skin$|panel)./,
];

// 登出/切账号时清空 localStorage 的范围
// (包含已迁库 key 残留 + 纯 localStorage 数据)
export const CLEAR_ON_LOGOUT_KEY_PATTERNS: Array<string | RegExp> = [
  // 已迁库 key 残留(防止游客期间数据污染已登录账号)
  /^calendar-overrides-\d{4}$/,
  /^calendar-notes-\d{4}$/,
  /^calendar-drawing-\d{4}$/,
  /^gantt-rows-\d{4}-\d{1,2}-\d{1,2}$/,
  /^dayview-events-\d{4}-\d{1,2}-\d{1,2}$/,
  /^dayview-todos-\d{4}-\d{1,2}-\d{1,2}$/,
  /^daily-review-\d{4}-\d{1,2}-\d{1,2}$/,
  /^month-reviews-\d{4}-\d{1,2}$/,
  'life-calendar-okr',
  // 纯 localStorage 数据
  ...SYNCED_KEY_PATTERNS,
];

// 不拦截的 key(UI 偏好)

function isSyncedKey(key: string): boolean {
  if (UI_PREFERENCE_KEYS.has(key)) return false;
  for (const p of SYNCED_KEY_PATTERNS) {
    if (typeof p === 'string') {
      if (key === p) return true;
    } else {
      if (p.test(key)) return true;
    }
  }
  return false;
}
let _isLoggedIn = false;
let _onRequireLogin: (() => void) | null = null;
let _installed = false;
let _originalSetItem: ((key: string, value: string) => void) | null = null;

export function setInterceptorAuthStatus(loggedIn: boolean): void {
  _isLoggedIn = loggedIn;
}

export function registerRequireLoginHandler(handler: (() => void) | null): void {
  _onRequireLogin = handler;
}

const UI_PREFERENCE_KEYS = new Set<string>([
  'panel-left-open', 'panel-left-width', 'panel-left-collapsed',
  'panel-right-open', 'panel-right-width',
  'calendar-skin', 'life-calendar-skin', 'knowledge-skin',
  'clock-mode', 'forest-canvas-pan',
  'gantt-task-column-width',
  'calendar-motto', 'calendar-birth-year', 'calendar-review-start-date',
  'calendar-module-collapsed', 'calendar-module-order',
  'panel-left-width-history',
  'synced-user-id', // 同步标记(自身)
  'supabase.auth.token', // supabase 自己的 token
]);

// 被拦截的写入队列 - 登录成功后补写
const pendingWrites: Array<{ key: string; value: string }> = [];
// 被拦截的跳转队列 - 登录成功后打开新标签页
const pendingNavigations: Array<{ url: string; target: string }> = [];


/** 安装拦截器(全局只能装一次) */
export function installAuthInterceptor(): void {
  if (_installed || typeof window === 'undefined') return;
  if (typeof Storage === 'undefined' || !Storage.prototype) return;

  _originalSetItem = Storage.prototype.setItem;
  _installed = true;

  // 拦截 + 通知
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function (key: string, value: string): void {
    try {
      // 智能去重:任何状态都做去重
      // 避免组件 mount / useEffect 反复写入相同值时,频繁触发 local-storage-changed 事件 → 反复同步云端
      if (isSyncedKey(key)) {
        try {
          const existing = localStorage.getItem(key);
          if (existing === value) {
            return; // 值未变化,直接放行且不触发事件
          }
          // JSON 语义比较(JSON.parse 后 stringify 比较)
          try {
            const existingObj = JSON.parse(existing ?? 'null');
            const newObj = JSON.parse(value);
            if (JSON.stringify(existingObj) === JSON.stringify(newObj)) {
              return; // 语义相同,直接放行且不触发事件
            }
          } catch {
            // JSON 解析失败,按"值不同"处理
          }
        } catch {
          // localStorage 读取失败,按"值不同"处理
        }
      }

      if (isSyncedKey(key) && !_isLoggedIn) {
        // 未登录 + 同步 key → 拦截
        pendingWrites.push({ key, value });
        if (_onRequireLogin) _onRequireLogin();
        return;
      }
      // 透传
      if (_originalSetItem) _originalSetItem.call(this, key, value);
      // 通知 SyncProvider 触发同步
      if (isSyncedKey(key)) {
        window.dispatchEvent(
          new CustomEvent('local-storage-changed', { detail: { key, op: 'set' } }),
        );
      }
    } catch (err) {
      console.warn('[auth-interceptor] setItem error', err);
    }
  };

  Storage.prototype.removeItem = function (key: string): void {
    try {
      originalRemoveItem.call(this, key);
      if (isSyncedKey(key)) {
        window.dispatchEvent(
          new CustomEvent('local-storage-changed', { detail: { key, op: 'remove' } }),
        );
      }
    } catch (err) {
      console.warn('[auth-interceptor] removeItem error', err);
    }
  };

  // ── 拦截 window.open ──
  // 拦截所有"打开新标签页"操作:未登录时入队,登录后跳转
  const originalOpen = window.open;
  window.open = function (url?: string | URL, target?: string, features?: string): WindowProxy | null {
    try {
      const urlString = url === undefined ? '' : String(url);
      // 允许的内部跳转/空 URL 直接放行
      if (!urlString || urlString === 'about:blank') {
        return originalOpen.call(this, url, target, features);
      }
      if (!_isLoggedIn) {
        // 未登录 → 拦截,入队
        pendingNavigations.push({ url: urlString, target: target ?? '_blank' });
        if (_onRequireLogin) _onRequireLogin();
        return null;
      }
    } catch (err) {
      console.warn('[auth-interceptor] window.open error', err);
    }
    return originalOpen.call(this, url, target, features);
  };
}

/** 获取当前被拦截的写入数(用于 UI 展示) */
export function getPendingWritesCount(): number {
  return pendingWrites.length;
}

/** 获取当前被拦截的导航数(用于 UI 展示) */
export function getPendingNavigationsCount(): number {
  return pendingNavigations.length;
}

/** 登录成功后调用:补写所有被拦截的操作 */
export function flushPendingWrites(): number {
  if (!_originalSetItem) return 0;
  const writes = pendingWrites.splice(0, pendingWrites.length);
  for (const w of writes) {
    try {
      // 1) 真正写入 localStorage(用原始 setItem,避免去重逻辑和重复拦截)
      _originalSetItem.call(localStorage, w.key, w.value);
      // 2) 主动 dispatch 事件,触发 SyncProvider 同步到云端
      //    (用原始 setItem 写入不会触发 patched 后的 local-storage-changed 事件)
      if (typeof window !== 'undefined' && isSyncedKey(w.key)) {
        window.dispatchEvent(
          new CustomEvent('local-storage-changed', { detail: { key: w.key, op: 'set' } }),
        );
      }
    } catch (err) {
      console.warn('[auth-interceptor] flush write failed', w.key, err);
    }
  }
  return writes.length;
}

/** 登录成功后调用:补跳所有被拦截的新标签页 */
export function flushPendingNavigations(): number {
  if (typeof window === 'undefined') return 0;
  const navs = pendingNavigations.splice(0, pendingNavigations.length);
  for (const n of navs) {
    try {
      window.open(n.url, n.target);
    } catch (err) {
      console.warn('[auth-interceptor] flush nav failed', n.url, err);
    }
  }
  return navs.length;
}

/** 取消登录时调用:清空被拦截的队列 */
export function clearPendingWrites(): void {
  pendingWrites.length = 0;
  pendingNavigations.length = 0;
}
