"use client";

/**
 * TreeCloseup - 单棵知识树的成长图鉴视图
 *
 * 视觉：单棵参天大树特写 + 5 种知识类型作为"果实"分布在树上不同部位
 * 上方是大图区，下方是阶段进度 + 知识分组
 */

import { useMemo } from "react";
import {
  ArrowLeft,
  Sprout,
  TreePine,
  TreeDeciduous,
  Cherry,
  Trees,
  Plus,
  Leaf,
  Apple,
  GitBranch,
  Layers,
  Sprout as Root,
} from "lucide-react";
import type { SkinTheme } from "@/lib/skins";
import type { KnowledgeNode, KnowledgeTree } from "../knowledge-panel";

export const TREE_NODE_TYPE_INFO = {
  root: { label: "树根", desc: "底层认知/核心原理", Icon: Root, pos: "土中" },
  trunk: { label: "树干", desc: "核心目标/方向", Icon: TreePine, pos: "主干" },
  branch: { label: "树枝", desc: "实现路径/方法", Icon: GitBranch, pos: "分枝" },
  leaf: { label: "树叶", desc: "具体执行/碎片知识", Icon: Leaf, pos: "叶簇" },
  fruit: { label: "果实", desc: "成果产出/价值变现", Icon: Apple, pos: "果实" },
} as const;

export type NodeType = keyof typeof TREE_NODE_TYPE_INFO;

function getStage(count: number) {
  if (count === 0) return { tier: 0, label: "空地", nextAt: 1, Icon: Sprout };
  if (count <= 2) return { tier: 1, label: "幼苗", nextAt: 3, Icon: Sprout };
  if (count <= 7) return { tier: 2, label: "小树", nextAt: 8, Icon: TreePine };
  if (count <= 15) return { tier: 3, label: "成树", nextAt: 16, Icon: TreeDeciduous };
  if (count <= 30) return { tier: 4, label: "参天", nextAt: 31, Icon: Cherry };
  return { tier: 5, label: "古木", nextAt: 50, Icon: Trees };
}

const STAGE_LIST = [
  { tier: 1, label: "幼苗", at: 1, Icon: Sprout },
  { tier: 2, label: "小树", at: 3, Icon: TreePine },
  { tier: 3, label: "成树", at: 8, Icon: TreeDeciduous },
  { tier: 4, label: "参天", at: 16, Icon: Cherry },
  { tier: 5, label: "古木", at: 31, Icon: Trees },
];

/** 单棵树大图 - 把 5 种类型的知识以"果实"形式分布在树上 */
function TreeBigVisual({
  tree,
  nodesByType,
  skin,
}: {
  tree: KnowledgeTree;
  nodesByType: Record<string, KnowledgeNode[]>;
  skin: SkinTheme;
}) {
  const stage = getStage(tree.nodes.length);
  const sizes: Record<number, { h: number; crown: number; trunk: number }> = {
    0: { h: 80, crown: 0, trunk: 0 },
    1: { h: 120, crown: 80, trunk: 40 },
    2: { h: 200, crown: 140, trunk: 70 },
    3: { h: 280, crown: 200, trunk: 100 },
    4: { h: 340, crown: 240, trunk: 120 },
    5: { h: 380, crown: 270, trunk: 130 },
  };
  const s = sizes[stage.tier] || sizes[1];
  const Icon = stage.Icon;

  // 各类型在树上的位置（相对坐标）
  const positions: Record<NodeType, { top: string; left: string }> = {
    root: { top: "78%", left: "50%" },     // 树根 - 土壤中
    trunk: { top: "55%", left: "50%" },    // 树干 - 主干
    branch: { top: "40%", left: "22%" },   // 树枝 - 左侧
    leaf: { top: "30%", left: "78%" },     // 树叶 - 右侧
    fruit: { top: "22%", left: "48%" },    // 果实 - 树冠内
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: 380,
        background: `linear-gradient(180deg, 
          oklch(0.97 0.02 85) 0%, 
          oklch(0.94 0.04 95) 40%, 
          ${skin.swatch}10 80%, 
          ${skin.swatch}30 100%)`,
        borderRadius: 16,
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.12)",
      }}
    >
      {/* 太阳光斑 */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          right: 60,
          top: 30,
          width: 80,
          height: 80,
          background: "radial-gradient(circle, rgba(255,235,180,0.6) 0%, transparent 70%)",
          filter: "blur(4px)",
        }}
      />

      {/* 远山 */}
      <svg
        className="absolute inset-x-0 bottom-0 w-full pointer-events-none"
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        style={{ height: "45%" }}
      >
        <path
          d="M0,170 L100,140 L200,160 L320,120 L440,150 L560,110 L680,145 L800,115 L920,150 L1000,130 L1000,200 L0,200 Z"
          fill={skin.swatch}
          opacity={0.18}
        />
        <path
          d="M0,185 L80,170 L180,180 L280,160 L380,180 L480,155 L580,175 L680,160 L780,180 L880,165 L1000,180 L1000,200 L0,200 Z"
          fill={skin.swatch}
          opacity={0.28}
        />
      </svg>

      {/* 草地 */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "20%",
          background: `linear-gradient(180deg, ${skin.swatch}30 0%, ${skin.swatch}55 100%)`,
        }}
      />

      {/* 单棵参天大树 */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: "12%",
          width: s.crown,
          height: s.h,
        }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: 0,
            width: s.crown,
            height: s.h,
            animation: `treeSway2 5s ease-in-out infinite alternate`,
            transformOrigin: "bottom center",
          }}
        >
          {/* 树干 */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              bottom: 0,
              width: Math.max(10, s.trunk * 0.18),
              height: s.trunk,
              background: "linear-gradient(90deg, #4a2f1a 0%, #6B4423 45%, #4a2f1a 100%)",
              borderRadius: "4px 4px 2px 2px",
            }}
          />
          {/* 树冠 */}
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
            style={{
              bottom: s.trunk - s.crown * 0.06,
              width: s.crown,
              height: s.crown,
              background: `radial-gradient(circle at 35% 30%, ${skin.swatch}66 0%, ${skin.swatch}cc 40%, ${skin.swatch} 100%)`,
              borderRadius: "50%",
              boxShadow: `0 8px 24px ${skin.swatch}44, inset 0 -10px 20px ${skin.swatch}77`,
              border: `1px solid ${skin.swatch}66`,
            }}
          >
            <Icon
              size={s.crown * 0.4}
              strokeWidth={1.2}
              style={{ color: "rgba(255,255,255,0.85)" }}
            />
          </div>
        </div>
      </div>

      {/* 知识类型"果实"分布 */}
      {(Object.keys(TREE_NODE_TYPE_INFO) as NodeType[]).map((type) => {
        const info = TREE_NODE_TYPE_INFO[type];
        const nodes = nodesByType[type] || [];
        if (nodes.length === 0) return null;
        const pos = positions[type];
        return (
          <div
            key={type}
            className="absolute flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -50%)",
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(6px)",
              border: `1.5px solid ${skin.swatch}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
            title={`${info.label}: ${nodes.length} 个`}
          >
            <info.Icon size={12} style={{ color: skin.swatch }} />
            <span
              className="text-xs font-semibold"
              style={{ color: skin.textPrimary }}
            >
              {info.label}·{nodes.length}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 阶段进度条 */
function StageProgress({ count, skin }: { count: number; skin: SkinTheme }) {
  const stage = getStage(count);
  const currentIdx = STAGE_LIST.findIndex((s) => s.tier === stage.tier);
  const nextStage = STAGE_LIST[currentIdx + 1];
  const prevThreshold = currentIdx >= 0 ? STAGE_LIST[currentIdx].at : 0;
  const nextThreshold = nextStage ? nextStage.at : prevThreshold + 30;
  const progress = nextStage
    ? Math.min(1, (count - prevThreshold) / (nextThreshold - prevThreshold))
    : 1;

  return (
    <div
      className="p-5 rounded-lg"
      style={{ background: skin.cardBg, border: `1px solid ${skin.divider}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <stage.Icon size={18} style={{ color: skin.swatch }} />
          <span className="font-semibold" style={{ color: skin.textPrimary }}>
            当前阶段：{stage.label}
          </span>
        </div>
        <span
          className="text-xs font-mono"
          style={{ color: skin.textSecondary }}
        >
          {count} 个知识
        </span>
      </div>

      {/* 阶段轨道 */}
      <div className="flex items-center justify-between mb-2">
        {STAGE_LIST.map((s) => {
          const reached = count >= s.at;
          const isCurrent = s.tier === stage.tier;
          return (
            <div key={s.tier} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: reached ? skin.swatch : skin.cardBg,
                  color: reached ? "#fff" : skin.textMuted,
                  border: `2px solid ${reached ? skin.swatch : skin.divider}`,
                  transform: isCurrent ? "scale(1.15)" : "scale(1)",
                  boxShadow: isCurrent ? `0 4px 12px ${skin.swatch}55` : "none",
                }}
              >
                <s.Icon size={16} />
              </div>
              <span
                className="text-[10px] tracking-wider"
                style={{
                  color: isCurrent ? skin.textPrimary : skin.textMuted,
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {s.label}
              </span>
              <span
                className="text-[9px] font-mono"
                style={{ color: skin.textMuted }}
              >
                {s.at}+
              </span>
            </div>
          );
        })}
      </div>

      {/* 进度条 */}
      {nextStage && (
        <div className="mt-3">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: skin.progressTrack }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${skin.swatch}, ${skin.swatch}cc)`,
              }}
            />
          </div>
          <div
            className="text-[11px] mt-1.5 text-right"
            style={{ color: skin.textSecondary }}
          >
            距「{nextStage.label}」还差 {nextThreshold - count} 个知识
          </div>
        </div>
      )}
      {!nextStage && (
        <div
          className="text-center text-xs mt-2 py-1.5 rounded"
          style={{ background: `${skin.swatch}15`, color: skin.swatch }}
        >
          🌳 已达最高阶段，知识的参天古木
        </div>
      )}
    </div>
  );
}

/** 知识分组卡片 */
function NodeGroupCard({
  type,
  nodes,
  skin,
  onDelete,
  onAdd,
}: {
  type: NodeType;
  nodes: KnowledgeNode[];
  skin: SkinTheme;
  onDelete: (id: string) => void;
  onAdd: (type: NodeType) => void;
}) {
  const info = TREE_NODE_TYPE_INFO[type];
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: skin.cardBg,
        border: `1px solid ${skin.divider}`,
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{
          background: `linear-gradient(90deg, ${skin.swatch}10 0%, transparent 100%)`,
          borderBottom: `1px solid ${skin.divider}`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: `${skin.swatch}20`, color: skin.swatch }}
          >
            <info.Icon size={14} />
          </div>
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: skin.textPrimary }}
            >
              {info.label}
            </div>
            <div
              className="text-[10px]"
              style={{ color: skin.textSecondary }}
            >
              {info.desc}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: `${skin.swatch}15`, color: skin.swatch }}
          >
            {nodes.length}
          </span>
          <button
            onClick={() => onAdd(type)}
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: skin.swatch,
              color: "#fff",
            }}
            title={`添加${info.label}`}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {nodes.length === 0 ? (
          <div
            className="text-center text-xs py-4 opacity-50"
            style={{ color: skin.textSecondary }}
          >
            还没有{info.label}，添加一个吧
          </div>
        ) : (
          nodes.map((n) => (
            <div
              key={n.id}
              className="p-2.5 rounded flex items-start justify-between group transition-colors"
              style={{ background: `${skin.swatch}08` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${skin.swatch}14`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${skin.swatch}08`;
              }}
            >
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: skin.textPrimary }}
                >
                  {n.title}
                </div>
                {n.content && (
                  <div
                    className="text-xs mt-0.5 line-clamp-2"
                    style={{ color: skin.textSecondary }}
                  >
                    {n.content}
                  </div>
                )}
                {n.source && (
                  <div
                    className="text-[10px] mt-1 truncate"
                    style={{ color: skin.textMuted }}
                  >
                    📎 {n.source}
                  </div>
                )}
              </div>
              <button
                onClick={() => onDelete(n.id)}
                className="ml-2 text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  color: "#ef4444",
                  background: "rgba(239,68,68,0.1)",
                }}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function TreeCloseup({
  tree,
  nodesByType,
  onBack,
  onAddNode,
  onDeleteNode,
  onAddTypeNode,
  skin,
}: {
  tree: KnowledgeTree;
  nodesByType: Record<string, KnowledgeNode[]>;
  onBack: () => void;
  onAddNode: () => void;
  onDeleteNode: (id: string) => void;
  onAddTypeNode: (type: NodeType) => void;
  skin: SkinTheme;
}) {
  const totalNodes = tree.nodes.length;
  const stage = getStage(totalNodes);

  // 类型分布统计
  const typeStats = useMemo(() => {
    return (Object.keys(TREE_NODE_TYPE_INFO) as NodeType[]).map((type) => {
      const count = nodesByType[type]?.length || 0;
      return { type, count, info: TREE_NODE_TYPE_INFO[type] };
    });
  }, [nodesByType]);

  return (
    <div className="space-y-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: skin.cardBg,
              border: `1px solid ${skin.divider}`,
              color: skin.textPrimary,
            }}
            title="返回森林"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2
              className="text-xl font-semibold"
              style={{
                color: skin.textPrimary,
                fontFamily: "var(--font-serif)",
              }}
            >
              {tree.name}
            </h2>
            {tree.industry && (
              <div
                className="text-xs flex items-center gap-1"
                style={{ color: skin.textSecondary }}
              >
                <Layers size={10} />
                {tree.industry}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onAddNode}
          className="px-4 py-2 rounded-full flex items-center gap-1.5 text-sm font-medium transition-transform hover:scale-105"
          style={{ background: skin.swatch, color: "#fff" }}
        >
          <Plus size={14} />
          添加知识
        </button>
      </div>

      {tree.description && (
        <div
          className="text-sm italic px-4 py-2 rounded"
          style={{
            color: skin.textSecondary,
            background: `${skin.swatch}08`,
            borderLeft: `3px solid ${skin.swatch}`,
          }}
        >
          &ldquo;{tree.description}&rdquo;
        </div>
      )}

      {/* 大图区 */}
      <TreeBigVisual
        tree={tree}
        nodesByType={nodesByType}
        skin={skin}
      />

      {/* 阶段进度 */}
      <StageProgress count={totalNodes} skin={skin} />

      {/* 知识分组 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {typeStats.map(({ type, count, info }) => (
          <NodeGroupCard
            key={type}
            type={type}
            nodes={nodesByType[type] || []}
            skin={skin}
            onDelete={onDeleteNode}
            onAdd={onAddTypeNode}
          />
        ))}
      </div>

      <style>{`
        @keyframes treeSway2 {
          0%   { transform: translateX(-50%) rotate(-1deg); }
          100% { transform: translateX(-50%) rotate(1deg); }
        }
      `}</style>
    </div>
  );
}
