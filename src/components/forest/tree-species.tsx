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
  /** 是否有果实（根据知识节点是否有 fruit 类型） */
  hasFruit?: boolean;
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
  hasFruit,
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
      {/* 草地投影：固定尺寸，不随树阶段变化 */}
      <ellipse cx="30" cy="58.5" rx="14" ry="2" fill="rgba(0,0,0,0.14)" />

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
          hasFruit={hasFruit}
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
  hasFruit,
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
          hasFruit={hasFruit}
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
          hasFruit={hasFruit}
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
          hasFruit={hasFruit}
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
          hasFruit={hasFruit}
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
          hasFruit={hasFruit}
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
          hasFruit={hasFruit}
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
  hasFruit,
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
  hasFruit?: boolean;
}) {
  // 基础尺寸：最低成树（tier 3），不再随节点缩减
  const sizeTier = Math.max(tier, 3);
  // 树干：基础大尺寸，固定不再随节点缩减（sizeTier 已 shadow tier）
  const trunkH = 8 + sizeTier * 2.2;
  const trunkW = 3 + sizeTier * 0.6;
  const crownY = 32 - trunkH;
  const crownSize = 10 + sizeTier * 2.4;

  // 树冠轮廓（用 cubic Bézier 绘制不规则自然云朵）
  // crownY 是树冠顶部 y 坐标，crownSize 是中心半径
  const top = crownY;
  const baseY = crownY + crownSize * 0.95; // 树冠底部
  const cx = 30;
  const cs = crownSize;
  // 自然起伏的伞形云朵轮廓，底部有凸起/凹陷
  const canopyPath = `
    M ${cx - cs * 0.95},${top + cs * 0.4}
    C ${cx - cs * 1.05},${top - cs * 0.1} ${cx - cs * 0.7},${top - cs * 0.5} ${cx - cs * 0.35},${top - cs * 0.35}
    C ${cx - cs * 0.25},${top - cs * 0.85} ${cx + cs * 0.05},${top - cs * 0.95} ${cx + cs * 0.2},${top - cs * 0.55}
    C ${cx + cs * 0.45},${top - cs * 0.85} ${cx + cs * 0.8},${top - cs * 0.6} ${cx + cs * 0.85},${top - cs * 0.15}
    C ${cx + cs * 1.1},${top + cs * 0.1} ${cx + cs * 1.0},${top + cs * 0.55} ${cx + cs * 0.75},${top + cs * 0.6}
    C ${cx + cs * 0.65},${top + cs * 0.85} ${cx + cs * 0.35},${top + cs * 0.8} ${cx + cs * 0.15},${top + cs * 0.7}
    C ${cx - cs * 0.1},${top + cs * 0.9} ${cx - cs * 0.45},${top + cs * 0.85} ${cx - cs * 0.6},${top + cs * 0.65}
    C ${cx - cs * 0.85},${top + cs * 0.7} ${cx - cs * 1.0},${top + cs * 0.55} ${cx - cs * 0.95},${top + cs * 0.4}
    Z`.replace(/\s+/g, " ").trim();

  // 树冠内的层次色块（深→浅，模拟叶簇的明暗）
  const innerBlobs: Array<[number, number, number, string, number]> = [
    [cx - cs * 0.45, top + cs * 0.0, cs * 0.55, accent, 0.95],
    [cx + cs * 0.4, top + cs * 0.05, cs * 0.5, accent, 0.85],
    [cx - cs * 0.15, top + cs * 0.35, cs * 0.45, accentDeep, 0.7],
    [cx + cs * 0.55, top + cs * 0.35, cs * 0.32, accentDeep, 0.75],
    [cx - cs * 0.55, top + cs * 0.4, cs * 0.3, accentDeep, 0.7],
    [cx + cs * 0.05, top + cs * 0.55, cs * 0.28, accentDeep, 0.65],
  ];
  if (ancient) {
    innerBlobs.push([cx - cs * 0.3, top + cs * 0.7, cs * 0.32, accentDeep, 0.6]);
    innerBlobs.push([cx + cs * 0.35, top + cs * 0.7, cs * 0.3, accentDeep, 0.6]);
  }

  // 树干（略带弯曲的锥形，自然不绝对对称）
  const trunkBaseL = 30 - trunkW * 0.6;
  const trunkBaseR = 30 + trunkW * 0.6;
  const trunkTopL = 30 - trunkW / 2;
  const trunkTopR = 30 + trunkW / 2;
  // 树干中段轻微弯曲
  const midL = trunkBaseL + 0.6;
  const midR = trunkBaseR - 0.6;
  const trunkPath = `
    M ${trunkTopL},32
    C ${trunkTopL - 0.3},${32 + trunkH * 0.4} ${midL + 0.5},${32 + trunkH * 0.6} ${trunkBaseL - 0.8},${32 + trunkH}
    L ${trunkBaseR + 0.8},${32 + trunkH}
    C ${midR - 0.5},${32 + trunkH * 0.6} ${trunkTopR + 0.3},${32 + trunkH * 0.4} ${trunkTopR},32
    Z`.replace(/\s+/g, " ").trim();

  return (
    <g>
      {/* 树干 */}
      <path d={trunkPath} fill="#6B4423" />
      {/* 树皮纹路（多条不规则竖线） */}
      <g stroke="#3D2415" strokeLinecap="round" opacity="0.55">
        <line x1={trunkBaseL + 1.2} y1={33} x2={trunkBaseL + 1.0} y2={32 + trunkH - 0.5} strokeWidth="0.5" />
        <line x1={30 - trunkW * 0.2} y1={33} x2={30 - trunkW * 0.25} y2={32 + trunkH - 0.5} strokeWidth="0.45" />
        <line x1={30 + trunkW * 0.15} y1={33} x2={30 + trunkW * 0.18} y2={32 + trunkH - 0.5} strokeWidth="0.5" />
        <line x1={trunkBaseR - 1.0} y1={33} x2={trunkBaseR - 1.2} y2={32 + trunkH - 0.5} strokeWidth="0.4" />
      </g>
      {/* 根部的小土堆 */}
      <ellipse cx="30" cy={32 + trunkH + 0.3} rx={trunkW * 0.95} ry="0.8" fill="#5C3818" opacity="0.4" />
      {/* 主分叉（成树及以上） */}
      {mature && (
        <g fill="none" stroke="#5C3818" strokeWidth={ancient ? 1.0 : 0.7} strokeLinecap="round" opacity="0.85">
          <path d={`M30,${32 + trunkH * 0.45} Q${24},${32 + trunkH * 0.2} ${20 - sizeTier * 0.2},${crownY + cs * 0.4}`} />
          <path d={`M30,${32 + trunkH * 0.45} Q${36},${32 + trunkH * 0.2} ${40 + sizeTier * 0.2},${crownY + cs * 0.4}`} />
          {giant && (
            <path d={`M30,${32 + trunkH * 0.5} Q${30 - 1},${32 + trunkH * 0.1} ${28},${crownY + cs * 0.15}`} />
          )}
        </g>
      )}
      {/* 树冠轮廓 */}
      <path d={canopyPath} fill={accent} />
      {/* 树冠内层叶簇（深浅叠加） */}
      {innerBlobs.map(([bx, by, br, color, op], i) => (
        <circle key={i} cx={bx} cy={by} r={br} fill={color} opacity={op} />
      ))}
      {/* 树冠高光（左上受光） */}
      <ellipse
        cx={cx - cs * 0.35}
        cy={top + cs * 0.05}
        rx={cs * 0.32}
        ry={cs * 0.18}
        fill="rgba(255,255,255,0.18)"
      />
      {/* 古木：垂挂藤蔓 */}
      {ancient && (
        <g fill="none" stroke={accentDeep} strokeWidth="0.5" opacity="0.6">
          <path d={`M${cx - cs * 0.4},${baseY} Q${cx - cs * 0.5},${baseY + cs * 0.25} ${cx - cs * 0.45},${baseY + cs * 0.45}`} />
          <path d={`M${cx + cs * 0.3},${baseY - cs * 0.05} Q${cx + cs * 0.35},${baseY + cs * 0.2} ${cx + cs * 0.25},${baseY + cs * 0.4}`} />
        </g>
      )}
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
  hasFruit,
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
  hasFruit?: boolean;
}) {
  // 基础尺寸：固定成树大小（不再随节点缩减）
  const sizeTier = Math.max(tier, 3);
  // 树干：笔直修长
  const trunkH = 6 + sizeTier * 1.2;
  const trunkW = 2.0 + sizeTier * 0.25;
  // 树冠：层叠三角（圣诞树式），清晰、挺拔
  const layers = Math.max(2, Math.min(tier, 5));
  const baseW = 9 + sizeTier * 1.4; // 底层宽度
  const topW = baseW * 0.18;        // 顶层宽度
  const trunkTopY = 32;
  const treeTopY = trunkTopY - trunkH - 1; // 顶层尖端
  const segH = (trunkTopY - treeTopY) / layers;

  // 三角形针叶层（圣诞树风），底部平直，顶部收尖，整体圆润不锐利
  const NeedleLayer = ({
    yTop,
    yBot,
    wBot,
    wTop,
    color,
    op,
  }: {
    yTop: number;
    yBot: number;
    wBot: number;
    wTop: number;
    color: string;
    op: number;
  }) => {
    // 四个角轻微圆滑：从中心向四角各给一点弧度
    const cxL_bot = 30 - wBot / 2;
    const cxR_bot = 30 + wBot / 2;
    const cxL_top = 30 - wTop / 2;
    const cxR_top = 30 + wTop / 2;
    const r = Math.min(0.8, (wBot - wTop) * 0.18); // 圆角半径
    return (
      <path
        d={`M${30},${yTop}
            Q${cxR_top + r * 0.4},${yTop + r * 0.6} ${cxR_top + 0.3},${(yTop + yBot) * 0.5}
            Q${cxR_bot - r * 0.4},${yBot - r * 0.6} ${cxR_bot},${yBot}
            L${cxL_bot},${yBot}
            Q${cxL_bot + r * 0.4},${yBot - r * 0.6} ${cxL_top - 0.3},${(yTop + yBot) * 0.5}
            Q${cxL_top - r * 0.4},${yTop + r * 0.6} ${30},${yTop} Z`}
        fill={color}
        opacity={op}
      />
    );
  };

  // 树干（笔直）
  const trunkPath = `
    M ${30 - trunkW / 2},${trunkTopY}
    L ${30 + trunkW / 2},${trunkTopY}
    L ${30 + trunkW / 2 + 0.3},${trunkTopY + trunkH}
    L ${30 - trunkW / 2 - 0.3},${trunkTopY + trunkH}
    Z`.replace(/\s+/g, " ").trim();

  // 计算每层参数
  const layerInfo = Array.from({ length: layers }).map((_, i) => {
    const t = i / Math.max(layers - 1, 1);
    const yBot = trunkTopY - i * segH;     // 该层底部 y
    const yTop = trunkTopY - (i + 1) * segH + segH * 0.18; // 该层顶部 y（向上收）
    const wBot = baseW * (1 - t * 0.35);
    const wTop = Math.max(topW, wBot * 0.18);
    return { yTop, yBot, wBot, wTop };
  });

  return (
    <g>
      {/* 树干 */}
      <path d={trunkPath} fill="#5C3818" />
      {/* 树干中央高光线（增加立体感） */}
      <line
        x1={30}
        y1={trunkTopY + 0.5}
        x2={30}
        y2={trunkTopY + trunkH - 0.5}
        stroke="#7A5230"
        strokeWidth="0.35"
        opacity="0.6"
      />
      {/* 根部土堆 */}
      <ellipse cx="30" cy={trunkTopY + trunkH + 0.3} rx={trunkW * 0.9} ry="0.7" fill="#5C3818" opacity="0.4" />
      {/* 针叶层叠：底层深 + 顶层亮，层与层之间错位（上层稍微下移覆盖下层） */}
      {layerInfo.map((info, i) => {
        const { yTop, yBot, wBot, wTop } = info;
        return (
          <g key={i}>
            {/* 主层（深色） */}
            <NeedleLayer
              yTop={yTop}
              yBot={yBot}
              wBot={wBot}
              wTop={wTop}
              color={i === 0 ? accentDeep : accent}
              op={0.95 - i * 0.03}
            />
            {/* 上层向下一层底部延伸一点，形成层叠错位感 */}
            {i > 0 && (
              <NeedleLayer
                yTop={yTop + segH * 0.18}
                yBot={yBot + segH * 0.18}
                wBot={wBot * 0.95}
                wTop={wTop * 0.9}
                color={accentDeep}
                op={0.35}
              />
            )}
          </g>
        );
      })}
      {/* 顶尖小星形装饰（雪松/圣诞树风） */}
      <circle cx="30" cy={treeTopY - 0.5} r="0.9" fill={accent} opacity="0.9" />
      {/* 古木加一点深色斑驳 */}
      {ancient && (
        <g opacity="0.4">
          <ellipse cx="24" cy={treeTopY + segH * 1.2} rx="0.9" ry="0.5" fill={accentDeep} />
          <ellipse cx="36" cy={treeTopY + segH * 2.4} rx="0.8" ry="0.45" fill={accentDeep} />
          <ellipse cx={30 + trunkW * 0.45} cy={trunkTopY + trunkH * 0.45} rx="0.6" ry="0.4" fill="#3D2415" />
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
  hasFruit,
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
  hasFruit?: boolean;
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

  // 树冠轮廓：不规则云朵（多个凸起，底部起伏）
  const top = crownY;
  const cs = crownR;
  const canopyPath = `
    M ${30 - cs * 0.95},${top + cs * 0.35}
    C ${30 - cs * 1.05},${top - cs * 0.1} ${30 - cs * 0.7},${top - cs * 0.55} ${30 - cs * 0.3},${top - cs * 0.4}
    C ${30 - cs * 0.15},${top - cs * 0.85} ${30 + cs * 0.1},${top - cs * 0.95} ${30 + cs * 0.25},${top - cs * 0.5}
    C ${30 + cs * 0.5},${top - cs * 0.8} ${30 + cs * 0.85},${top - cs * 0.5} ${30 + cs * 0.95},${top - cs * 0.1}
    C ${30 + cs * 1.1},${top + cs * 0.15} ${30 + cs * 1.0},${top + cs * 0.55} ${30 + cs * 0.75},${top + cs * 0.65}
    C ${30 + cs * 0.6},${top + cs * 0.9} ${30 + cs * 0.3},${top + cs * 0.85} ${30 + cs * 0.15},${top + cs * 0.75}
    C ${30 - cs * 0.1},${top + cs * 0.95} ${30 - cs * 0.45},${top + cs * 0.85} ${30 - cs * 0.6},${top + cs * 0.65}
    C ${30 - cs * 0.9},${top + cs * 0.65} ${30 - cs * 1.05},${top + cs * 0.5} ${30 - cs * 0.95},${top + cs * 0.35}
    Z`.replace(/\s+/g, " ").trim();

  // 树干（弯曲 + 树皮）
  const trunkBaseL = 30 - trunkW * 0.6;
  const trunkBaseR = 30 + trunkW * 0.6;
  const trunkTopL = 30 - trunkW / 2;
  const trunkTopR = 30 + trunkW / 2;
  const trunkPath = `
    M ${trunkTopL},32
    C ${trunkTopL - 0.3},${32 + trunkH * 0.4} ${trunkBaseL + 0.5},${32 + trunkH * 0.65} ${trunkBaseL - 0.6},${32 + trunkH}
    L ${trunkBaseR + 0.6},${32 + trunkH}
    C ${trunkBaseR - 0.5},${32 + trunkH * 0.65} ${trunkTopR + 0.3},${32 + trunkH * 0.4} ${trunkTopR},32
    Z`.replace(/\s+/g, " ").trim();

  return (
    <g>
      {/* 树干 */}
      <path d={trunkPath} fill="#6B4423" />
      <g stroke="#3D2415" strokeLinecap="round" opacity="0.5">
        <line x1={trunkBaseL + 0.8} y1={33} x2={trunkBaseL + 0.6} y2={32 + trunkH - 0.5} strokeWidth="0.4" />
        <line x1={30} y1={33} x2={30} y2={32 + trunkH - 0.5} strokeWidth="0.5" />
        <line x1={trunkBaseR - 0.6} y1={33} x2={trunkBaseR - 0.8} y2={32 + trunkH - 0.5} strokeWidth="0.4" />
      </g>
      <ellipse cx="30" cy={32 + trunkH + 0.3} rx={trunkW * 0.9} ry="0.7" fill="#5C3818" opacity="0.4" />
      {/* 主分叉 */}
      {mature && (
        <g fill="none" stroke="#5C3818" strokeWidth="0.6" strokeLinecap="round" opacity="0.85">
          <path d={`M30,${32 + trunkH * 0.45} Q${25},${32 + trunkH * 0.15} ${22},${top + cs * 0.4}`} />
          <path d={`M30,${32 + trunkH * 0.45} Q${35},${32 + trunkH * 0.15} ${38},${top + cs * 0.4}`} />
        </g>
      )}
      {/* 树冠轮廓 */}
      <path d={canopyPath} fill={accent} />
      {/* 树冠内层明暗 */}
      <circle cx={30 - cs * 0.3} cy={top + cs * 0.15} r={cs * 0.45} fill={accent} opacity="0.85" />
      <circle cx={30 + cs * 0.35} cy={top + cs * 0.25} r={cs * 0.4} fill={accentDeep} opacity="0.7" />
      <circle cx={30 - cs * 0.4} cy={top + cs * 0.5} r={cs * 0.32} fill={accentDeep} opacity="0.65" />
      <circle cx={30 + cs * 0.2} cy={top + cs * 0.55} r={cs * 0.3} fill={accentDeep} opacity="0.6" />
      {/* 树冠高光 */}
      <ellipse cx={30 - cs * 0.35} cy={top + cs * 0.0} rx={cs * 0.3} ry={cs * 0.15} fill="rgba(255,255,255,0.18)" />
      {/* 掌状叶点缀（散落在树冠外缘） */}
      <MapleLeaf x={28 - cs * 0.55} y={top + cs * 0.2} r={2.4 + sizeTier * 0.3} rot={-20} />
      <MapleLeaf x={32 + cs * 0.55} y={top + cs * 0.1} r={2.4 + sizeTier * 0.3} rot={30} />
      <MapleLeaf x={30} y={top - cs * 0.65} r={2.2 + sizeTier * 0.25} rot={-5} />
      {giant && <MapleLeaf x={30 - cs * 0.65} y={top + cs * 0.6} r={2.0} rot={-50} />}
      {ancient && <MapleLeaf x={30 + cs * 0.65} y={top + cs * 0.55} r={2.0} rot={55} />}
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
  hasFruit,
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
  hasFruit?: boolean;
}) {
  // 基础尺寸：固定成树大小（不再随节点缩减）
  const sizeTier = Math.max(tier, 3);
  const trunkH = 10 + sizeTier * 1.4;
  const trunkW = 1.6 + sizeTier * 0.3;
  const crownY = 32 - trunkH;
  const crownSize = 9 + sizeTier * 1.8;

  // 五瓣樱花
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

  // 树冠轮廓：轻盈蓬松云朵（多凸起，比橡树更稀疏更轻盈）
  const cs = crownSize;
  const top = crownY;
  const canopyPath = `
    M ${30 - cs * 0.85},${top + cs * 0.45}
    C ${30 - cs * 0.95},${top + cs * 0.0} ${30 - cs * 0.7},${top - cs * 0.4} ${30 - cs * 0.3},${top - cs * 0.3}
    C ${30 - cs * 0.2},${top - cs * 0.75} ${30 + cs * 0.1},${top - cs * 0.85} ${30 + cs * 0.25},${top - cs * 0.45}
    C ${30 + cs * 0.5},${top - cs * 0.75} ${30 + cs * 0.85},${top - cs * 0.5} ${30 + cs * 0.9},${top - cs * 0.05}
    C ${30 + cs * 1.05},${top + cs * 0.2} ${30 + cs * 0.95},${top + cs * 0.6} ${30 + cs * 0.7},${top + cs * 0.65}
    C ${30 + cs * 0.55},${top + cs * 0.85} ${30 + cs * 0.3},${top + cs * 0.8} ${30 + cs * 0.1},${top + cs * 0.7}
    C ${30 - cs * 0.15},${top + cs * 0.9} ${30 - cs * 0.5},${top + cs * 0.85} ${30 - cs * 0.65},${top + cs * 0.6}
    C ${30 - cs * 0.9},${top + cs * 0.65} ${30 - cs * 0.95},${top + cs * 0.5} ${30 - cs * 0.85},${top + cs * 0.45}
    Z`.replace(/\s+/g, " ").trim();

  // 树干（细长 + 樱树皮横纹特征）
  const trunkPath = `
    M ${30 - trunkW / 2 - 0.2},32
    C ${30 - trunkW / 2 - 0.3},${32 + trunkH * 0.5} ${30 - trunkW / 2 - 0.4},${32 + trunkH * 0.75} ${30 - trunkW / 2 - 0.5},${32 + trunkH}
    L ${30 + trunkW / 2 + 0.5},${32 + trunkH}
    C ${30 + trunkW / 2 + 0.4},${32 + trunkH * 0.75} ${30 + trunkW / 2 + 0.3},${32 + trunkH * 0.5} ${30 + trunkW / 2 + 0.2},32
    Z`.replace(/\s+/g, " ").trim();

  return (
    <g>
      {/* 主干（细长 + 樱树皮） */}
      <path d={trunkPath} fill="#5C3818" />
      {/* 樱树皮横纹（横向皮孔特征） */}
      <g stroke="#3D2415" strokeLinecap="round" opacity="0.55">
        <line x1={30 - trunkW * 0.4} y1={32 + trunkH * 0.2} x2={30 + trunkW * 0.4} y2={32 + trunkH * 0.2} strokeWidth="0.3" />
        <line x1={30 - trunkW * 0.45} y1={32 + trunkH * 0.4} x2={30 + trunkW * 0.45} y2={32 + trunkH * 0.4} strokeWidth="0.3" />
        <line x1={30 - trunkW * 0.5} y1={32 + trunkH * 0.6} x2={30 + trunkW * 0.5} y2={32 + trunkH * 0.6} strokeWidth="0.3" />
        <line x1={30 - trunkW * 0.55} y1={32 + trunkH * 0.8} x2={30 + trunkW * 0.55} y2={32 + trunkH * 0.8} strokeWidth="0.3" />
      </g>
      {/* 根部土堆 */}
      <ellipse cx="30" cy={32 + trunkH + 0.3} rx={trunkW * 1.1} ry="0.7" fill="#5C3818" opacity="0.4" />
      {/* 多分叉 Y 形（成树开始，自然分叉） */}
      {mature && (
        <g fill="none" stroke="#5C3818" strokeWidth={ancient ? 1 : 0.8} strokeLinecap="round" opacity="0.9">
          <path d={`M30,${32 + trunkH * 0.35} Q${26},${32 + trunkH * 0.15} ${22 - sizeTier * 0.3},${top + cs * 0.5}`} />
          <path d={`M30,${32 + trunkH * 0.35} Q${34},${32 + trunkH * 0.15} ${38 + sizeTier * 0.3},${top + cs * 0.5}`} />
          <path d={`M30,${32 + trunkH * 0.5} Q${29},${32 + trunkH * 0.1} ${28},${top + cs * 0.2}`} />
          <path d={`M30,${32 + trunkH * 0.5} Q${31},${32 + trunkH * 0.1} ${32},${top + cs * 0.25}`} />
        </g>
      )}
      {/* 树冠轮廓（蓬松云朵） */}
      <path d={canopyPath} fill={accent} />
      {/* 树冠内层明暗（轻盈通透感） */}
      <ellipse cx={30 - cs * 0.3} cy={top + cs * 0.15} rx={cs * 0.35} ry={cs * 0.3} fill={accentDeep} opacity="0.45" />
      <ellipse cx={30 + cs * 0.35} cy={top + cs * 0.25} rx={cs * 0.4} ry={cs * 0.3} fill={accentDeep} opacity="0.4" />
      <ellipse cx={30} cy={top + cs * 0.45} rx={cs * 0.3} ry={cs * 0.2} fill={accentDeep} opacity="0.5" />
      {/* 花簇（成树开始，自然点缀） */}
      {mature && !hasFruit && (
        <g>
          <Flower x={26 - cs * 0.4} y={top + cs * 0.3} r={2.2} />
          <Flower x={34 + cs * 0.35} y={top + cs * 0.4} r={2.0} opacity={0.85} />
          <Flower x={30} y={top + cs * 0.0} r={1.9} opacity={0.8} />
        </g>
      )}
      {giant && !hasFruit && <Flower x={22 - cs * 0.5} y={top + cs * 0.55} r={2.3} opacity={0.9} />}
      {/* 果实（樱桃，红色小圆点，有fruit节点时显示） */}
      {hasFruit && mature && (
        <g>
          <circle cx={26 - cs * 0.35} cy={top + cs * 0.35} r={1.8} fill="#C41E3A" />
          <circle cx={28 - cs * 0.25} cy={top + cs * 0.4} r={1.6} fill="#C41E3A" opacity={0.9} />
          <circle cx={34 + cs * 0.3} cy={top + cs * 0.45} r={1.7} fill="#C41E3A" opacity={0.85} />
        </g>
      )}
      {hasFruit && giant && (
        <g>
          <circle cx={22 - cs * 0.45} cy={top + cs * 0.6} r={1.9} fill="#C41E3A" opacity={0.95} />
          <circle cx={36 + cs * 0.4} cy={top + cs * 0.5} r={1.6} fill="#C41E3A" opacity={0.9} />
        </g>
      )}
      {ancient && (
        <g>
          <Flower x={38 + cs * 0.5} y={top + cs * 0.5} r={2.0} opacity={0.9} />
          <Flower x={30} y={top - cs * 0.6} r={1.8} opacity={0.85} />
          {/* 古木垂挂藤蔓 */}
          <path
            d={`M${30 - cs * 0.3},${top + cs * 0.7} Q${30 - cs * 0.4},${top + cs * 0.95} ${30 - cs * 0.35},${top + cs * 1.15}`}
            stroke="#3D2415"
            strokeWidth="0.4"
            fill="none"
            opacity="0.6"
          />
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
  hasFruit,
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
  hasFruit?: boolean;
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

  // 树冠轮廓：超宽伞形（不规则起伏）
  const cs = crownR;
  const top = crownY;
  const canopyPath = `
    M ${30 - cs * 1.0},${top + cs * 0.6}
    C ${30 - cs * 1.15},${top + cs * 0.2} ${30 - cs * 1.0},${top - cs * 0.2} ${30 - cs * 0.7},${top - cs * 0.25}
    C ${30 - cs * 0.55},${top - cs * 0.55} ${30 - cs * 0.15},${top - cs * 0.65} ${30 + cs * 0.0},${top - cs * 0.5}
    C ${30 + cs * 0.15},${top - cs * 0.8} ${30 + cs * 0.5},${top - cs * 0.7} ${30 + cs * 0.7},${top - cs * 0.4}
    C ${30 + cs * 0.95},${top - cs * 0.35} ${30 + cs * 1.1},${top - cs * 0.05} ${30 + cs * 1.15},${top + cs * 0.25}
    C ${30 + cs * 1.15},${top + cs * 0.55} ${30 + cs * 0.95},${top + cs * 0.75} ${30 + cs * 0.7},${top + cs * 0.8}
    C ${30 + cs * 0.5},${top + cs * 0.95} ${30 + cs * 0.15},${top + cs * 0.95} ${30 + cs * 0.0},${top + cs * 0.85}
    C ${30 - cs * 0.2},${top + cs * 0.95} ${30 - cs * 0.55},${top + cs * 0.95} ${30 - cs * 0.75},${top + cs * 0.85}
    C ${30 - cs * 0.95},${top + cs * 0.8} ${30 - cs * 1.1},${top + cs * 0.75} ${30 - cs * 1.0},${top + cs * 0.6}
    Z`.replace(/\s+/g, " ").trim();

  // 粗壮主干（略带弧度）
  const trunkPath = `
    M ${30 - trunkW / 2 - 0.5},32
    C ${30 - trunkW / 2 - 0.8},${32 + trunkH * 0.5} ${30 - trunkW / 2 - 1.5},${32 + trunkH * 0.75} ${30 - trunkW / 2 - 2},${32 + trunkH}
    L ${30 + trunkW / 2 + 2},${32 + trunkH}
    C ${30 + trunkW / 2 + 1.5},${32 + trunkH * 0.75} ${30 + trunkW / 2 + 0.8},${32 + trunkH * 0.5} ${30 + trunkW / 2 + 0.5},32
    Z`.replace(/\s+/g, " ").trim();

  return (
    <g>
      {/* 主干 */}
      <path d={trunkPath} fill="#5C3818" />
      {/* 树皮纹路（深） */}
      <g stroke="#2D1A0A" strokeLinecap="round">
        <line x1={30 - trunkW * 0.2} y1="33" x2={30 - trunkW * 0.25} y2={32 + trunkH - 0.3} strokeWidth="0.6" opacity="0.75" />
        <line x1={30 + trunkW * 0.1} y1="33" x2={30 + trunkW * 0.15} y2={32 + trunkH - 0.3} strokeWidth="0.5" opacity="0.65" />
        <line x1={30 - trunkW * 0.4} y1="36" x2={30 - trunkW * 0.35} y2={32 + trunkH - 0.3} strokeWidth="0.4" opacity="0.55" />
        <line x1={30 + trunkW * 0.35} y1="36" x2={30 + trunkW * 0.4} y2={32 + trunkH - 0.3} strokeWidth="0.4" opacity="0.5" />
      </g>
      {/* 根部土堆 */}
      <ellipse cx="30" cy={32 + trunkH + 0.4} rx={trunkW * 1.1} ry="0.9" fill="#4A2E18" opacity="0.45" />
      {/* 气根（从树冠下垂到地面/树干，弧形自然） */}
      {roots.map(([x, yTop, h], i) => (
        <g key={i}>
          <path
            d={`M${x},${yTop} C${x - 1.2 + (i % 2) * 2.4},${yTop + h * 0.35} ${x - 0.6 + (i % 2) * 1.2},${yTop + h * 0.7} ${x + (i % 2 === 0 ? -0.4 : 0.4)},${yTop + h}`}
            stroke="#4A2E18"
            strokeWidth={ancient ? 1.2 : 0.8}
            fill="none"
            opacity="0.85"
            strokeLinecap="round"
          />
          {/* 气根到地面后的小凸起 */}
          {mature && (
            <ellipse
              cx={x + (i % 2 === 0 ? -0.4 : 0.4)}
              cy={yTop + h}
              rx="0.6"
              ry="0.4"
              fill="#3D2415"
              opacity="0.6"
            />
          )}
        </g>
      ))}
      {/* 主分叉（成树起） */}
      {mature && (
        <g fill="none" stroke="#4A2E18" strokeWidth="0.7" strokeLinecap="round" opacity="0.85">
          <path d={`M30,${32 + trunkH * 0.4} Q${22},${32 + trunkH * 0.1} ${18},${top + cs * 0.4}`} />
          <path d={`M30,${32 + trunkH * 0.4} Q${38},${32 + trunkH * 0.1} ${42},${top + cs * 0.4}`} />
          <path d={`M30,${32 + trunkH * 0.3} Q${30},${32 - 1} ${30},${top + cs * 0.0}`} />
        </g>
      )}
      {/* 树冠轮廓 */}
      <path d={canopyPath} fill={accent} />
      {/* 树冠内层明暗 */}
      <ellipse cx={30 - cs * 0.4} cy={top + cs * 0.3} rx={cs * 0.4} ry={cs * 0.3} fill={accentDeep} opacity="0.55" />
      <ellipse cx={30 + cs * 0.45} cy={top + cs * 0.35} rx={cs * 0.45} ry={cs * 0.3} fill={accentDeep} opacity="0.5" />
      <ellipse cx={30 - cs * 0.55} cy={top + cs * 0.55} rx={cs * 0.35} ry={cs * 0.25} fill={accentDeep} opacity="0.5" />
      <ellipse cx={30 + cs * 0.55} cy={top + cs * 0.55} rx={cs * 0.35} ry={cs * 0.25} fill={accentDeep} opacity="0.5" />
      <ellipse cx={30} cy={top + cs * 0.7} rx={cs * 0.5} ry={cs * 0.15} fill={accentDeep} opacity="0.45" />
      {/* 树冠高光 */}
      <ellipse cx={30 - cs * 0.3} cy={top + cs * 0.0} rx={cs * 0.35} ry={cs * 0.12} fill="rgba(255,255,255,0.18)" />
      <ellipse cx={30 + cs * 0.2} cy={top + cs * 0.15} rx={cs * 0.25} ry={cs * 0.1} fill="rgba(255,255,255,0.15)" />
      {/* 古木垂挂藤蔓 */}
      {ancient && (
        <g fill="none" stroke="#3D2415" strokeWidth="0.5" strokeLinecap="round" opacity="0.7">
          <path d={`M${30 - cs * 0.5},${top + cs * 0.6} Q${30 - cs * 0.55},${top + cs * 0.9} ${30 - cs * 0.6},${top + cs * 1.1}`} />
          <path d={`M${30 + cs * 0.6},${top + cs * 0.7} Q${30 + cs * 0.7},${top + cs * 1.0} ${30 + cs * 0.65},${top + cs * 1.25}`} />
        </g>
      )}
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
  hasFruit,
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
  hasFruit?: boolean;
}) {
  // 基础尺寸：固定成树大小（不再随节点缩减）
  const sizeTier = Math.max(tier, 3);
  // 树干：细直修长
  const trunkH = 4 + sizeTier * 0.7;
  const trunkW = 1.6 + sizeTier * 0.22;
  // 整体高度：肃穆修长
  const totalH = 30 + sizeTier * 1.8;
  const baseW = 5 + sizeTier * 0.85;
  const tip = 32 - totalH;

  // 尖塔形树冠轮廓：略带曲线（非锐角三角），底部宽阔顶部尖锐
  // 柏树特征：底部略收、整体细长肃穆
  const canopyPath = `
    M 30,${tip + 0.5}
    C ${30 - 0.6},${tip + totalH * 0.15} ${30 - baseW * 0.18},${tip + totalH * 0.35} ${30 - baseW * 0.4},${tip + totalH * 0.6}
    C ${30 - baseW * 0.55},${tip + totalH * 0.8} ${30 - baseW * 0.5},${31.2} ${30 - baseW * 0.45},32
    L ${30 + baseW * 0.45},32
    C ${30 + baseW * 0.5},31.2} ${30 + baseW * 0.55},${tip + totalH * 0.8} ${30 + baseW * 0.4},${tip + totalH * 0.6}
    C ${30 + baseW * 0.18},${tip + totalH * 0.35} ${30 + 0.6},${tip + totalH * 0.15} 30,${tip + 0.5}
    Z`.replace(/\s+/g, " ").trim().replace("31.2}", "31.2}");

  // 树干（笔直 + 树皮纵裂纹）
  return (
    <g>
      {/* 主干（细直） */}
      <rect x={30 - trunkW / 2} y={32} width={trunkW} height={trunkH} fill="#5C3818" />
      {/* 树皮纵裂纹（细密竖线，柏树皮特征） */}
      <g stroke="#3D2415" strokeLinecap="round" opacity="0.6">
        <line x1={30 - trunkW * 0.25} y1="33" x2={30 - trunkW * 0.25} y2={32 + trunkH - 0.3} strokeWidth="0.25" />
        <line x1={30 - trunkW * 0.05} y1="33" x2={30 - trunkW * 0.05} y2={32 + trunkH - 0.3} strokeWidth="0.3" />
        <line x1={30 + trunkW * 0.15} y1="33" x2={30 + trunkW * 0.15} y2={32 + trunkH - 0.3} strokeWidth="0.25" />
        <line x1={30 + trunkW * 0.3} y1="33" x2={30 + trunkW * 0.3} y2={32 + trunkH - 0.3} strokeWidth="0.25" />
      </g>
      {/* 根部土堆 */}
      <ellipse cx="30" cy={32 + trunkH + 0.3} rx={trunkW * 1.1} ry="0.6" fill="#5C3818" opacity="0.4" />
      {/* 尖塔形树冠（略带曲线，肃穆修长） */}
      <path d={canopyPath} fill={accent} opacity="0.92" />
      {/* 内部明暗（细密鳞片状树叶的纹理） */}
      <g stroke={accentDeep} strokeWidth="0.3" opacity="0.5" fill="none">
        {Array.from({ length: 8 }).map((_, i) => {
          const ratio = (i + 1) / 9;
          const y = tip + totalH * ratio;
          const w = baseW * (0.4 + ratio * 0.5);
          return (
            <path
              key={i}
              d={`M${30 - w * 0.45},${y} L${30 - w * 0.35},${y + 0.5}`}
            />
          );
        })}
        {Array.from({ length: 8 }).map((_, i) => {
          const ratio = (i + 1) / 9;
          const y = tip + totalH * ratio;
          const w = baseW * (0.4 + ratio * 0.5);
          return (
            <path
              key={`r${i}`}
              d={`M${30 + w * 0.45},${y} L${30 + w * 0.35},${y + 0.5}`}
            />
          );
        })}
        {/* 中轴细竖线 */}
        <line x1="30" y1={tip + 2} x2="30" y2="31" strokeWidth="0.25" />
      </g>
      {/* 高光（左侧受光） */}
      <path
        d={`M30,${tip + 0.5} Q${30 - 0.3},${tip + totalH * 0.3} ${30 - baseW * 0.25},${tip + totalH * 0.6} Q${30 - baseW * 0.15},${tip + totalH * 0.8} ${30 - baseW * 0.1},31`}
        stroke={accent}
        strokeWidth="0.6"
        fill="none"
        opacity="0.4"
      />
      {/* 古木加苔藓 + 树尖微弯 */}
      {ancient && (
        <g opacity="0.5">
          <ellipse cx={30 - baseW * 0.3} cy={tip + totalH * 0.7} rx="1.2" ry="0.7" fill={accentDeep} />
          <ellipse cx={30 + baseW * 0.3} cy={tip + totalH * 0.5} rx="1.0" ry="0.6" fill={accentDeep} />
          {/* 树尖微弯（被风吹） */}
          <path
            d={`M30,${tip + 0.5} Q${30 + 0.5},${tip + 1.5} ${30 + 0.8},${tip + 2.5}`}
            stroke={accent}
            strokeWidth="0.6"
            fill="none"
            opacity="0.7"
          />
        </g>
      )}
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
