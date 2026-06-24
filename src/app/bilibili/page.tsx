"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const DEFAULT_BILIBILI_URL = "https://www.bilibili.com";

function BilibiliContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || DEFAULT_BILIBILI_URL;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // 把当前 origin 存到 localStorage，让用户从 bilibili 回来时
    // 能回到他出发的环境（开发 / 生产环境不会跳错地方）。
    try {
      localStorage.setItem('ext-back-calendar-url', window.location.origin);
    } catch {}
    // 用 history.replaceState 把当前条目从 /bilibili 替换成 /,
    // 这样浏览器历史栈里不会留下 /bilibili 中间页。
    // 用户从 bilibili.com 按浏览器返回时，直接回到日历主页 /。
    window.history.replaceState(null, "", "/");
    window.location.href = url;
  }, [mounted, url]);

  return null;
}

export default function BilibiliPage() {
  return (
    <Suspense fallback={null}>
      <BilibiliContent />
    </Suspense>
  );
}
