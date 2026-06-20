'use client';

import { useEffect, useState } from 'react';
import { SKINS, NO_SKIN, DEFAULT_SKIN, type SkinTheme } from '@/lib/skins';

/**
 * 读取当前皮肤主题色(skin.swatch)
 *
 * 设计意图:
 * - 跟随设置面板切换皮肤时实时更新
 * - 跨标签页同步:监听 'storage' 事件
 * - 同标签页同步:监听 'life-calendar-skin-changed' 自定义事件
 *   (由 year-calendar 的皮肤切换处 dispatch)
 *
 * SSR 阶段返回 NO_SKIN.swatch 作为安全 fallback,客户端 mount 后
 * useEffect 会用真实值覆盖,不会触发 hydration mismatch(组件只在客户端
 * 用该值渲染,服务端只渲染空壳或稳定值)。
 */
export function useSkinSwatch(): string {
  const [swatch, setSwatch] = useState<string>(NO_SKIN.swatch);

  useEffect(() => {
    const apply = () => {
      try {
        const stored = localStorage.getItem('life-calendar-skin');
        const key = stored ?? DEFAULT_SKIN;
        const found: SkinTheme | undefined = key
          ? SKINS.find((s) => s.key === key)
          : NO_SKIN;
        setSwatch(found?.swatch || NO_SKIN.swatch);
      } catch {
        setSwatch(NO_SKIN.swatch);
      }
    };
    apply();
    window.addEventListener('storage', apply);
    window.addEventListener('life-calendar-skin-changed', apply);
    return () => {
      window.removeEventListener('storage', apply);
      window.removeEventListener('life-calendar-skin-changed', apply);
    };
  }, []);

  return swatch;
}
