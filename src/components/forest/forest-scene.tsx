"use client";

/**
 * ForestScene - 森林全景场景画布
 *
 * 设计意象：清晨薄雾笼罩的山谷森林
 * 四层透视：晨空 → 远山 → 中景 → 草地
 * 树苗按节点数量成长为不同阶段
 */

import { useMemo } from "react";
import { Cloud, Sun, X, Trees } from "lucide-react";
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
  /** 删除树木回调（提供时悬停会出现删除按钮） */
  onItemDelete?: (id: string) => void;
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
  if (count === 0) return { tier: 0, label: "空地", size: 0 };
  if (count <= 2) return { tier: 1, label: "幼苗", size: 1 };
  if (count <= 7) return { tier: 2, label: "小树", size: 2 };
  if (count <= 15) return { tier: 3, label: "成树", size: 3 };
  if (count <= 30) return { tier: 4, label: "参天", size: 4 };
  return { tier: 5, label: "古木", size: 5 };
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
  onDelete,
  skin,
  variant,
  index,
}: {
  item: ForestItem;
  x: number;
  y: number;
  selected: boolean;
  onClick?: () => void;
  onDelete?: () => void;
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
        {/* 波纹树（真实树木：有云朵状树冠 + 梯形树干 + 树皮纹路） */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: 0,
            width: sizes.crown * 1.4,
            height: sizes.trunk + sizes.crown,
            transition: "transform 200ms ease-out",
          }}
        >
          <WaveTree
            tier={stage.tier}
            accent={accent}
            badge={variant === "friends" ? item.badge : undefined}
            isFriends={variant === "friends"}
          />
        </div>

        {/* 阶段/数量徽章（仅悬停显示） */}
        <div
          className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none flex items-center gap-1.5"
          style={{
            bottom: sizes.h + 4,
            fontSize: 11,
            padding: "3px 6px 3px 10px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            letterSpacing: "0.04em",
          }}
        >
          <span>{item.name} · {item.count}</span>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center pointer-events-auto transition-colors"
              style={{ background: "rgba(255,255,255,0.18)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#dc2626";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.18)";
              }}
              title="拔除这棵树"
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          )}
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

/** 波纹树：用多个不规则圆形叠加形成云朵状树冠 + 梯形树干 + 树皮纹路
 *  size 1-2 幼苗/小树：3-4 个云朵
 *  size 3-4 成树/参天：5-6 个云朵 + 树枝分叉
 *  size 5   古木    ：7 个云朵 + 复杂分叉 + 厚重树干
 */
function WaveTree({
  tier,
  accent,
  badge,
  isFriends,
}: {
  tier: number;
  accent: string;
  badge?: string;
  isFriends?: boolean;
}) {
  // 树冠云朵数量随 tier 增长
  const blobCount = Math.min(3 + tier, 7);
  // 7 个不规则云朵位置（手工调过，呈现真实树木的不规则边缘）
  const allBlobs = [
    { cx: 30, cy: 18, r: 11 },   // 顶部主冠
    { cx: 16, cy: 24, r: 9 },    // 左侧
    { cx: 44, cy: 24, r: 10 },   // 右侧
    { cx: 24, cy: 30, r: 8 },    // 中左下
    { cx: 36, cy: 30, r: 8.5 },  // 中右下
    { cx: 8,  cy: 32, r: 6 },    // 左外侧
    { cx: 52, cy: 32, r: 6.5 },  // 右外侧
  ];
  const blobs = allBlobs.slice(0, blobCount);

  // 树干梯形（上窄下宽，更像真实树干）
  const trunkTopW = 2.4 + tier * 0.5;
  const trunkBotW = trunkTopW + 1.6 + tier * 0.55;
  const trunkH = 6 + tier * 3.2;
  const trunkY = 32;
  const trunkBotY = trunkY + trunkH;

  return (
    <svg
      viewBox="0 0 60 60"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      {/* 地面投影 */}
      <ellipse cx="30" cy={trunkBotY + 1.5} rx="13" ry="1.6" fill="rgba(0,0,0,0.15)" />

      {/* 树干（梯形） */}
      <path
        d={`M${30 - trunkTopW / 2},${trunkY} L${30 + trunkTopW / 2},${trunkY} L${30 + trunkBotW / 2},${trunkBotY} L${30 - trunkBotW / 2},${trunkBotY} Z`}
        fill="#6B4423"
      />
      {/* 树皮纹路（3 条竖向暗线 + 1-2 条横向断纹） */}
      <line x1="28" y1={trunkY + 1} x2="28" y2={trunkBotY - 0.5} stroke="#3D2415" strokeWidth="0.35" opacity="0.7" />
      <line x1="30" y1={trunkY + 1} x2="30" y2={trunkBotY - 0.5} stroke="#3D2415" strokeWidth="0.5" opacity="0.85" />
      <line x1="32" y1={trunkY + 1} x2="32" y2={trunkBotY - 0.5} stroke="#3D2415" strokeWidth="0.35" opacity="0.7" />
      {tier >= 3 && (
        <>
          <line x1="27" y1={trunkY + trunkH * 0.45} x2="33" y2={trunkY + trunkH * 0.45} stroke="#3D2415" strokeWidth="0.3" opacity="0.5" />
          <line x1="27.5" y1={trunkY + trunkH * 0.7} x2="32.5" y2={trunkY + trunkH * 0.7} stroke="#3D2415" strokeWidth="0.3" opacity="0.5" />
        </>
      )}

      {/* 树枝（Y 形分叉，tier>=3 出现） */}
      {tier >= 3 && (
        <g stroke="#5C3818" strokeWidth="0.7" fill="none" strokeLinecap="round">
          <path d={`M30,${trunkY + trunkH * 0.45} L24,${trunkY + trunkH * 0.2} L21,${trunkY + trunkH * 0.12}`} />
          <path d={`M30,${trunkY + trunkH * 0.45} L36,${trunkY + trunkH * 0.2} L39,${trunkY + trunkH * 0.12}`} />
        </g>
      )}
      {tier >= 4 && (
        <g stroke="#5C3818" strokeWidth="0.6" fill="none" strokeLinecap="round">
          <path d={`M30,${trunkY + trunkH * 0.7} L22,${trunkY + trunkH * 0.55}`} />
          <path d={`M30,${trunkY + trunkH * 0.7} L38,${trunkY + trunkH * 0.55}`} />
        </g>
      )}

      {/* 树冠：多个不规则云朵叠加，每片略偏移 + 略透明（营造云层感） */}
      {blobs.map((b, i) => (
        <circle
          key={i}
          cx={b.cx}
          cy={b.cy}
          r={b.r}
          fill={accent}
          opacity={0.93 - i * 0.045}
        />
      ))}

      {/* 树冠高光（左上角小椭圆，体现阳光打在树上的反光） */}
      <ellipse cx="20" cy="16" rx="4" ry="2.2" fill="rgba(255,255,255,0.22)" />
      <ellipse cx="16" cy="22" rx="2" ry="1.2" fill="rgba(255,255,255,0.14)" />

      {/* 朋友森林：把首字母作为徽章浮在树冠上 */}
      {isFriends && badge && (
        <text
          x="30"
          y="32"
          textAnchor="middle"
          fill="white"
          fontSize="11"
          fontWeight="700"
          style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.4))" }}
        >
          {badge}
        </text>
      )}
    </svg>
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
  onItemDelete,
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
          {/* 中景山：连绵圆润 + 一座不对称多棱角山峰（次峰+主峰+小肩） */}
          <path
            d="M0,200 Q60,170 130,185 Q200,160 280,175 Q360,140 440,170 Q500,158 540,168 L555,148 L570,128 L585,112 L600,100 L615,118 L628,138 L640,160 L660,168 Q740,150 820,170 Q900,160 1000,175 L1000,220 L0,220 Z"
            fill={skin.swatch}
            opacity={0.22}
          />
          {/* 近山：圆润丘陵 + 两座不对称多棱角山峰（各有次峰、肩部、岩石碎裂感） */}
          <path
            d="M0,215 Q60,195 130,205 Q190,185 250,200 Q280,180 300,188 L315,160 L330,138 L345,118 L362,132 L378,150 L395,170 Q420,188 480,205 Q510,195 540,205 Q570,180 590,192 L605,158 L620,138 L635,118 L650,108 L665,128 L680,148 L695,168 Q720,188 770,205 Q800,195 850,205 Q920,195 1000,205 L1000,220 L0,220 Z"
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

        {/* 树木 */}
        {layout.map(({ item, x, y }, i) => (
          <ForestTree
            key={item.id}
            item={item}
            x={x}
            y={y}
            selected={item.id === selectedId}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            onDelete={onItemDelete ? () => onItemDelete(item.id) : undefined}
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
