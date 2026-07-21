"use client";

/* reading-room.tsx — 书房：嵌入石墨文档书单 */

import { ExternalLink } from "lucide-react";
import type { SkinTheme } from "@/lib/skins";

const SHIMO_URL = "https://shimo.im/docs/N2A1gBe87Eu1gKqD";

interface ReadingRoomProps {
  skin: SkinTheme;
}

export default function ReadingRoom({ skin }: ReadingRoomProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* 顶部工具栏 */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: skin.divider }}
      >
        <span
          className="text-xs"
          style={{ color: skin.textMuted }}
        >
          书房 · 书单
        </span>
        <a
          href={SHIMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
          style={{
            color: skin.swatch,
            background: skin.swatch + "10",
          }}
        >
          <ExternalLink size={12} />
          新窗口打开
        </a>
      </div>

      {/* 石墨文档 iframe */}
      <iframe
        src={SHIMO_URL}
        className="flex-1 w-full border-0"
        title="书房 - 书单"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
