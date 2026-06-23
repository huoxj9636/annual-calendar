"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IframeControls } from "@/components/forest/iframe-controls";

const DEFAULT_DIDA_URL = "https://dida365.com/webapp/#q/all/timeline";

function DidaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || DEFAULT_DIDA_URL;

  return (
    <div className="fixed inset-0 z-0 bg-white">
      <iframe
        src={url}
        className="absolute inset-0 w-full h-full border-0"
        title="滴答清单"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
      <IframeControls
        treeName="滴答清单"
        treeLink={url}
        onBack={() => router.back()}
      />
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
