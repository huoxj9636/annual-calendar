'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { useUser } from '@/components/auth/user-context';
import {
  collectSyncedItems,
  pushUserData,
  pullUserData,
  replaceLocalWithCloud,
  clearAllSyncedLocalData,
  dispatchDataSyncedEvent,
} from '@/lib/user-kv';

interface SyncProviderProps {
  children: ReactNode;
}

/**
 * 数据同步 Provider
 *
 * 核心策略（游客 vs 登录 严格隔离）：
 * 1. 游客模式：所有写操作只走 localStorage，不触发云端同步
 * 2. 登录时：拉取云端数据 → 覆盖 localStorage（不保留游客数据）
 * 3. 已登录状态下写数据：写 localStorage（让组件读取立即生效）+ 800ms 防抖同步到云端
 * 4. 登出时：清空 localStorage 中所有同步 keys（让游客会话无残留）
 * 5. 切换账号：新登录账号的云端数据覆盖 localStorage
 */
export function SyncProvider({ children }: SyncProviderProps) {
  const { user, getToken } = useUser();
  const userId = user?.id ?? null;
  const prevUserIdRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadedRef = useRef(false);

  // ── 监听 user 变化：登录/登出/切账号 ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prevUserId = prevUserIdRef.current;

    // 场景 A：登出（prev 有 userId → current 为 null）
    if (prevUserId && !userId) {
      clearAllSyncedLocalData();
      dispatchDataSyncedEvent();
      prevUserIdRef.current = null;
      initialLoadedRef.current = false;
      return;
    }

    // 场景 B：登录或切账号（current 有 userId）
    if (userId) {
      // 切账号场景：先清空旧账号在 localStorage 的数据
      if (prevUserId && prevUserId !== userId) {
        clearAllSyncedLocalData();
        initialLoadedRef.current = false;
      }
      // 首次登录或切账号：拉取云端数据覆盖 localStorage
      if (!initialLoadedRef.current) {
        initialLoadedRef.current = true;
        let cancelled = false;
        (async () => {
          try {
            const token = await getToken();
            if (!token || cancelled) return;
            const cloudItems = await pullUserData(token);
            if (cancelled) return;
            replaceLocalWithCloud(cloudItems ?? []);
            dispatchDataSyncedEvent();
          } catch (err) {
            console.warn('[SyncProvider] pull from DB failed', err);
          }
        })();
        return () => {
          cancelled = true;
        };
      }
    }

    prevUserIdRef.current = userId;
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
      if (!userId) return; // 游客模式不触发云端同步
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
