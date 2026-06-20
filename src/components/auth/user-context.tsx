'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import {
  collectSyncedItems,
  pushUserData,
  clearSyncedUserId,
} from '@/lib/user-kv';

export interface UserInfo {
  id: string;
  phone: string; // 从 user_metadata.phone 或 email 推断
}

interface UserContextValue {
  user: UserInfo | null;
  isLoading: boolean;
  authChecked: boolean;
  // 获取最新 access token（每次调用都从 supabase client 取最新值，不做缓存）
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  authChecked: false,
  getToken: async () => null,
  signOut: async () => undefined,
});

export function useUser() {
  return useContext(UserContext);
}

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 把 supabase auth user 转成我们的 UserInfo
  const toUserInfo = useCallback((authUser: { id: string; phone?: string | null; email?: string | null; user_metadata?: Record<string, unknown> } | null): UserInfo | null => {
    if (!authUser) return null;
    const metaPhone = (authUser.user_metadata?.phone as string | undefined) ?? '';
    let phone = metaPhone;
    if (!phone && authUser.email) {
      // email 形如 13800000000@calendar.local，反解出手机号
      const m = authUser.email.match(/^(\d{6,})@/);
      if (m) phone = m[1];
    }
    if (!phone && authUser.phone) phone = authUser.phone;
    return { id: authUser.id, phone: phone ?? '' };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let sub: { unsubscribe: () => void } | null = null;

    (async () => {
      try {
        const supabase = await getSupabaseBrowserClientWithRetry();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const sessionUser = data.session?.user ?? null;
        setUser(toUserInfo(sessionUser));
        // 联动拦截器:登录态变化 → 打开/关闭拦截
        const { setInterceptorAuthStatus } = await import('@/lib/auth-interceptor');
        setInterceptorAuthStatus(!!sessionUser);

        const { data: subData } = supabase.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          const u = session?.user ?? null;
          setUser(toUserInfo(u));
          setInterceptorAuthStatus(!!u);
        });
        sub = subData.subscription;
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [toUserInfo]);

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    // 1. 登出前同步上传 localStorage 到云端（关键：保留所有数据）
    try {
      const token = await getToken();
      if (token) {
        const items = collectSyncedItems();
        if (items.length > 0) {
          await pushUserData(token, items);
        }
      }
    } catch {
      // ignore
    }

    // 2. 清"已同步账号"标记 → 下次登录（即使是同一账号）会触发首登逻辑
    //    避免登出前漏传的少量数据被云端覆盖
    clearSyncedUserId();

    // 3. 登出 supabase
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }

    // 注：不主动清空 localStorage！保留用户所有数据，下次同账号登录会重新合并
    //     这样即使用户误操作登出，所有数据都不会丢失
    setUser(null);
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, authChecked: !isLoading, getToken, signOut }}>
      {children}
    </UserContext.Provider>
  );
}
