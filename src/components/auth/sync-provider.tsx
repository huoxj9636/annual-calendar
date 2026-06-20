'use client';

import { useEffect, useRef, ReactNode, createContext, useContext, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';
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
import { getSessionToken } from '@/lib/supabase-browser';

// ── Migration Context：把"待迁移数据"状态 + 一键迁移函数暴露给 toast ──
interface MigrationContextValue {
  pendingCount: number;
  running: boolean;
  runMigration: () => Promise<void>;
  dismiss: () => void;
  // 旧数据(数据库里 user_id='legacy')接管/清空
  legacyCount: number;
  legacyLoading: boolean;
  legacyRunning: boolean;
  claimLegacy: () => Promise<void>;
  clearLegacy: () => Promise<void>;
  dismissLegacy: () => void;
}

const MigrationContext = createContext<MigrationContextValue | null>(null);

export function useMigration(): MigrationContextValue {
  const ctx = useContext(MigrationContext);
  if (!ctx) {
    // 未在 Provider 内时返回 no-op，避免其他组件误用崩溃
    return {
      pendingCount: 0,
      running: false,
      runMigration: async () => {},
      dismiss: () => {},
      legacyCount: 0,
      legacyLoading: false,
      legacyRunning: false,
      claimLegacy: async () => {},
      clearLegacy: async () => {},
      dismissLegacy: () => {},
    };
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
 * 7. 登录后检测数据库 legacy 数据(老访客):弹 toast 提示"接管"或"清空"
 */
export function SyncProvider({ children }: SyncProviderProps) {
  const { user, getToken } = useUser();
  const userId = user?.id ?? null;
  const prevUserIdRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadedRef = useRef(false);

  // ── 迁移状态(localStorage 残留) ──
  const [pendingCount, setPendingCount] = useState(0);
  const [running, setRunning] = useState(false);
  // dismissed 状态: 持久化到 localStorage,刷新页面后仍生效
  // 按"提示类型"分键 + 按"userId"分键(同一用户反复看到才重复)
  const [dismissed, setDismissed] = useState(false);
  const [legacyDismissed, setLegacyDismissed] = useState(false);

  // ── Legacy 状态(数据库中 user_id='legacy' 的旧访客数据) ──
  const [legacyCount, setLegacyCount] = useState(0);
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyRunning, setLegacyRunning] = useState(false);

  // ── 客户端 mount 时从 localStorage 恢复 dismissed 状态 ──
  useEffect(() => {
    try {
      // 统一使用全局 key，不需要按用户分键 — 用户 dismiss 一次后永久不弹
      const localKey = 'calendar-migrated-local-dismissed';
      const legacyKey = 'calendar-migrated-legacy-dismissed';
      if (localStorage.getItem(localKey) === '1') setDismissed(true);
      if (localStorage.getItem(legacyKey) === '1') setLegacyDismissed(true);
    } catch {
      /* localStorage 不可用 — 静默忽略 */
    }
  }, []);

  // 重新检测 localStorage 已迁库 key 的待迁移条数
  // 注意:dismiss 后不应该再弹 toast,即使有新数据写入
  const refreshPendingCount = useCallback(() => {
    if (dismissed) return;
    try {
      setPendingCount(countLocalMigratableData());
    } catch {
      setPendingCount(0);
    }
  }, []);

  // 检测数据库 legacy 数据条数
  const refreshLegacyCount = useCallback(async () => {
    if (legacyDismissed) return;
    setLegacyLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        setLegacyCount(0);
        return;
      }
      const res = await apiFetch('/api/migrate-legacy', {
        headers: { 'x-session': token },
      });
      if (!res.ok) {
        setLegacyCount(0);
        return;
      }
      const data = res;
      setLegacyCount(data?.total || 0);
    } catch {
      setLegacyCount(0);
    } finally {
      setLegacyLoading(false);
    }
  }, []);

  // 执行一键迁移(localStorage → 云端)
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
      setDismissed(true);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('calendar-migrated-local-dismissed', '1'); } catch {}
      }
    } catch (err) {
      console.warn('[Migration] failed', err);
    } finally {
      setRunning(false);
    }
  }, [running, getToken]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setPendingCount(0);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('calendar-migrated-local-dismissed', '1'); } catch {}
    }
  }, []);

  // 接管 legacy 数据
  const claimLegacy = useCallback(async () => {
    if (legacyRunning) return;
    setLegacyRunning(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        setLegacyRunning(false);
        return;
      }
      const res = await apiFetch('/api/migrate-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session': token },
        body: JSON.stringify({ action: 'claim' }),
      });
      if (res) {
        console.log('[Legacy] claimed');
        setLegacyCount(0);
        setLegacyDismissed(true);
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('calendar-migrated-legacy-dismissed', '1'); } catch {}
        }
        // 接管后重新拉云端数据
        const cloudItems = await pullUserData(token);
        if (cloudItems) mergeCloudToLocal(cloudItems);
        dispatchDataSyncedEvent();
      } else {
        console.warn('[Legacy] claim failed', res.status);
      }
    } catch (e) {
      console.warn('[Legacy] claim failed', e);
    } finally {
      setLegacyRunning(false);
    }
  }, [legacyRunning]);

  // 清空 legacy 数据
  const clearLegacy = useCallback(async () => {
    if (legacyRunning) return;
    setLegacyRunning(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        setLegacyRunning(false);
        return;
      }
      const res = await apiFetch('/api/migrate-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session': token },
        body: JSON.stringify({ action: 'clear' }),
      });
      if (res) {
        console.log('[Legacy] cleared');
        setLegacyCount(0);
        setLegacyDismissed(true); if (typeof window !== 'undefined') localStorage.setItem('calendar-migrated-legacy-dismissed', '1');
      } else {
        console.warn('[Legacy] clear failed', res.status);
      }
    } catch (e) {
      console.warn('[Legacy] clear failed', e);
    } finally {
      setLegacyRunning(false);
    }
  }, [legacyRunning]);

  const dismissLegacy = useCallback(() => {
    setLegacyDismissed(true); if (typeof window !== 'undefined') localStorage.setItem('calendar-migrated-legacy-dismissed', '1');
    setLegacyCount(0);
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
      setLegacyCount(0);
      // 注意：不重置 dismissed 状态 — 用户 dismiss 后永久不弹
      return;
    }

    // 场景 B：登录或切账号（current 有 userId）
    if (userId) {
      // 切账号场景：先清空旧账号在 localStorage 的数据
      if (prevUserId && prevUserId !== userId) {
        clearAllSyncedLocalData();
        initialLoadedRef.current = false;
        // 注意：不重置 dismissed 状态 — 用户 dismiss 后永久不弹
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
              if (cancelled || dismissed) return;
              refreshPendingCount();
            }, 500);

            // 5. 检测数据库 legacy 数据(老访客) → 弹接管/清空提示
            if (!cancelled && !legacyDismissed) {
              void refreshLegacyCount();
            }
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
  }, [userId, getToken, refreshPendingCount, refreshLegacyCount]);

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
    <MigrationContext.Provider
      value={{
        pendingCount,
        running,
        runMigration,
        dismiss,
        legacyCount,
        legacyLoading,
        legacyRunning,
        claimLegacy,
        clearLegacy,
        dismissLegacy,
      }}
    >
      {children}
    </MigrationContext.Provider>
  );
}
