'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { isConfigReady, SUPABASE_CONFIG_READY_EVENT } from '@/lib/supabase-config-inject';
import { SyncProvider } from '@/components/auth/sync-provider';
import { UserMenu } from '@/components/auth/user-menu';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  // 初始 config 还在加载时，pending 显示 loading
  const [configReady, setConfigReady] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isConfigReady() : false
  );
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  // 监听 config 就绪
  useEffect(() => {
    if (isConfigReady()) {
      setConfigReady(true);
      return;
    }
    const handler = () => setConfigReady(true);
    window.addEventListener(SUPABASE_CONFIG_READY_EVENT, handler);
    return () => window.removeEventListener(SUPABASE_CONFIG_READY_EVENT, handler);
  }, []);

  // 检查登录态
  useEffect(() => {
    if (!configReady) return;
    let cancelled = false;

    (async () => {
      try {
        const supabase = await getSupabaseBrowserClientWithRetry();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setAuthed(true);
        } else {
          // 未登录：/login 页面直接放行，其他页面跳 /login
          if (pathname !== '/login') {
            router.replace('/login');
          }
          setAuthed(false);
        }
      } catch {
        if (!cancelled) {
          if (pathname !== '/login') router.replace('/login');
          setAuthed(false);
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();

    // 监听登录态变化
    let sub: { unsubscribe: () => void } | null = null;
    (async () => {
      try {
        const supabase = await getSupabaseBrowserClientWithRetry();
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          if (session) {
            setAuthed(true);
            if (pathname === '/login') router.replace('/');
          } else {
            setAuthed(false);
            if (pathname !== '/login') router.replace('/login');
          }
        });
        sub = data.subscription;
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [configReady, pathname, router]);

  // config 还在加载
  if (!configReady) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">正在加载…</div>
      </div>
    );
  }

  // 在 /login 页面：直接渲染（不渲染 SyncProvider，避免循环跳转）
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // 其他页面：等登录态确认
  if (!authChecked) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">正在校验登录态…</div>
      </div>
    );
  }

  // 未登录：AuthGuard 已发起跳转，渲染空白
  if (!authed) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">正在跳转到登录页…</div>
      </div>
    );
  }

  // 已登录：包裹 SyncProvider 同步数据
  return (
    <SyncProvider>
      {children}
      <UserMenu />
    </SyncProvider>
  );
}
