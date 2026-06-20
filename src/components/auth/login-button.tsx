'use client';

import { usePathname } from 'next/navigation';
import { LogIn, CheckCircle2 } from 'lucide-react';
import { useUser } from '@/components/auth/user-context';

// 默认皮肤色 fallback(读不到 skin 时用)
const DEFAULT_SWATCH = '#34d399';

/**
 * 顶部工具栏登录按钮 - 主页右上角(始终可见)
 *
 * 设计意图:
 * - 视觉上**融入年历顶图**(和"设置/更多/皮肤/视角"按钮同款)
 * - 风格:圆形 36×36,背景 = 当前皮肤色 + 18% 透明度,前景 = 当前皮肤色
 * - 行为:
 *   - 未登录:显示「登录」图标 → 点击唤起弹窗
 *   - 已登录:显示「已同步 ✓」徽章(只读,不展开菜单)
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

  // 读取当前皮肤色(从 localStorage['life-calendar-skin'] 拿)
  // 与年历内部"设置"按钮的样式保持一致
  const swatch = (() => {
    try {
      const raw = localStorage.getItem('life-calendar-skin');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.swatch) return parsed.swatch as string;
      }
    } catch {}
    return DEFAULT_SWATCH;
  })();

  // ── 已登录:显示"已同步"只读徽章(同样的圆形主题色样式) ──
  if (user) {
    return (
      <div
        className="fixed top-4 right-4 z-40 select-none"
        style={{ fontFamily: 'inherit' }}
      >
        <div
          className="h-9 px-3.5 rounded-full flex items-center gap-1.5 text-sm font-medium shadow-sm"
          style={{
            backgroundColor: `${swatch}18`,
            color: swatch,
          }}
          title="数据已同步到云端"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>已同步</span>
        </div>
      </div>
    );
  }

  // ── 未登录:显示"登录"按钮(和"设置"按钮同款圆形主题色) ──
  return (
    <div
      className="fixed top-4 right-4 z-40 select-none"
      style={{ fontFamily: 'inherit' }}
    >
      <button
        onClick={handleLogin}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
        style={{
          backgroundColor: `${swatch}18`,
          color: swatch,
        }}
        title="登录(可同步数据到云端,跨设备共享)"
        aria-label="登录"
      >
        <LogIn className="h-4 w-4" strokeWidth={2.2} />
      </button>
    </div>
  );
}
