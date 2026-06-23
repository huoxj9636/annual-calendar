"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const DEFAULT_DIDA_URL = "https://dida365.com/webapp/#q/all/timeline";
const AUTO_NAV_DELAY = 500;

function DidaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || DEFAULT_DIDA_URL;

  const [cancelled, setCancelled] = useState(false);
  const navigatedRef = useRef(false);

  // 进入页面后自动跳转
  useEffect(() => {
    if (cancelled) return;
    const t = setTimeout(() => {
      if (navigatedRef.current || cancelled) return;
      navigatedRef.current = true;
      window.location.href = url;
    }, AUTO_NAV_DELAY);
    return () => clearTimeout(t);
  }, [cancelled, url]);

  const goNewTab = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    setCancelled(true);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const goBack = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    setCancelled(true);
    router.back();
  };

  return (
    <div className="fixed inset-0 bg-background">
      {/* 顶部固定返回按钮 - 知识森林 IframeControls 风格 */}
      <button
        type="button"
        aria-label="返回日历"
        title="返回日历"
        onClick={goBack}
        className="fixed top-4 left-4 z-10 w-10 h-10 rounded-full shadow-md flex items-center justify-center select-none transition-transform duration-150 ease-out cursor-pointer hover:scale-110 active:scale-95 bg-primary text-primary-foreground"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* 顶部固定新窗口按钮 - 知识森林 IframeControls 风格 */}
      <button
        type="button"
        aria-label="在新标签页打开"
        title="在新标签页打开"
        onClick={goNewTab}
        className="fixed top-4 right-4 z-10 w-10 h-10 rounded-full shadow-md flex items-center justify-center select-none transition-transform duration-150 ease-out cursor-pointer hover:scale-110 active:scale-95 bg-primary text-primary-foreground"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 3h7v7" />
          <path d="M10 14L21 3" />
          <path d="M21 14v7H3V3h7" />
        </svg>
      </button>
    </div>
  );
}

export default function DidaPage() {
  return (
    <Suspense fallback={null}>
      <DidaContent />
    </Suspense>
  );
}
