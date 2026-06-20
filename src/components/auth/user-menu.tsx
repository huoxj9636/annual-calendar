'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { User as UserIcon, LogOut, Cloud, CloudOff } from 'lucide-react';
import { useUser } from '@/components/auth/user-context';
import { useSkinSwatch } from '@/hooks/use-skin-swatch';

/**
 * 浮动数据同步入口 - 左下角
 *
 * 设计意图:
 * - 始终可见,让用户随时知道"数据云同步功能在左下角"
 * - 颜色跟随当前皮肤主题(skin.swatch),与日历内"设置按钮"风格保持一致
 * - 游客模式:CloudOff 图标(带斜杠) + 主题色半透明背景 + "数据同步" 文字
 * - 已登录:Cloud 图标(无斜杠) + 主题色实色背景 + "已同步" 文字
 * - 右上角另有独立的 <LoginButton /> 作为另一个登录入口
 */
export function UserMenu() {
  const { user, signOut, authChecked } = useUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 读取当前皮肤主题色(skin.swatch) - 跟随设置面板切换皮肤时实时更新
  const swatch = useSkinSwatch();

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

  // swatch 透明度工具:与设置按钮风格保持一致(swatch + '18' 背景, swatch 文字)
  const guestBg = swatch + '18';
  const guestBorder = swatch + '40';
  const guestText = swatch;
  const loggedBg = swatch;
  const loggedText = '#ffffff';

  // ── 游客模式:CloudOff + "数据同步" ──
  if (!user) {
    return (
      <div
        className="fixed bottom-4 left-4 z-50 select-none"
        style={{ fontFamily: 'inherit' }}
      >
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-login-dialog'))}
          className="group flex items-center gap-2 rounded-full px-4 py-2 shadow-md hover:shadow-lg transition-all"
          style={{
            backgroundColor: guestBg,
            color: guestText,
            border: `1px solid ${guestBorder}`,
          }}
          title="点击登录账号,数据自动同步到云端"
          aria-label="数据同步"
        >
          <CloudOff className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-medium">数据同步</span>
        </button>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    setConfirming(false);
    // 登出后清空了 localStorage 中的用户数据，刷新页面让所有组件从空白重新读取
    window.location.reload();
  };

  const maskedPhone = maskPhone(user.phone);

  return (
    <div
      ref={menuRef}
      className="fixed bottom-4 left-4 z-50 select-none"
      style={{ fontFamily: 'inherit' }}
    >
      {open && (
        <div
          className="mb-2 w-64 rounded-xl border bg-card p-3 shadow-lg"
          style={{ borderColor: swatch + '30' }}
        >
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: swatch + '20', color: swatch }}
            >
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">
                {maskedPhone || '已登录'}
              </div>
              <div
                className="text-xs flex items-center gap-1"
                style={{ color: swatch }}
              >
                <Cloud className="h-3 w-3" />
                云端同步已启用
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
        className="group flex items-center gap-2 rounded-full px-4 py-2 shadow-lg hover:shadow-xl hover:opacity-95 transition-all"
        style={{
          backgroundColor: loggedBg,
          color: loggedText,
        }}
        title="账号菜单"
        aria-label="账号菜单"
      >
        <Cloud className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-medium">已同步</span>
        {maskedPhone && <span className="text-xs opacity-80">· {maskedPhone}</span>}
      </button>
    </div>
  );
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}
