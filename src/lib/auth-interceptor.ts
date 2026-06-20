/**
 * setItem 拦截器 - 渐进式登录核心
 *
 * 工作机制:
 * 1. 重写 Storage.prototype.setItem
 * 2. 维护"需要同步"的 localStorage key 前缀白名单
 * 3. 未登录时写入这些 key → 拦截 + 入队 pendingWrites + 触发登录弹窗
 * 4. 用户在弹窗内登录成功 → flushPendingWrites() 补写所有被拦截的操作
 * 5. 已登录时正常透传
 *
 * UI 偏好类 key(皮肤/面板状态/列宽等)不拦截,允许匿名用户保存偏好
 */

// 需要登录才能保存的 key 前缀/精确名
const SYNCED_KEY_PATTERNS: Array<string | RegExp> = [
  // 满意度勾选
  /^calendar-overrides-\d{4}$/,
  // 日程/待办
  /^dayview-events-\d{4}-\d{1,2}-\d{1,2}$/,
  /^dayview-todos-\d{4}-\d{1,2}-\d{1,2}$/,
  // 备忘录
  /^calendar-notes-\d{4}$/,
  // 涂鸦
  /^calendar-drawing-\d{4}$/,
  // 甘特图（年-月-日，3 段）
  /^gantt-rows-\d{4}-\d{1,2}-\d{1,2}$/,
  // 精确匹配的 key
  'calendar-bookmarks',
  'knowledge-trees',
  'knowledge-bookmarks',
  'life-calendar-okr', // OKR 目标/关键结果/任务
  'life-calendar-progress', // 人生旅途 9 阶段进度
  // 成果面板（achievements-${key}）
  /^achievements-[\w-]+$/,
  // life-calendar-* 其他（除 skin/panel 时钟模式外）
  /^life-calendar-(?!skin$|panel)./,
];

// 不拦截的 key(UI 偏好)
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

let _isLoggedIn = false;
let _onRequireLogin: (() => void) | null = null;
let _installed = false;
let _originalSetItem: ((key: string, value: string) => void) | null = null;

// 被拦截的写入队列 - 登录成功后补写
const pendingWrites: Array<{ key: string; value: string }> = [];
// 被拦截的跳转队列 - 登录成功后打开新标签页
const pendingNavigations: Array<{ url: string; target: string }> = [];

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

export function isAuthInterceptorInstalled(): boolean {
  return _installed;
}

export function setInterceptorAuthStatus(loggedIn: boolean): void {
  _isLoggedIn = loggedIn;
}

export function registerRequireLoginHandler(handler: (() => void) | null): void {
  _onRequireLogin = handler;
}

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
        return originalOpen.call(this, url as any, target, features);
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
    return originalOpen.call(this, url as any, target, features);
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
      _originalSetItem.call(localStorage, w.key, w.value);
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
