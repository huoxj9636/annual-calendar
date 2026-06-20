'use client';

import { usePathname } from 'next/navigation';
import { LogIn, CheckCircle2 } from 'lucide-react';
import { useUser } from '@/components/auth/user-context';

/**
 * 浮动登录按钮 - 主页右上角(始终可见)
 *
 * 设计意图:
 * - 这是用户**主动**登录的入口
 * - 位置:右上角,和年历的"设置"按钮并列
 * - 行为:
 *   - 未登录:显示「登录同步」按钮 → 点击唤起弹窗
 *   - 已登录:显示「已同步 ✓」标识(只读,不展开菜单)
 * - 真正可操作的用户菜单在左下角的 <UserMenu /> 里
 *
 * 弹窗唤起方式:dispatch 'open-login-dialog' 自定义事件
 * LoginPromptDialog 全局监听此事件
 */
export function LoginButton() {
  const { user, authChecked } = useUser();
  const pathname = usePathname();

  // 登录页不显示
  if (pathname === '/login') return null;

  // 等登录态检查完再决定显示什么(避免登录前后闪烁)
  if (!authChecked) return null;

  const handleLogin = () => {
    // 唤起弹窗(不跳转)
    window.dispatchEvent(new CustomEvent('open-login-dialog', { detail: { reason: 'manual' } }));
  };

  // ── 已登录:显示"已同步"只读标识 ──
  if (user) {
    return (
      <div
        className="fixed top-4 right-4 z-40 select-none"
        style={{ fontFamily: 'inherit' }}
      >
        <div
          className="h-9 px-3.5 rounded-full bg-card border border-border shadow-md flex items-center gap-2 text-sm text-muted-foreground"
          title="数据已同步到云端"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          <span>已同步</span>
        </div>
      </div>
    );
  }

  // ── 未登录:显示"登录"按钮 ──
  return (
    <div
      className="fixed top-4 right-4 z-40 select-none"
      style={{ fontFamily: 'inherit' }}
    >
      <button
        type="button"
        onClick={handleLogin}
        className="h-9 px-3.5 rounded-full bg-card border border-border shadow-md hover:bg-muted transition-colors flex items-center gap-2 text-sm text-foreground"
        title="登录后可跨设备同步数据"
        aria-label="登录"
      >
        <LogIn className="h-3.5 w-3.5 text-muted-foreground" />
        <span>登录</span>
      </button>
    </div>
  );
}
