"use client";

/**
 * ForestScene - 森林全景场景画布
 *
 * 设计意象：清晨薄雾笼罩的山谷森林
 * 四层透视：晨空 → 远山 → 中景 → 草地
 * 树苗按节点数量成长为不同阶段
 */

import { useMemo } from "react";
import {
  Sprout,
  TreePine,
  TreeDeciduous,
  TreePalm,
  Cherry,
  Trees,
  Cloud,
  Sun,
} from "lucide-react";
import type { SkinTheme } from "@/lib/skins";

export type ForestItem = {
  id: string;
  name: string;
  /** 节点数量，用于决定树大小/阶段 */
  count: number;
  /** 可选：徽章文本（好友首字母等） */
  badge?: string;
  /** 可选：自定义颜色（用于好友森林区分） */
  accentColor?: string;
};

export type ForestSceneProps = {
  items: ForestItem[];
  skin: SkinTheme;
  /** 高度（默认 360）；当 fillHeight 为 true 时被忽略，使用父容器高度 */
  height?: number;
  /** 填满父容器高度（用于铺满整个详情页场景） */
  fillHeight?: boolean;
  /** 点击树木回调 */
  onItemClick?: (id: string) => void;
  /** 选中的 item id（高亮） */
  selectedId?: string;
  /** 变体：my = 我的森林，friends = 好友森林 */
  variant?: "my" | "friends";
};

/**
 * 树阶段
 * 0 个节点：空地（显示树桩提示）
 * 1-2：幼苗 Sprout
 * 3-7：小树 TreePine
 * 8-15：成树 TreeDeciduous
 * 16+ ：参天 Trees
 */
function getStage(count: number) {
  if (count === 0) return { tier: 0, label: "空地", size: 0, Icon: Sprout };
  if (count <= 2) return { tier: 1, label: "幼苗", size: 1, Icon: Sprout };
  if (count <= 7) return { tier: 2, label: "小树", size: 2, Icon: TreePine };
  if (count <= 15) return { tier: 3, label: "成树", size: 3, Icon: TreeDeciduous };
  if (count <= 30) return { tier: 4, label: "参天", size: 4, Icon: Cherry };
  return { tier: 5, label: "古木", size: 5, Icon: Trees };
}

/** 简易 hash，用于稳定的位置抖动 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const TREE_HEIGHTS: Record<number, { h: number; crown: number; trunk: number }> = {
  0: { h: 32, crown: 16, trunk: 12 }, // 空地（小树桩）
  1: { h: 56, crown: 36, trunk: 18 }, // 幼苗
  2: { h: 96, crown: 64, trunk: 30 }, // 小树
  3: { h: 136, crown: 90, trunk: 44 }, // 成树
  4: { h: 168, crown: 110, trunk: 56 }, // 参天
  5: { h: 200, crown: 132, trunk: 66 }, // 古木
};

/** 单棵树 */
function ForestTree({
  item,
  x,
  y,
  selected,
  onClick,
  skin,
  variant,
  index,
}: {
  item: ForestItem;
  x: number;
  y: number;
  selected: boolean;
  onClick?: () => void;
  skin: SkinTheme;
  variant: "my" | "friends";
  index: number;
}) {
  const stage = getStage(item.count);
  const sizes = TREE_HEIGHTS[stage.size] || TREE_HEIGHTS[1];
  const swayDelay = `${(index % 7) * 0.4}s`;
  const swayDuration = `${4 + (index % 4) * 0.5}s`;
  const accent = item.accentColor || skin.swatch;

  // 树冠颜色：从主题色到略深渐变
  // 用 mix-blend 不可靠，直接用主色 + alpha 表示深浅
  const crownOpacity = 0.55 + stage.size * 0.05; // 越大越浓
  const crownDeep = 0.85 + stage.size * 0.03;
  const Icon = stage.Icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute group focus:outline-none"
      style={{
        left: `${x}%`,
        bottom: `${y}%`,
        transform: "translateX(-50%)",
        width: sizes.crown + 16,
        height: sizes.h + 8,
        cursor: onClick ? "pointer" : "default",
      }}
      title={`${item.name} · ${stage.label} · ${item.count} 个知识`}
    >
      {/* 树阴影（草地投影） */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full blur-[2px]"
        style={{
          bottom: -2,
          width: sizes.crown * 0.7,
          height: 6,
          background: "rgba(0,0,0,0.18)",
        }}
      />

      {/* 整树摇摆容器 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 origin-bottom"
        style={{
          bottom: 0,
          width: sizes.crown,
          height: sizes.h,
          animation: onClick
            ? `treeSway ${swayDuration} ease-in-out ${swayDelay} infinite alternate`
            : undefined,
        }}
      >
        {/* 树干 */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: 0,
            width: Math.max(6, sizes.trunk * 0.18),
            height: sizes.trunk,
            background: "linear-gradient(90deg, #4a2f1a 0%, #6B4423 45%, #4a2f1a 100%)",
            borderRadius: "2px 2px 1px 1px",
          }}
        />
        {/* 树冠 */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
          style={{
            bottom: sizes.trunk - sizes.crown * 0.08,
            width: sizes.crown,
            height: sizes.crown,
            background: `radial-gradient(circle at 35% 30%, ${accent}55 0%, ${accent}aa ${30 * crownOpacity}% , ${accent} ${crownDeep * 100}%)`,
            borderRadius: "50%",
            boxShadow: `0 4px 16px ${accent}44, inset 0 -8px 12px ${accent}66`,
            border: `1px solid ${accent}55`,
            transition: "transform 200ms ease-out, box-shadow 200ms ease-out",
          }}
        >
          {variant === "friends" && item.badge ? (
            <span
              className="text-white font-semibold"
              style={{ fontSize: sizes.crown * 0.32 }}
            >
              {item.badge}
            </span>
          ) : (
            <Icon
              size={sizes.crown * 0.45}
              strokeWidth={1.4}
              style={{ color: "rgba(255,255,255,0.85)" }}
            />
          )}
        </div>

        {/* 阶段/数量徽章（仅悬停显示） */}
        <div
          className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
          style={{
            bottom: sizes.h + 4,
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            letterSpacing: "0.04em",
          }}
        >
          {item.name} · {item.count}
        </div>
      </div>

      {/* 选中光圈 */}
      {selected && (
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            bottom: -6,
            width: sizes.crown * 0.9,
            height: sizes.crown * 0.18,
            background: `radial-gradient(ellipse, ${accent}66 0%, transparent 70%)`,
            animation: "pulseRing 2s ease-in-out infinite",
          }}
        />
      )}
    </button>
  );
}

/** 飘落叶 */
function FallingLeaves({ skin }: { skin: SkinTheme }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        left: 5 + (i * 17) % 90,
        delay: i * 1.7,
        duration: 9 + (i % 3) * 2,
        size: 8 + (i % 3) * 3,
        rotateDir: i % 2 === 0 ? 1 : -1,
        key: i,
      })),
    []
  );
  return (
    <>
      {leaves.map((l) => (
        <div
          key={l.key}
          className="absolute pointer-events-none"
          style={{
            left: `${l.left}%`,
            top: -20,
            width: l.size,
            height: l.size,
            color: "#D4A574",
            opacity: 0.7,
            animation: `leafFall ${l.duration}s linear ${l.delay}s infinite`,
            transformOrigin: "center",
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8 6 4 10 4 14a8 8 0 0016 0c0-4-4-8-8-12z" />
          </svg>
        </div>
      ))}
    </>
  );
}

/** 漂浮云朵 */
function DriftingClouds() {
  const clouds = useMemo(
    () =>
      [
        { top: 8, delay: 0, duration: 38, scale: 1 },
        { top: 18, delay: 12, duration: 52, scale: 0.7 },
        { top: 5, delay: 26, duration: 44, scale: 1.2 },
      ],
    []
  );
  return (
    <>
      {clouds.map((c, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: -100,
            top: `${c.top}%`,
            color: "rgba(255,255,255,0.7)",
            transform: `scale(${c.scale})`,
            filter: "blur(0.5px)",
            animation: `cloudDrift ${c.duration}s linear ${c.delay}s infinite`,
          }}
        >
          <Cloud size={56} fill="currentColor" strokeWidth={0.5} />
        </div>
      ))}
    </>
  );
}

/** 阳光光斑 */
function Sunbeams() {
  const beams = [
    { left: 18, top: 22, size: 120, delay: 0 },
    { left: 55, top: 12, size: 160, delay: 1.5 },
    { left: 78, top: 32, size: 100, delay: 3 },
  ];
  return (
    <>
      {beams.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: b.size,
            height: b.size,
            background:
              "radial-gradient(circle, rgba(255,250,230,0.35) 0%, rgba(255,250,230,0.1) 40%, transparent 70%)",
            filter: "blur(8px)",
            animation: `sunbeamPulse 5s ease-in-out ${b.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

export default function ForestScene({
  items,
  skin,
  height = 360,
  fillHeight = false,
  onItemClick,
  selectedId,
  variant = "my",
}: ForestSceneProps) {
  // 树木位置：均匀分布 + 稳定 hash 抖动
  const layout = useMemo(() => {
    const total = items.length;
    if (total === 0) return [];
    return items.map((item, i) => {
      // 主体均匀分布，保留 8% 边距
      const baseX = 8 + (i / Math.max(total - 1, 1)) * 84;
      const h = hashStr(item.id);
      const jitter = ((h % 800) / 100) - 4; // -4 ~ +4
      const x = Math.max(5, Math.min(95, baseX + jitter));
      // y 在前景草地（15-30%）和中景（30-50%）之间，根据 stage.size 决定
      const stage = getStage(item.count);
      const yBase = stage.size >= 4 ? 22 : stage.size === 3 ? 28 : stage.size === 2 ? 34 : 40;
      const yJitter = ((h >> 8) % 80) / 10 - 4;
      const y = Math.max(8, Math.min(50, yBase + yJitter));
      return { item, x, y };
    });
  }, [items]);

  // 关键样式
  const sceneStyle: React.CSSProperties = {
    ...(fillHeight ? { height: "100%" } : { height }),
    background: `linear-gradient(180deg,
      oklch(0.97 0.02 85) 0%,
      oklch(0.94 0.04 95) 35%,
      ${skin.swatch}10 75%,
      ${skin.swatch}25 100%)`,
    borderRadius: fillHeight ? 0 : 16,
    overflow: "hidden",
    position: "relative",
    boxShadow: fillHeight ? "none" : "0 10px 30px -10px rgba(0,0,0,0.15)",
  };

  return (
    <>
      <style>{`
        @keyframes treeSway {
          0%   { transform: translateX(-50%) rotate(-1.4deg); }
          100% { transform: translateX(-50%) rotate(1.4deg); }
        }
        @keyframes leafFall {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          8%   { opacity: 0.7; }
          50%  { transform: translate(40px, 200px) rotate(180deg); }
          92%  { opacity: 0.6; }
          100% { transform: translate(-20px, 480px) rotate(360deg); opacity: 0; }
        }
        @keyframes cloudDrift {
          0%   { transform: translateX(0) scale(var(--s, 1)); }
          100% { transform: translateX(calc(100vw + 200px)) scale(var(--s, 1)); }
        }
        @keyframes sunbeamPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 0.9; transform: scale(1.08); }
        }
        @keyframes pulseRing {
          0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
          50%      { opacity: 0.2; transform: translateX(-50%) scale(1.2); }
        }
      `}</style>

      <div style={sceneStyle} className={fillHeight ? "w-full h-full" : "w-full"}>
        {/* 晨曦太阳 */}
        <div
          className="absolute pointer-events-none"
          style={{
            right: 32,
            top: 24,
            color: "#FFD27A",
            filter: "drop-shadow(0 0 16px rgba(255, 210, 122, 0.5))",
            animation: "sunbeamPulse 6s ease-in-out infinite",
          }}
        >
          <Sun size={48} fill="currentColor" strokeWidth={1} />
        </div>

        {/* 漂浮云朵 */}
        <DriftingClouds />

        {/* 远山（三层叠加，从远到近） */}
        <svg
          className="absolute inset-x-0 bottom-0 w-full pointer-events-none"
          viewBox="0 0 1000 220"
          preserveAspectRatio="none"
          style={{ height: "70%" }}
        >
          {/* 最远山：连绵圆润的低矮山脊 */}
          <path
            d="M0,180 Q40,150 80,160 Q140,135 200,150 Q260,125 320,145 Q400,120 480,135 Q560,115 640,130 Q720,110 800,135 Q880,125 1000,140 L1000,220 L0,220 Z"
            fill={skin.swatch}
            opacity={0.14}
          />
          {/* 中景山：圆润起伏 + 一座尖峰点缀 */}
          <path
            d="M0,200 Q60,170 130,185 Q200,160 280,175 Q360,140 440,170 Q520,150 600,165 L640,88 L680,165 Q740,145 820,170 Q900,160 1000,175 L1000,220 L0,220 Z"
            fill={skin.swatch}
            opacity={0.22}
          />
          {/* 近山：圆润丘陵 + 两座明显尖峰 */}
          <path
            d="M0,215 Q60,195 130,205 Q190,185 250,200 Q300,170 340,195 L380,118 L420,200 Q480,185 540,205 Q600,175 650,200 L700,92 L740,200 Q790,185 850,205 Q920,195 1000,205 L1000,220 L0,220 Z"
            fill={skin.swatch}
            opacity={0.32}
          />
        </svg>

        {/* 草地 */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: "32%",
            background: `linear-gradient(180deg, ${skin.swatch}30 0%, ${skin.swatch}50 100%)`,
            borderTop: `1px solid ${skin.swatch}40`,
          }}
        />

        {/* 阳光光斑 */}
        <Sunbeams />

        {/* 飘落叶 */}
        <FallingLeaves skin={skin} />

        {/* 树木 */}
        {layout.map(({ item, x, y }, i) => (
          <ForestTree
            key={item.id}
            item={item}
            x={x}
            y={y}
            selected={item.id === selectedId}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            skin={skin}
            variant={variant}
            index={i}
          />
        ))}

        {/* 空状态 */}
        {items.length === 0 && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ color: skin.textSecondary }}
          >
            <Trees size={56} strokeWidth={1} className="opacity-40 mb-2" />
            <p className="text-sm opacity-70">这里还是一片荒地</p>
            <p className="text-xs opacity-50 mt-1">点击右下角种下第一棵树</p>
          </div>
        )}
      </div>
    </>
  );
}
