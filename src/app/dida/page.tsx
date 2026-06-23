"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const DEFAULT_DIDA_URL = "https://dida365.com/webapp/#q/all/timeline";
const COUNTDOWN_SECONDS = 3;

function DidaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || DEFAULT_DIDA_URL;

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [cancelled, setCancelled] = useState(false);
  const navigatedRef = useRef(false);

  // 倒计时
  useEffect(() => {
    if (cancelled || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, cancelled]);

  // 倒计时归零后自动跳走
  useEffect(() => {
    if (cancelled || countdown > 0) return;
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    window.location.href = url;
  }, [countdown, cancelled, url]);

  const goNow = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    window.location.href = url;
  };

  const goNewTab = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const goBack = () => {
    if (navigatedRef.current) return;
    setCancelled(true);
    router.back();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-muted/30">
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

      {/* 中转主卡片 */}
      <div className="bg-card text-card-foreground rounded-3xl shadow-2xl p-10 max-w-md w-full mx-4 text-center border border-border">
        {/* Logo */}
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-primary text-primary-foreground shadow-lg">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
            <path d="M8 12l3 3 5-6" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-1.5">滴答清单</h1>
        <p className="text-xs text-muted-foreground mb-6">dida365.com</p>

        {cancelled ? (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">已取消跳转</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              点击下方按钮返回日历
            </p>
          </div>
        ) : navigatedRef.current ? (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              正在跳转到滴答清单...
            </p>
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              即将离开本站前往滴答清单
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-mono text-2xl font-bold bg-primary text-primary-foreground">
                {countdown}
              </div>
              <span className="text-xs text-muted-foreground">
                秒后自动跳转
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            onClick={goNow}
            disabled={cancelled || navigatedRef.current}
            className="w-full py-3 rounded-xl text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-primary"
          >
            立即进入滴答清单 →
          </button>
          <button
            onClick={goNewTab}
            className="w-full py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-all"
          >
            ↗ 在新标签页打开
          </button>
          <button
            onClick={goBack}
            disabled={navigatedRef.current}
            className="w-full py-3 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors disabled:opacity-50"
          >
            取消，返回日历
          </button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground/70 leading-relaxed">
          滴答清单设置了安全策略，不允许在 iframe 中嵌入，
          <br />
          因此需要跳转访问
        </p>
      </div>
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
