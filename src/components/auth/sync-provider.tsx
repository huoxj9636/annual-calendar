'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { useUser } from '@/components/auth/user-context';

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
  // 每日复盘（按日）—key 中含年份/月份/日期
  // achievements-、daily-review-、shown-、shown- 等在 year-calendar.tsx 中可见
];

// 带年份/日期后缀的 key 前缀
const SYNCED_PREFIX_KEYS = [
  'achievements-', // 按年月日
  'daily-review-', // 按年月日
  'shown-', // 按日
  'note-', // 备用备忘录前缀
];

// localStorage.setItem 包装函数：原组件代码不变，原始 API 仍写 localStorage
// 此 Provider 仅在 setItem 被调用时通知"数据有变化"，再异步批量同步到 DB
interface SyncProviderProps {
  children: ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const { user, getToken } = useUser();
  const userId = user?.id ?? null;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialPulledRef = useRef(false);

  // ── 登录后：从 DB 拉取数据并合并到 localStorage ──
  useEffect(() => {
    if (!userId || initialPulledRef.current) return;
    initialPulledRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch('/api/user-data', {
          headers: { 'x-session': token },
        });
        if (!res.ok) return;
        const data: { items?: Array<{ key: string; value: unknown }> } = await res.json();
        if (cancelled || !Array.isArray(data.items)) return;

        for (const item of data.items) {
          if (!item || typeof item.key !== 'string') continue;
          // 始终用 DB 数据覆盖 localStorage（DB 是数据源）
          try {
            localStorage.setItem(item.key, JSON.stringify(item.value));
          } catch {
            // ignore quota errors
          }
        }

        // 通知其他标签/组件：数据已从云端恢复
        window.dispatchEvent(new CustomEvent('user-data-synced'));
      } catch (err) {
        console.warn('[SyncProvider] pull from DB failed', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, getToken]);

  // ── 监听 localStorage 变化：批量同步到 DB ──
  useEffect(() => {
    if (!userId) return;

    const handleStorageChange = (e: StorageEvent) => {
      // StorageEvent 触发：另一窗口/标签页写入了 localStorage
      if (!e.key) return;
      if (!isSyncedKey(e.key)) return;
      scheduleSync();
    };

    // 同一标签页内，原生 storage 事件不会触发（只有其他标签才会）
    // 用 monkey-patch setItem/removeItem 方式触发同步
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function (key: string, value: string) {
      originalSetItem.call(this, key, value);
      if (isSyncedKey(key)) {
        scheduleSync();
      }
    };
    Storage.prototype.removeItem = function (key: string) {
      originalRemoveItem.call(this, key);
      if (isSyncedKey(key)) {
        scheduleSync();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.removeItem = originalRemoveItem;
    };

    function scheduleSync() {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        void doSync();
      }, 800);
    }

    async function doSync() {
      try {
        const token = await getToken();
        if (!token) return;
        const items = collectSyncedItems();
        if (items.length === 0) return;
        await fetch('/api/user-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session': token,
          },
          body: JSON.stringify({ items }),
        });
      } catch (err) {
        console.warn('[SyncProvider] push to DB failed', err);
      }
    }
  }, [userId, getToken]);

  return <>{children}</>;
}

// 收集所有需要同步的 localStorage 项
function collectSyncedItems(): Array<{ key: string; value: unknown }> {
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

function isSyncedKey(key: string): boolean {
  if (SYNCED_KEYS.includes(key)) return true;
  return SYNCED_PREFIX_KEYS.some((p) => key.startsWith(p));
}
