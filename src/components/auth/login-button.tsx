'use client';

import { usePathname } from 'next/navigation';
import { LogIn, CheckCircle2 } from 'lucide-react';
import { useUser } from '@/components/auth/user-context';
import { useSkinSwatch } from '@/hooks/use-skin-swatch';

/**
 * 顶部工具栏登录按钮 - 主页右上角(始终可见)
 *
 * 设计意图:
 * - 位置:右上角 fixed top-[34px] right-4(往下移 10pt + 6pt ≈ 20px,让开页面最顶端)
 * - 颜色:**跟随当前皮肤主题色**(skin.swatch) - 与左下角 UserMenu 协调一致
 * - 行为:
 *   - 未登录:显示「登录」文字+图标 → 点击唤起弹窗
 *   - 已登录:显示「已同步 ✓」只读徽章(同样的强调色样式)
 * - 真正的用户菜单在左下角的 <UserMenu /> 里
 */
export function LoginButton() {
  const { user, authChecked } = useUser();
  const pathname = usePathname();
  const swatch = useSkinSwatch();

  // 登录页不显示
  if (pathname === '/login') return null;

  // 等登录态检查完再决定显示什么
  if (!authChecked) return null;

  const handleLogin = () => {
    window.dispatchEvent(new CustomEvent('open-login-dialog', { detail: { reason: 'manual' } }));
  };

  // ── 已登录:显示"已同步"只读徽章(主题色实色 + 白字 + 阴影) ──
  if (user) {
    return (
      <div
        className="fixed top-[34px] right-4 z-40 select-none"
        style={{ fontFamily: 'inherit' }}
      >
        <div
          className="h-10 px-4 rounded-full flex items-center gap-1.5 text-sm font-semibold shadow-lg ring-1"
          style={{
            backgroundColor: swatch,
            color: '#ffffff',
            // @ts-expect-error tailwind ring color via CSS var
            '--tw-ring-color': swatch + '30',
          }}
          title="数据已同步到云端"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>已同步</span>
        </div>
      </div>
    );
  }

  // ── 未登录:醒目的「登录」按钮(主题色 + 阴影 + 文字) ──
  return (
    <div
      className="fixed top-[34px] right-4 z-40 select-none"
      style={{ fontFamily: 'inherit' }}
    >
      <button
        type="button"
        onClick={handleLogin}
        className="group h-10 px-4 rounded-full text-sm font-semibold shadow-lg ring-1 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
        style={{
          backgroundColor: swatch,
          color: '#ffffff',
          // @ts-expect-error tailwind ring color via CSS var
          '--tw-ring-color': swatch + '30',
        }}
        title="登录账号,数据自动同步到云端"
        aria-label="登录账号"
      >
        <LogIn className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        <span>登录</span>
      </button>
    </div>
  );
}
