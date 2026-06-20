'use client';

import { useEffect, useRef, ReactNode, createContext, useContext, useState, useCallback } from 'react';
import { useUser } from '@/components/auth/user-context';
import {
  collectSyncedItems,
  pushUserData,
  pullUserData,
  mergeCloudToLocal,
  clearAllSyncedLocalData,
  dispatchDataSyncedEvent,
} from '@/lib/user-kv';
import { countLocalMigratableData, migrateLocalToCloud } from '@/lib/migration';

// ── Migration Context：把"待迁移数据"状态 + 一键迁移函数暴露给 toast ──
interface MigrationContextValue {
  pendingCount: number;
  running: boolean;
  runMigration: () => Promise<void>;
  dismiss: () => void;
}

const MigrationContext = createContext<MigrationContextValue | null>(null);

export function useMigration(): MigrationContextValue {
  const ctx = useContext(MigrationContext);
  if (!ctx) {
    // 未在 Provider 内时返回 no-op，避免其他组件误用崩溃
    return { pendingCount: 0, running: false, runMigration: async () => {}, dismiss: () => {} };
  }
  return ctx;
}

interface SyncProviderProps {
  children: ReactNode;
}

/**
 * 数据同步 Provider
 *
 * 核心策略：
 * 1. 游客模式：所有写操作只走 localStorage，不触发云端同步
 * 2. 登录时：拉取云端 → 合并到 localStorage（云端优先，local 补缺）
 *           然后把 localStorage 现有数据推送到云端（保留游客期间新增）
 * 3. 已登录状态下写：写 localStorage + 800ms 防抖同步到云端
 * 4. 登出时：清空 localStorage 中所有同步 keys（让游客会话无残留）
 * 5. 切换账号：先清空旧账号 localStorage → 拉取新账号云端合并 → 推送
 * 6. 登录后检测已迁库 key 残留：弹 toast 提示一键迁移
 */
export function SyncProvider({ children }: SyncProviderProps) {
  const { user, getToken } = useUser();
  const userId = user?.id ?? null;
  const prevUserIdRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadedRef = useRef(false);

  // ── 迁移状态 ──
  const [pendingCount, setPendingCount] = useState(0);
  const [running, setRunning] = useState(false);
  const dismissedRef = useRef(false);

  // 重新检测 localStorage 已迁库 key 的待迁移条数
  const refreshPendingCount = useCallback(() => {
    try {
      setPendingCount(countLocalMigratableData());
    } catch {
      setPendingCount(0);
    }
  }, []);

  // 执行一键迁移
  const runMigration = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      const token = await getToken();
      if (!token) {
        setRunning(false);
        return;
      }
      const result = await migrateLocalToCloud();
      console.log('[Migration] done', result);
      // 迁移完成后清空 localStorage 中已迁库 key 的残留
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          // 用 auth-interceptor 中的清空范围（已迁库 key）
          if (/^calendar-overrides-\d{4}$/.test(k)) keysToRemove.push(k);
          else if (/^calendar-notes-\d{4}$/.test(k)) keysToRemove.push(k);
          else if (/^calendar-drawing-\d{4}$/.test(k)) keysToRemove.push(k);
          else if (/^dayview-events-\d{4}-\d{1,2}-\d{1,2}$/.test(k)) keysToRemove.push(k);
          else if (/^dayview-todos-\d{4}-\d{1,2}-\d{1,2}$/.test(k)) keysToRemove.push(k);
          else if (/^daily-review-\d{4}-\d{1,2}-\d{1,2}$/.test(k)) keysToRemove.push(k);
          else if (/^month-reviews-\d{4}-\d{1,2}$/.test(k)) keysToRemove.push(k);
          else if (k === 'life-calendar-okr') keysToRemove.push(k);
        }
        for (const k of keysToRemove) localStorage.removeItem(k);
        // 通知组件刷新
        dispatchDataSyncedEvent();
      } catch (e) {
        console.warn('[Migration] cleanup localStorage failed', e);
      }
      setPendingCount(0);
      dismissedRef.current = true;
    } catch (err) {
      console.warn('[Migration] failed', err);
    } finally {
      setRunning(false);
    }
  }, [running, getToken]);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setPendingCount(0);
  }, []);

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
      setPendingCount(0);
      dismissedRef.current = false;
      return;
    }

    // 场景 B：登录或切账号（current 有 userId）
    if (userId) {
      // 切账号场景：先清空旧账号在 localStorage 的数据
      if (prevUserId && prevUserId !== userId) {
        clearAllSyncedLocalData();
        initialLoadedRef.current = false;
        dismissedRef.current = false;
      }
      // 首次登录或切账号：拉取云端数据 → 合并到 localStorage → 推送 localStorage 到云端
      if (!initialLoadedRef.current) {
        initialLoadedRef.current = true;
        let cancelled = false;
        (async () => {
          try {
            const token = await getToken();
            if (!token || cancelled) return;

            // 1. 拉取云端
            const cloudItems = await pullUserData(token);
            if (cancelled) return;

            // 2. 合并到 localStorage（云端有值用云端；云端无值保留 local）
            mergeCloudToLocal(cloudItems ?? []);

            // 3. 把当前 localStorage 全部推送到云端
            //    这步是关键：保留游客期间在 localStorage 新增的数据
            const localItems = collectSyncedItems();
            if (localItems.length > 0) {
              await pushUserData(token, localItems);
            }
            if (cancelled) return;
            dispatchDataSyncedEvent();

            // 4. 检测已迁库 key 残留 → 弹迁移提示
            //    推迟到下个 tick，等组件渲染完成
            setTimeout(() => {
              if (cancelled || dismissedRef.current) return;
              refreshPendingCount();
            }, 500);
          } catch (err) {
            console.warn('[SyncProvider] sync on login failed', err);
          }
        })();
        return () => {
          cancelled = true;
        };
      }
    }

    prevUserIdRef.current = userId;
  }, [userId, getToken, refreshPendingCount]);

  // ── 拦截器装载(全局只装一次) + 监听 local-storage-changed 事件触发同步 ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    // 异步安装拦截器(确保 supabase config 已就绪)
    (async () => {
      const mod = await import('@/lib/auth-interceptor');
      mod.installAuthInterceptor();
    })();

    const handleLocalChange = () => {
      if (cancelled) return;
      scheduleSync();
      // 拦截器触发后，localStorage 已迁库 key 可能被清空，重新计算待迁移数
      refreshPendingCount();
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
  }, [userId, getToken, refreshPendingCount]);

  return (
    <MigrationContext.Provider value={{ pendingCount, running, runMigration, dismiss }}>
      {children}
    </MigrationContext.Provider>
  );
}
