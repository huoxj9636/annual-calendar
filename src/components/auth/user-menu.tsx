'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/components/auth/user-context';

// 浮动用户菜单：右下角显示当前手机号 + 登出按钮
// 不修改任何已有组件，仅作为 Auth 体系的"装饰层"叠加在日历 UI 之上
export function UserMenu() {
  const { user, signOut } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 登录页不显示
  if (!user || pathname === '/login') return null;

  // 点外部关闭
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    setConfirming(false);
    router.replace('/login');
  };

  // 手机号脱敏：138****0000
  const maskedPhone = maskPhone(user.phone);

  return (
    <div
      ref={menuRef}
      className="fixed bottom-4 right-4 z-50 select-none"
      style={{ fontFamily: 'inherit' }}
    >
      {open && (
        <div className="mb-2 w-64 rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-medium">
              📅
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">
                {maskedPhone || '已登录'}
              </div>
              <div className="text-xs text-muted-foreground">云端同步已开启</div>
            </div>
          </div>

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-2 w-full rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
            >
              退出登录
            </button>
          ) : (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-muted-foreground">确认退出登录？</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex-1 rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:opacity-90 transition-opacity"
                >
                  确认退出
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center"
        title="账号菜单"
        aria-label="账号菜单"
      >
        <span className="text-sm font-medium">👤</span>
      </button>
    </div>
  );
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}
