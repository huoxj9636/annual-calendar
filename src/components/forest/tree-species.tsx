"use client";

import type { CSSProperties } from "react";

/**
 * 树木物种系统
 * 6 种树对应 6 种树形 + 5 种知识节点类型作为"果实/装饰"
 */

// ========= 物种元数据 =========
export const TREE_SPECIES = {
  oak: {
    id: "oak" as const,
    name: "樟树",
    desc: "阔叶常绿，枝叶茂密，是知识体系最稳的载体",
    color: "#4F6B3D",
    colorDeep: "#324A24",
    keywords: "稳重 · 厚积",
  },
  pine: {
    id: "pine" as const,
    name: "松树",
    desc: "针叶常青，挺拔高耸，适合需要长期积累的方向",
    color: "#3A6B4B",
    colorDeep: "#1F3F2C",
    keywords: "耐寒 · 高耸",
  },
  maple: {
    id: "maple" as const,
    name: "枫树",
    desc: "掌状叶，秋来火红，是灵感与创造力的源泉",
    color: "#B0563A",
    colorDeep: "#7A3722",
    keywords: "灵感 · 绚烂",
  },
  cherry: {
    id: "cherry" as const,
    name: "樱树",
    desc: "春日繁花，淡粉轻舞，适合审美与情感类知识",
    color: "#C97A92",
    colorDeep: "#9F5170",
    keywords: "美感 · 轻盈",
  },
  banyan: {
    id: "banyan" as const,
    name: "榕树",
    desc: "气根垂悬，独木成林，庞大而包容的体系",
    color: "#5C7340",
    colorDeep: "#3A4D24",
    keywords: "庞大 · 包容",
  },
  cypress: {
    id: "cypress" as const,
    name: "柏树",
    desc: "尖塔肃穆，适合结构严谨、逻辑分明的领域",
    color: "#46603A",
    colorDeep: "#2A3F22",
    keywords: "严谨 · 笔直",
  },
} as const;

export type TreeSpeciesId = keyof typeof TREE_SPECIES;

export const TREE_SPECIES_LIST: TreeSpeciesId[] = [
  "oak",
  "pine",
  "maple",
  "cherry",
  "banyan",
  "cypress",
];

/** 知识节点类型 → 视觉色（用于树上的"果实/装饰"） */
export const NODE_TYPE_TINT = {
  root: "#8B4513", // 树皮棕
  trunk: "#5C3818", // 深棕
  branch: "#5F8A45", // 枝绿
  leaf: "#9CC56B", // 嫩叶
  fruit: "#E07A4B", // 果实橙
} as const;

export type NodeTypeId = keyof typeof NODE_TYPE_TINT;

// ========= 单棵树形渲染 =========

type SpeciesTreeProps = {
  species: TreeSpeciesId;
  /** 0=空地 1=幼苗 2=小树 3=成树 4=参天 5=古木 */
  tier: number;
  /** 主色（由皮肤或物种决定） */
  accent: string;
  /** 深度色（树冠阴影） */
  accentDeep: string;
  /** 节点数 */
  count: number;
  /** 朋友徽章 */
  badge?: string;
  /** 是否好友森林 */
  isFriends?: boolean;
};

/** 单棵树（SVG，60×60 viewBox） */
export function SpeciesTree({
  species,
  tier,
  accent,
  accentDeep,
  count,
  badge,
  isFriends,
}: SpeciesTreeProps) {
  // 阶段遮罩：0=空地 1=幼苗 2=小树 3=成树 4=参天 5=古木
  const truncated = tier === 0;
  const tiny = tier <= 1;
  const small = tier === 2;
  const mature = tier === 3;
  const giant = tier === 4;
  const ancient = tier >= 5;

  // 朋友徽章放在树顶
  const BadgeLabel = badge && isFriends;

  return (
    <svg
      viewBox="0 0 60 60"
      width="100%"
      height="100%"
      style={{ overflow: "visible" }}
    >
      {/* 树影（地面投影） */}
      <ellipse
        cx="30"
        cy="58.5"
        rx={truncated ? 8 : 16 + tier * 1.5}
        ry="2"
        fill="rgba(0,0,0,0.14)"
      />

      {truncated ? (
        // 空地：一个小土堆 + 一根小枝
        <g>
          <ellipse cx="30" cy="56" rx="11" ry="3" fill="#7A6240" />
          <path
            d="M30 55 L30 47"
            stroke="#5C3818"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="30" cy="46" r="2" fill={accent} opacity="0.5" />
        </g>
      ) : (
        <SpeciesShape
          species={species}
          tier={tier}
          accent={accent}
          accentDeep={accentDeep}
          tiny={tiny}
          small={small}
          mature={mature}
          giant={giant}
          ancient={ancient}
          count={count}
        />
      )}

      {/* 朋友徽章（头顶小气泡） */}
      {BadgeLabel && (
        <g>
          <circle
            cx="30"
            cy={truncated ? 42 : species === "pine" || species === "cypress" ? 6 : 8}
            r="9"
            fill="#fff"
            stroke={accent}
            strokeWidth="1.2"
          />
          <text
            x="30"
            y={
              truncated
                ? 45
                : species === "pine" || species === "cypress"
                  ? 9.5
                  : 11.5
            }
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fill={accentDeep}
          >
            {badge}
          </text>
        </g>
      )}
    </svg>
  );
}

/** 树形主绘制 */
function SpeciesShape({
  species,
  tier,
  accent,
  accentDeep,
  tiny,
  small,
  mature,
  giant,
  ancient,
  count,
}: Omit<SpeciesTreeProps, "badge" | "isFriends"> & {
  tiny: boolean;
  small: boolean;
  mature: boolean;
  giant: boolean;
  ancient: boolean;
}) {
  // 不同物种分支
  switch (species) {
    case "oak":
      return (
        <OakShape
          tier={tier}
          accent={accent}
          accentDeep={accentDeep}
          tiny={tiny}
          small={small}
          mature={mature}
          giant={giant}
          ancient={ancient}
          count={count}
        />
      );
    case "pine":
      return (
        <PineShape
          tier={tier}
          accent={accent}
          accentDeep={accentDeep}
          tiny={tiny}
          small={small}
          mature={mature}
          giant={giant}
          ancient={ancient}
          count={count}
        />
      );
    case "maple":
      return (
        <MapleShape
          tier={tier}
          accent={accent}
          accentDeep={accentDeep}
          tiny={tiny}
          small={small}
          mature={mature}
          giant={giant}
          ancient={ancient}
          count={count}
        />
      );
    case "cherry":
      return (
        <CherryShape
          tier={tier}
          accent={accent}
          accentDeep={accentDeep}
          tiny={tiny}
          small={small}
          mature={mature}
          giant={giant}
          ancient={ancient}
          count={count}
        />
      );
    case "banyan":
      return (
        <BanyanShape
          tier={tier}
          accent={accent}
          accentDeep={accentDeep}
          tiny={tiny}
          small={small}
          mature={mature}
          giant={giant}
          ancient={ancient}
          count={count}
        />
      );
    case "cypress":
      return (
        <CypressShape
          tier={tier}
          accent={accent}
          accentDeep={accentDeep}
          tiny={tiny}
          small={small}
          mature={mature}
          giant={giant}
          ancient={ancient}
          count={count}
        />
      );
  }
}

// ============== 樟树（阔叶圆形 + 多分叉） ==============
function OakShape({
  tier,
  accent,
  accentDeep,
  tiny,
  small,
  mature,
  giant,
  ancient,
  count,
}: {
  tier: number;
  accent: string;
  accentDeep: string;
  tiny: boolean;
  small: boolean;
  mature: boolean;
  giant: boolean;
  ancient: boolean;
  count: number;
}) {
  // 基础尺寸：最低成树（tier 3），不再随节点缩减
  const sizeTier = Math.max(tier, 3);
  // 树干：基础大尺寸，固定不再随节点缩减（sizeTier 已 shadow tier）
  const trunkH = 8 + sizeTier * 2.2;
  const trunkW = 3 + sizeTier * 0.6;
  const crownY = 32 - trunkH;
  const crownSize = 10 + sizeTier * 2.4;

  // 树冠 blob 数
  const blobs: Array<[number, number, number]> = [
    [30, crownY, crownSize],
    [20, crownY + 2, crownSize * 0.78],
    [40, crownY + 2, crownSize * 0.78],
    [25, crownY + 5, crownSize * 0.7],
    [35, crownY + 5, crownSize * 0.7],
  ];
  // 古木多一个底冠
  if (ancient) {
    blobs.push([30, crownY + 8, crownSize * 0.6]);
  }

  return (
    <g>
      {/* 树干（梯形） */}
      <path
        d={`M${30 - trunkW / 2 - 0.5},32 L${30 + trunkW / 2 + 0.5},32 L${30 + trunkW / 2 + 1.5},${32 + trunkH} L${30 - trunkW / 2 - 1.5},${32 + trunkH} Z`}
        fill="#6B4423"
      />
      {/* 树皮纹路 */}
      <line
        x1={30 - trunkW * 0.25}
        y1="33"
        x2={30 - trunkW * 0.25}
        y2={32 + trunkH - 0.5}
        stroke="#3D2415"
        strokeWidth="0.5"
        opacity="0.7"
      />
      <line
        x1={30 + trunkW * 0.2}
        y1="33"
        x2={30 + trunkW * 0.2}
        y2={32 + trunkH - 0.5}
        stroke="#3D2415"
        strokeWidth="0.4"
        opacity="0.6"
      />
      {/* 主分叉（成树及以上） */}
      {mature && (
        <g
          fill="none"
          stroke="#5C3818"
          strokeWidth={ancient ? 1 : 0.8}
          strokeLinecap="round"
        >
          <path d={`M30,${32 + trunkH * 0.4} L${24 - sizeTier * 0.4},${crownY + 4}`} />
          <path d={`M30,${32 + trunkH * 0.4} L${36 + sizeTier * 0.4},${crownY + 4}`} />
          {giant && (
            <path
              d={`M30,${32 + trunkH * 0.5} L${30 - sizeTier * 0.6},${crownY + 6}`}
            />
          )}
        </g>
      )}
      {/* 树冠（云朵 blob 叠加） */}
      {blobs.map(([cx, cy, r], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill={i === 0 ? accent : accentDeep}
          opacity={0.88 - i * 0.05}
        />
      ))}
      {/* 树冠高光 */}
      <ellipse
        cx={crownY > 20 ? 22 : 22}
        cy={crownY + 2}
        rx={crownSize * 0.32}
        ry={crownSize * 0.18}
        fill="rgba(255,255,255,0.18)"
      />
    </g>
  );
}

// ============== 松树（尖塔层叠） ==============
function PineShape({
  tier,
  accent,
  accentDeep,
  tiny,
  small,
  mature,
  giant,
  ancient,
  count,
}: {
  tier: number;
  accent: string;
  accentDeep: string;
  tiny: boolean;
  small: boolean;
  mature: boolean;
  giant: boolean;
  ancient: boolean;
  count: number;
}) {
  // 基础尺寸：固定成树大小（不再随节点缩减）
  const sizeTier = Math.max(tier, 3);
  // 树干
  const trunkH = 6 + sizeTier * 1.4;
  const trunkW = 2.2 + sizeTier * 0.3;
  // 树冠：每层三角形叠加
  const layers = Math.max(2, Math.min(tier, 5));

  // 每层三角
  const segmentH = (52 - trunkH) / layers;
  const baseW = 8 + sizeTier * 1.6;

  return (
    <g>
      {/* 主干 */}
      <rect
        x={30 - trunkW / 2}
        y={32}
        width={trunkW}
        height={trunkH}
        fill="#5C3818"
      />
      {/* 树皮纹路 */}
      {mature && (
        <line
          x1={30 - trunkW * 0.15}
          y1="33"
          x2={30 - trunkW * 0.15}
          y2={32 + trunkH - 0.5}
          stroke="#3D2415"
          strokeWidth="0.3"
          opacity="0.5"
        />
      )}
      {/* 针叶层（每层一个梯形三角） */}
      {Array.from({ length: layers }).map((_, i) => {
        const yTop = 32 - (i + 1) * segmentH + segmentH * 0.3;
        const yBot = 32 - i * segmentH + segmentH * 0.5;
        const w = baseW * (1 - i / (layers + 1));
        return (
          <path
            key={i}
            d={`M30,${yTop} L${30 - w / 2},${yBot} L${30 + w / 2},${yBot} Z`}
            fill={i % 2 === 0 ? accent : accentDeep}
            opacity={0.92 - i * 0.04}
          />
        );
      })}
      {/* 顶层高亮 */}
      <path
        d={`M30,${32 - layers * segmentH + segmentH * 0.3} L${30 - baseW * 0.18},${32 - (layers - 1) * segmentH + segmentH * 0.5}`}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.6"
        fill="none"
      />
      {/* 古木加雪花点 */}
      {ancient && (
        <g opacity="0.7">
          <circle cx="22" cy="14" r="0.7" fill="#fff" />
          <circle cx="36" cy="18" r="0.6" fill="#fff" />
          <circle cx="28" cy="22" r="0.7" fill="#fff" />
        </g>
      )}
    </g>
  );
}

// ============== 枫树（球形 + 掌状叶） ==============
function MapleShape({
  tier,
  accent,
  accentDeep,
  tiny,
  small,
  mature,
  giant,
  ancient,
  count,
}: {
  tier: number;
  accent: string;
  accentDeep: string;
  tiny: boolean;
  small: boolean;
  mature: boolean;
  giant: boolean;
  ancient: boolean;
  count: number;
}) {
  // 基础尺寸：固定成树大小（不再随节点缩减）
  const sizeTier = Math.max(tier, 3);
  const trunkH = 6 + sizeTier * 1.6;
  const trunkW = 2.4 + sizeTier * 0.4;
  const crownY = 32 - trunkH;
  const crownR = 9 + sizeTier * 2.2;

  // 掌状叶 path（5 瓣）
  const MapleLeaf = ({ x, y, r, rot }: { x: number; y: number; r: number; rot: number }) => (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path
        d={`M0,${-r} L${r * 0.3},${-r * 0.3} L${r * 0.95},${-r * 0.45} L${r * 0.55},${r * 0.1} L${r * 0.75},${r * 0.6} L0,${r * 0.4} L${-r * 0.75},${r * 0.6} L${-r * 0.55},${r * 0.1} L${-r * 0.95},${-r * 0.45} L${-r * 0.3},${-r * 0.3} Z`}
        fill={accent}
        opacity="0.85"
      />
    </g>
  );

  return (
    <g>
      {/* 树干 */}
      <rect
        x={30 - trunkW / 2}
        y={32}
        width={trunkW}
        height={trunkH}
        fill="#6B4423"
      />
      {mature && (
        <g
          fill="none"
          stroke="#5C3818"
          strokeWidth="0.7"
          strokeLinecap="round"
        >
          <path d={`M30,${32 + trunkH * 0.5} L${26},${crownY + 3}`} />
          <path d={`M30,${32 + trunkH * 0.5} L${34},${crownY + 3}`} />
        </g>
      )}
      {/* 球形树冠 */}
      <circle cx={30} cy={crownY + 1} r={crownR} fill={accent} opacity="0.88" />
      <circle cx={22} cy={crownY + 3} r={crownR * 0.7} fill={accent} opacity="0.85" />
      <circle cx={38} cy={crownY + 3} r={crownR * 0.7} fill={accent} opacity="0.85" />
      <circle cx={30} cy={crownY - 3} r={crownR * 0.65} fill={accentDeep} opacity="0.7" />
      {/* 树冠上的掌状叶点缀（成树及以上） */}
      {mature && (
        <g>
          <MapleLeaf x={24} y={crownY - 2} r={3 + sizeTier * 0.3} rot={-15} />
          <MapleLeaf x={36} y={crownY - 1} r={3 + sizeTier * 0.3} rot={20} />
          <MapleLeaf x={30} y={crownY + 4} r={2.6 + sizeTier * 0.25} rot={170} />
        </g>
      )}
      {giant && (
        <MapleLeaf
          x={20}
          y={crownY + 5}
          r={2.6 + sizeTier * 0.2}
          rot={-30}
        />
      )}
      {ancient && (
        <MapleLeaf
          x={40}
          y={crownY + 5}
          r={2.6 + sizeTier * 0.2}
          rot={45}
        />
      )}
    </g>
  );
}

// ============== 樱树（稀疏分叉 + 花簇） ==============
function CherryShape({
  tier,
  accent,
  accentDeep,
  tiny,
  small,
  mature,
  giant,
  ancient,
  count,
}: {
  tier: number;
  accent: string;
  accentDeep: string;
  tiny: boolean;
  small: boolean;
  mature: boolean;
  giant: boolean;
  ancient: boolean;
  count: number;
}) {
  // 基础尺寸：固定成树大小（不再随节点缩减）
  const sizeTier = Math.max(tier, 3);
  const trunkH = 10 + sizeTier * 1.4;
  const trunkW = 1.6 + sizeTier * 0.3;
  const crownY = 32 - trunkH;

  // 花瓣（五瓣樱花）
  const Flower = ({ x, y, r, opacity = 0.9 }: { x: number; y: number; r: number; opacity?: number }) => (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx={0}
          cy={-r * 0.55}
          rx={r * 0.4}
          ry={r * 0.6}
          transform={`rotate(${a})`}
          fill={accent}
        />
      ))}
      <circle cx={0} cy={0} r={r * 0.22} fill="#FFE5A8" />
    </g>
  );

  return (
    <g>
      {/* 主干（细长） */}
      <path
        d={`M${30 - trunkW / 2},32 L${30 + trunkW / 2},32 L${30 + trunkW / 2 + 0.5},${32 + trunkH} L${30 - trunkW / 2 - 0.5},${32 + trunkH} Z`}
        fill="#5C3818"
      />
      {/* 多分叉 Y 形（成树开始） */}
      {mature && (
        <g
          fill="none"
          stroke="#5C3818"
          strokeWidth={ancient ? 1 : 0.8}
          strokeLinecap="round"
        >
          <path d={`M30,${32 + trunkH * 0.35} L${24 - sizeTier * 0.3},${crownY + 6}`} />
          <path d={`M30,${32 + trunkH * 0.35} L${36 + sizeTier * 0.3},${crownY + 6}`} />
          <path d={`M30,${32 + trunkH * 0.5} L${30 - sizeTier * 0.4},${crownY + 3}`} />
          <path d={`M30,${32 + trunkH * 0.5} L${30 + sizeTier * 0.4},${crownY + 3}`} />
        </g>
      )}
      {/* 小树冠（稀疏） */}
      <g>
        <circle cx={26} cy={crownY + 5} r={crownY > 20 ? 6 + sizeTier * 0.5 : 4 + sizeTier * 0.4} fill={accent} opacity="0.55" />
        <circle cx={34} cy={crownY + 5} r={crownY > 20 ? 6 + sizeTier * 0.5 : 4 + sizeTier * 0.4} fill={accent} opacity="0.55" />
        <circle cx={30} cy={crownY + 2} r={5 + sizeTier * 0.5} fill={accent} opacity="0.6" />
      </g>
      {/* 花簇（成树开始） */}
      {mature && (
        <g>
          <Flower x={24} y={crownY + 3} r={2.4} />
          <Flower x={32} y={crownY + 6} r={2.2} opacity={0.85} />
          <Flower x={36} y={crownY + 2} r={2.0} opacity={0.8} />
        </g>
      )}
      {giant && (
        <Flower x={20} y={crownY + 7} r={2.4} opacity={0.9} />
      )}
      {ancient && (
        <g>
          <Flower x={40} y={crownY + 4} r={2.2} opacity={0.9} />
          <Flower x={30} y={crownY} r={2.0} opacity={0.85} />
        </g>
      )}
    </g>
  );
}

// ============== 榕树（独木成林 + 气根） ==============
function BanyanShape({
  tier,
  accent,
  accentDeep,
  tiny,
  small,
  mature,
  giant,
  ancient,
  count,
}: {
  tier: number;
  accent: string;
  accentDeep: string;
  tiny: boolean;
  small: boolean;
  mature: boolean;
  giant: boolean;
  ancient: boolean;
  count: number;
}) {
  // 基础尺寸：固定成树大小（不再随节点缩减）
  const sizeTier = Math.max(tier, 3);
  const trunkH = 8 + sizeTier * 1.5;
  const trunkW = 4 + sizeTier * 0.7; // 粗干
  const crownY = 32 - trunkH;
  const crownR = 12 + sizeTier * 2.6; // 超大树冠

  // 气根（成树起多根）
  const roots: Array<[number, number, number]> = mature
    ? [
        [22, crownY + 2, 8],
        [38, crownY + 2, 8],
        [26, crownY + 3, 10],
        [34, crownY + 3, 10],
      ]
    : [];
  if (giant) {
    roots.push([18, crownY + 3, 11], [42, crownY + 3, 11]);
  }

  return (
    <g>
      {/* 主干（粗壮） */}
      <path
        d={`M${30 - trunkW / 2 - 0.5},32 L${30 + trunkW / 2 + 0.5},32 L${30 + trunkW / 2 + 2},${32 + trunkH} L${30 - trunkW / 2 - 2},${32 + trunkH} Z`}
        fill="#5C3818"
      />
      {/* 树皮裂纹（深） */}
      <line
        x1={30 - trunkW * 0.15}
        y1="33"
        x2={30 - trunkW * 0.15}
        y2={32 + trunkH - 0.5}
        stroke="#2D1A0A"
        strokeWidth="0.6"
        opacity="0.7"
      />
      <line
        x1={30 + trunkW * 0.1}
        y1="33"
        x2={30 + trunkW * 0.15}
        y2={32 + trunkH - 0.5}
        stroke="#2D1A0A"
        strokeWidth="0.5"
        opacity="0.6"
      />
      <line
        x1={30 - trunkW * 0.35}
        y1="36"
        x2={30 - trunkW * 0.3}
        y2={32 + trunkH - 0.5}
        stroke="#2D1A0A"
        strokeWidth="0.4"
        opacity="0.5"
      />
      {/* 气根（从树冠垂下到树干） */}
      {roots.map(([x, yTop, h], i) => (
        <path
          key={i}
          d={`M${x},${yTop} Q${x - 1 + (i % 2) * 2},${yTop + h * 0.5} ${x + (i % 2 === 0 ? -0.5 : 0.5)},${yTop + h}`}
          stroke="#5C3818"
          strokeWidth={ancient ? 1 : 0.7}
          fill="none"
          opacity="0.7"
        />
      ))}
      {/* 大伞形树冠（多层） */}
      <ellipse cx={30} cy={crownY + 3} rx={crownR} ry={crownR * 0.78} fill={accent} opacity="0.86" />
      <ellipse cx={22} cy={crownY + 1} rx={crownR * 0.6} ry={crownR * 0.55} fill={accent} opacity="0.85" />
      <ellipse cx={38} cy={crownY + 1} rx={crownR * 0.6} ry={crownR * 0.55} fill={accent} opacity="0.85" />
      <ellipse cx={30} cy={crownY - 2} rx={crownR * 0.65} ry={crownR * 0.45} fill={accentDeep} opacity="0.65" />
      {/* 树冠高光 */}
      <ellipse cx={22} cy={crownY + 1} rx={crownR * 0.25} ry={crownR * 0.12} fill="rgba(255,255,255,0.2)" />
    </g>
  );
}

// ============== 柏树（尖塔肃穆） ==============
function CypressShape({
  tier,
  accent,
  accentDeep,
  tiny,
  small,
  mature,
  giant,
  ancient,
  count,
}: {
  tier: number;
  accent: string;
  accentDeep: string;
  tiny: boolean;
  small: boolean;
  mature: boolean;
  giant: boolean;
  ancient: boolean;
  count: number;
}) {
  // 基础尺寸：固定成树大小（不再随节点缩减）
  const sizeTier = Math.max(tier, 3);
  const trunkH = 5 + sizeTier * 1;
  const trunkW = 1.8 + sizeTier * 0.25;
  // 整体高度
  const totalH = 28 + sizeTier * 2;
  const baseW = 5 + sizeTier * 0.9;
  const tip = 32 - totalH;

  return (
    <g>
      {/* 主干 */}
      <rect
        x={30 - trunkW / 2}
        y={32}
        width={trunkW}
        height={trunkH}
        fill="#5C3818"
      />
      {/* 尖塔形（细长三角形，略带圆角） */}
      <path
        d={`M30,${tip + 1} 
            Q${30 - baseW * 0.05},${(tip + 32) * 0.3} ${30 - baseW / 2},${32 - 1} 
            L${30 + baseW / 2},${32 - 1} 
            Q${30 + baseW * 0.05},${(tip + 32) * 0.3} ${30},${tip + 1} Z`}
        fill={accent}
        opacity="0.88"
      />
      {/* 内部纹理（细竖线） */}
      {mature && (
        <g stroke={accentDeep} strokeWidth="0.3" opacity="0.4" fill="none">
          <line x1="30" y1={tip + 4} x2="30" y2="32" />
          <line x1={30 - 1} y1={tip + 8} x2={30 - 2.5} y2="32" />
          <line x1={30 + 1} y1={tip + 8} x2={30 + 2.5} y2="32" />
        </g>
      )}
      {/* 高光边 */}
      <path
        d={`M30,${tip + 1} L${30 - baseW * 0.15},${(tip + 32) * 0.5} L${30 - baseW / 2},31`}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.6"
        fill="none"
      />
    </g>
  );
}


// ============== 物种选择预览（用于 Modal） ==============
export function SpeciesPreview({
  species,
  className,
  style,
}: {
  species: TreeSpeciesId;
  className?: string;
  style?: CSSProperties;
}) {
  const info = TREE_SPECIES[species];
  return (
    <div
      className={className}
      style={{
        width: 90,
        height: 120,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        ...style,
      }}
    >
      <SpeciesTree
        species={species}
        tier={3}
        accent={info.color}
        accentDeep={info.colorDeep}
        count={8}
      />
    </div>
  );
}
