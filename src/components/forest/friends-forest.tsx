"use client";

/**
 * FriendsForest - 好友森林
 *
 * 在森林场景中展示好友头像，每位好友是森林中的一棵树
 * 点击头像树 → 跳转到好友主页
 */

import { useState } from "react";
import { Plus, ExternalLink, X, Users, TreeDeciduous } from "lucide-react";
import ForestScene, { type ForestItem } from "./forest-scene";
import type { SkinTheme } from "@/lib/skins";
import type { Bookmark } from "../knowledge-panel";

/** 简单的 hash → 颜色映射（基于姓名首字母） */
function hashToColor(name: string, skin: SkinTheme): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const palette = [
    skin.swatch,
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
  ];
  return palette[Math.abs(h) % palette.length];
}

export default function FriendsForest({
  bookmarks,
  onAdd,
  onDelete,
  skin,
}: {
  bookmarks: Bookmark[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  skin: SkinTheme;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const items: ForestItem[] = bookmarks.map((b) => ({
    id: b.id,
    name: b.name,
    count: 1 + (b.name.charCodeAt(0) % 4), // 用名字稳定生成一个 1-4 的"能量"
    badge: b.name.charAt(0).toUpperCase(),
    accentColor: hashToColor(b.name, skin),
  }));

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      {/* 顶部统计 */}
      <div
        className="flex items-center justify-between p-4 rounded-lg"
        style={{
          background: skin.cardBg,
          border: `1px solid ${skin.divider}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: `${skin.swatch}20`, color: skin.swatch }}
          >
            <Users size={18} />
          </div>
          <div>
            <div
              className="text-xs tracking-widest uppercase"
              style={{ color: skin.textMuted }}
            >
              Friends Forest
            </div>
            <div
              className="text-lg font-semibold"
              style={{
                color: skin.textPrimary,
                fontFamily: "var(--font-serif)",
              }}
            >
              {bookmarks.length === 0
                ? "好友森林"
                : `${bookmarks.length} 位伙伴在林间`}
            </div>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-full flex items-center gap-1.5 text-sm font-medium transition-transform hover:scale-105"
          style={{ background: skin.swatch, color: "#fff" }}
        >
          <Plus size={14} />
          邀请好友
        </button>
      </div>

      {/* 森林场景 */}
      <div className="relative">
        <ForestScene
          items={items}
          skin={skin}
          height={380}
          variant="friends"
          onItemClick={(id) => {
            const bm = bookmarks.find((b) => b.id === id);
            if (bm) {
              window.open(bm.url, "_blank", "noopener,noreferrer");
            }
          }}
          selectedId={hoverId || undefined}
        />

        {/* 提示气泡 */}
        <div
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 pointer-events-none"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(6px)",
            color: skin.textSecondary,
            border: `1px solid ${skin.divider}`,
          }}
        >
          <TreeDeciduous size={12} style={{ color: skin.swatch }} />
          点击好友树·访问主页
        </div>
      </div>

      {/* 好友列表（紧凑横排） */}
      {bookmarks.length > 0 && (
        <div>
          <div
            className="text-xs tracking-widest uppercase mb-2 px-1"
            style={{ color: skin.textMuted }}
          >
            林中伙伴
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {bookmarks.map((b) => {
              const color = hashToColor(b.name, skin);
              return (
                <div
                  key={b.id}
                  className="group p-3 rounded-lg flex items-center gap-3 transition-all hover:scale-[1.02]"
                  style={{
                    background: skin.cardBg,
                    border: `1px solid ${skin.divider}`,
                  }}
                  onMouseEnter={() => setHoverId(b.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${color}, ${color}aa)`,
                      boxShadow: `0 2px 6px ${color}44`,
                    }}
                  >
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: skin.textPrimary }}
                    >
                      {b.name}
                    </div>
                    <div
                      className="text-[10px] truncate"
                      style={{ color: skin.textMuted }}
                    >
                      {b.url.replace(/^https?:\/\//, "")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => window.open(b.url, "_blank", "noopener,noreferrer")}
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: `${skin.swatch}15`, color: skin.swatch }}
                      title="访问主页"
                    >
                      <ExternalLink size={12} />
                    </button>
                    <button
                      onClick={() => onDelete(b.id)}
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                      title="移除"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 空状态：邀请好友的提示卡 */}
      {bookmarks.length === 0 && (
        <div
          className="p-6 rounded-lg text-center"
          style={{
            background: `linear-gradient(135deg, ${skin.swatch}10, ${skin.swatch}05)`,
            border: `1px dashed ${skin.swatch}55`,
          }}
        >
          <div
            className="text-sm font-medium mb-1"
            style={{ color: skin.textPrimary }}
          >
            种一棵树，先从一位朋友开始
          </div>
          <div
            className="text-xs"
            style={{ color: skin.textSecondary }}
          >
            把那些启发过你的链接变成森林里的伙伴
          </div>
        </div>
      )}
    </div>
  );
}
