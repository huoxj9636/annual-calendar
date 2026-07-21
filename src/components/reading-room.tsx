"use client";

/* reading-room.tsx — 书库：全屏嵌入石墨文档 */

import { ChevronLeft, ExternalLink } from "lucide-react";
import type { SkinTheme } from "@/lib/skins";

const SHIMO_URL = "https://shimo.im/docs/N2A1gBe87Eu1gKqD";

interface ReadingRoomProps {
  skin: SkinTheme;
  onBack: () => void;
}

export default function ReadingRoom({ skin, onBack }: ReadingRoomProps) {
  return (
    <div className="fixed inset-0 z-[60]">
      {/* 全屏 iframe */}
      <iframe
        src={SHIMO_URL}
        className="w-full h-full border-0"
        title="书库 - 书单"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />

      {/* 左上角返回按钮 */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium shadow-lg transition-all hover:scale-105"
        style={{
          background: skin.cardBg,
          color: skin.textPrimary,
          border: `1px solid ${skin.divider}`,
          boxShadow: `0 4px 16px rgba(0,0,0,0.12)`,
        }}
      >
        <ChevronLeft size={16} />
        返回
      </button>

      {/* 右上角新窗口打开 */}
      <a
        href={SHIMO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-4 flex items-center gap-1 px-3 py-2 rounded-full text-sm shadow-lg transition-all hover:scale-105"
        style={{
          background: skin.cardBg,
          color: skin.textSecondary,
          border: `1px solid ${skin.divider}`,
          boxShadow: `0 4px 16px rgba(0,0,0,0.12)`,
        }}
      >
        <ExternalLink size={14} />
      </a>
    </div>
  );
}
