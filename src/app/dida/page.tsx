"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const DEFAULT_DIDA_URL = "https://dida365.com/webapp/#q/all/timeline";

function DidaContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || DEFAULT_DIDA_URL;
  const [mounted, setMounted] = useState(false);

  // 客户端挂载后立即跳转到外网
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // 把当前 origin 存到 localStorage，让用户从 dida365.com 回来时
    // 能回到他出发的环境（开发 / 生产环境不会跳错地方）。
    try {
      localStorage.setItem('ext-back-calendar-url', window.location.origin);
    } catch {}
    // 用 history.replaceState 把当前条目从 /dida 替换成 /,
    // 这样浏览器历史栈里不会留下 /dida 中间页。
    // 用户从 dida365.com 按浏览器返回时，直接回到日历主页 /。
    window.history.replaceState(null, '', '/');
    window.location.href = url;
  }, [mounted, url]);

  return null;
}

export default function DidaPage() {
  return (
    <Suspense fallback={null}>
      <DidaContent />
    </Suspense>
  );
}
