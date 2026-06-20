'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';

export interface UserInfo {
  id: string;
  phone: string; // 从 user_metadata.phone 或 email 推断
}

interface UserContextValue {
  user: UserInfo | null;
  isLoading: boolean;
  // 获取最新 access token（每次调用都从 supabase client 取最新值，不做缓存）
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
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
        setUser(toUserInfo(data.session?.user ?? null));

        const { data: subData } = supabase.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          setUser(toUserInfo(session?.user ?? null));
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
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    // 清空 localStorage 中"用户私有"key（DB 是数据源，本地可清空，下次登录会从 DB 拉）
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key) continue;
        // 同步的 key 全清；UI 偏好（皮肤/面板位置/时钟模式）保留
        if (
          key.startsWith('calendar-overrides') ||
          key.startsWith('dayview-') ||
          key.startsWith('calendar-notes') ||
          key.startsWith('knowledge-') ||
          key.startsWith('calendar-bookmarks') ||
          key.startsWith('life-calendar-okr') ||
          key.startsWith('life-calendar-progress') ||
          key.startsWith('gantt-rows') ||
          key.startsWith('calendar-drawing') ||
          key === 'calendar-birth-year' ||
          key === 'calendar-motto' ||
          key === 'calendar-review-start-date' ||
          key.startsWith('achievements-') ||
          key.startsWith('daily-review-') ||
          key.startsWith('shown-') ||
          key.startsWith('note-')
        ) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, getToken, signOut }}>
      {children}
    </UserContext.Provider>
  );
}
