'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /login 路由已废弃:登录/注册统一通过 LoginPromptDialog 弹窗完成
 * 此页面保留仅为兼容外链/书签,直接重定向到首页并唤起弹窗
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <RedirectAndOpenDialog />
    </Suspense>
  );
}

function RedirectAndOpenDialog() {
  const router = useRouter();

  useEffect(() => {
    // 1. 重定向到首页
    router.replace('/');
    // 2. 唤起登录弹窗(在 layout 挂载后)
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-login-dialog', { detail: { reason: 'manual' } }));
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">正在打开登录…</div>
    </div>
  );
}
