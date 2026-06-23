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
