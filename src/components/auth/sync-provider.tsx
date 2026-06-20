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

  // ── 拦截器装载(全局只装一次) + 监听 local-storage-changed 事件触发同步 ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    // 异步安装拦截器(确保 supabase config 已就绪)
    (async () => {
      const mod = await import('@/lib/auth-interceptor');
      mod.installAuthInterceptor();
    })();

    const handleLocalChange = (e: Event) => {
      if (cancelled) return;
      const detail = (e as CustomEvent<{ key: string; op: string }>).detail;
      if (!detail?.key) return;
      scheduleSync();
    };

    window.addEventListener('local-storage-changed', handleLocalChange);

    return () => {
      cancelled = true;
      window.removeEventListener('local-storage-changed', handleLocalChange);
    };

    function scheduleSync() {
      if (!userId) return; // 未登录不触发云端同步
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
