'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { useUser } from '@/components/auth/user-context';
import {
  collectSyncedItems,
  pushUserData,
  pullUserData,
  getSyncedUserId,
  setSyncedUserId,
  mergeCloudToLocal,
  dispatchDataSyncedEvent,
  isSyncedKey,
} from '@/lib/user-kv';

interface SyncProviderProps {
  children: ReactNode;
}

/**
 * 数据同步 Provider
 *
 * 核心策略（保护已有数据，绝不丢）：
 * 1. 首登（设备首次绑定该账号）：先把 localStorage 现有数据**全部上传**到云端
 *    → 用户此前的所有数据（即使没有账号时积累的）都被保留到云端
 * 2. 同账号二次登录：拉取云端数据**合并**到 localStorage（不覆盖本地已有）
 * 3. 切账号（标记存在但 userId 不同）：把 localStorage 上传到**新**账号云端
 *    → 新账号立刻拥有此前的所有数据
 * 4. 登录后任何 setItem 改动：800ms 防抖批量上传
 */
export function SyncProvider({ children }: SyncProviderProps) {
  const { user, getToken } = useUser();
  const userId = user?.id ?? null;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSyncedRef = useRef(false);

  // ── 登录后：首登上传 / 合并拉取 ──
  useEffect(() => {
    if (!userId || initialSyncedRef.current) return;
    initialSyncedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const previousUserId = getSyncedUserId();
        const localItems = collectSyncedItems();

        // 场景 A：设备未绑定过此账号（首登 / 切账号）→ 先上传本地数据
        if (previousUserId !== userId) {
          if (localItems.length > 0) {
            await pushUserData(token, localItems);
          }
          setSyncedUserId(userId);
          dispatchDataSyncedEvent();
          return;
        }

        // 场景 B：同账号二次登录 → 拉取云端，合并到 local（不覆盖）
        const cloudItems = await pullUserData(token);
        if (cancelled || !cloudItems) return;
        mergeCloudToLocal(cloudItems);
        dispatchDataSyncedEvent();
      } catch (err) {
        console.warn('[SyncProvider] initial sync failed', err);
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
      if (!e.key) return;
      if (!isSyncedKey(e.key)) return;
      scheduleSync();
    };

    // 同一标签页内，原生 storage 事件不会触发
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
        await pushUserData(token, items);
      } catch (err) {
        console.warn('[SyncProvider] push to DB failed', err);
      }
    }
  }, [userId, getToken]);

  return <>{children}</>;
}
