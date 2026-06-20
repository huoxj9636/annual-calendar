'use client';

import { useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isConfigReady, SUPABASE_CONFIG_READY_EVENT } from '@/lib/supabase-config-inject';
import { SyncProvider } from '@/components/auth/sync-provider';
import { UserMenu } from '@/components/auth/user-menu';
import { LoginPromptDialog } from '@/components/auth/login-prompt-dialog';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * 渐进式登录守卫:
 * - 不再强制拦截未登录用户
 * - 用户可自由浏览所有页面(年历/知识森林/复盘/...)
 * - SyncProvider 内置 setItem 拦截器:未登录时操作需要保存数据的功能
 *   → 自动弹出 LoginPromptDialog(就地登录)
 *   → 登录成功后自动补写被拦截的操作
 * - UserMenu 始终可见,提供"登录/注册"入口
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const [configReady, setConfigReady] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isConfigReady() : false
  );

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

  // config 还在加载:极短 loading(几乎无感)
  if (!configReady) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">正在加载…</div>
      </div>
    );
  }

  // /login 页面:不包裹 SyncProvider(里面有自己的登录表单,避免拦截器干扰)
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // 其他页面:始终包裹 SyncProvider(无论登录与否,拦截器都需要启动)
  // 未登录时 SyncProvider 仍可工作 - 拦截写入 + 弹登录
  return (
    <SyncProvider>
      {children}
      <UserMenu />
      <LoginPromptDialog />
    </SyncProvider>
  );
}
