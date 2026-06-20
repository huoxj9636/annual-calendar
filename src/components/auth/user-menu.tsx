'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { User as UserIcon, LogOut, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useUser } from '@/components/auth/user-context';

/**
 * 浮动用户菜单 - 左下角
 *
 * 设计意图:
 * - 这是**登录后**才出现的用户菜单(触发同步状态查看、登出等操作)
 * - 位置:左下角
 * - 行为:
 *   - 未登录:**完全不显示**(不占位)
 *   - 已登录:显示头像按钮 → 点击展开菜单(手机号/同步状态/登出)
 * - 右上角另有独立的 <LoginButton /> 始终可见
 */
export function UserMenu() {
  const { user, signOut, authChecked } = useUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 点外部关闭(所有 hooks 必须在 early return 之前)
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

  // 登录页不显示
  if (pathname === '/login') return null;

  // 等登录态检查完
  if (!authChecked) return null;

  // ── 游客模式:显示"未同步"提示卡(让用户随时知道登录同步功能在左下角) ──
  if (!user) {
    return (
      <div
        className="fixed bottom-4 left-4 z-50 select-none"
        style={{ fontFamily: 'inherit' }}
      >
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-login-dialog'))}
          className="group flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-amber-700 shadow-md hover:bg-amber-100 transition-colors dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-950"
          title="点击登录账号,数据自动同步到云端"
          aria-label="登录同步(游客模式)"
        >
          <CloudOff className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">未同步 · 点击登录</span>
        </button>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    setConfirming(false);
  };

  const maskedPhone = maskPhone(user.phone);
  const lastSyncText = '云端同步已启用';

  return (
    <div
      ref={menuRef}
      className="fixed bottom-4 left-4 z-50 select-none"
      style={{ fontFamily: 'inherit' }}
    >
      {open && (
        <div className="mb-2 w-64 rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">
                {maskedPhone || '已登录'}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Cloud className="h-3 w-3" />
                {lastSyncText}
              </div>
            </div>
          </div>

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-2 w-full rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left flex items-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              退出登录
            </button>
          ) : (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-muted-foreground">确认退出登录？退出后数据仍保留在本地,可重新登录恢复。</p>
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
        <UserIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}
