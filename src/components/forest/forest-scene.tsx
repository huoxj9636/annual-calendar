"use client";

/**
 * ForestScene - 森林全景场景画布
 *
 * 设计意象：清晨薄雾笼罩的山谷森林
 * 四层透视：晨空 → 远山 → 中景 → 草地
 * 树苗按节点数量成长为不同阶段
 */

import { useMemo, useRef, useState, useCallback } from "react";
import { Cloud, Sun, X, TreeDeciduous } from "lucide-react";
import type { SkinTheme } from "@/lib/skins";
import { SpeciesTree, TREE_SPECIES, type TreeSpeciesId } from "./tree-species";

export type ForestItem = {
  id: string;
  name: string;
  /** 节点数量，用于决定树大小/阶段 */
  count: number;
  /** 可选：徽章文本（好友首字母等） */
  badge?: string;
  /** 可选：自定义颜色（用于好友森林区分） */
  accentColor?: string;
  /** 可选：物种（决定树形），缺省 oak */
  species?: import("./tree-species").TreeSpeciesId;
  /** 可选：物种自定义颜色覆盖 */
  speciesColor?: string;
  /** 可选：物种自定义深色覆盖 */
  speciesColorDeep?: string;
  /** 可选：自定义位置（画布坐标，百分比 0-100）；未提供时使用自动布局 */
  position?: { x: number; y: number };
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
  /** 拖动树木结束回调（持久化新位置） */
  onItemPositionChange?: (id: string, position: { x: number; y: number }) => void;
  /** 是否允许拖拽（默认 true，仅 my 变体可拖） */
  draggable?: boolean;
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

// 基础尺寸：固定为成树大小（不再随节点数变化）。整体放大约 6 倍，
// 树之间用 treeScale 等比缩放以避免 10+ 棵树重叠。
const TREE_HEIGHTS: Record<number, { h: number; crown: number; trunk: number }> = {
  0: { h: 156, crown: 72, trunk: 48 },  // 空地（树桩）
  1: { h: 612, crown: 420, trunk: 192 },
  2: { h: 612, crown: 420, trunk: 192 },
  3: { h: 612, crown: 420, trunk: 192 },
  4: { h: 612, crown: 420, trunk: 192 },
  5: { h: 612, crown: 420, trunk: 192 },
};

/** 单棵树 */
function ForestTree({
  item,
  x,
  y,
  selected,
  onClick,
  onDelete,
  onPositionChange,
  draggable,
  skin,
  variant,
  index,
  treeScale = 1,
  sceneRect,
}: {
  item: ForestItem;
  x: number;
  y: number;
  selected: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  onPositionChange?: (position: { x: number; y: number }) => void;
  draggable?: boolean;
  skin: SkinTheme;
  variant: "my" | "friends";
  index: number;
  treeScale?: number;
  sceneRect: React.RefObject<HTMLDivElement | null>;
}) {
  const stage = getStage(item.count);
  const sizes = TREE_HEIGHTS[stage.size] || TREE_HEIGHTS[1];
  const accent = item.accentColor || skin.swatch;

  // 拖拽状态
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const startRef = useRef<{ pointerX: number; pointerY: number; itemX: number; itemY: number } | null>(null);

  // 树冠颜色：从主题色到略深渐变
  // 用 mix-blend 不可靠，直接用主色 + alpha 表示深浅
  const crownOpacity = 0.55 + stage.size * 0.05; // 越大越浓
  const crownDeep = 0.85 + stage.size * 0.03;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!draggable) return;
      // 仅响应主键（左键 / 触屏）
      if (e.button !== 0) return;
      const btn = e.currentTarget;
      const rect = sceneRect.current?.getBoundingClientRect();
      if (!rect) return;
      // 计算指针在画布中的位置（百分比）
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      // 当前树的底部锚点位置
      const itemX = x;
      const itemY = y;
      startRef.current = { pointerX: px, pointerY: py, itemX, itemY };
      setDragOffset({ dx: 0, dy: 0 });
      setDragging(true);
      btn.setPointerCapture(e.pointerId);
      e.stopPropagation();
    },
    [draggable, sceneRect, x, y]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragging || !startRef.current) return;
      const rect = sceneRect.current?.getBoundingClientRect();
      if (!rect) return;
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      const dx = px - startRef.current.pointerX;
      const dy = py - startRef.current.pointerY;
      setDragOffset({ dx, dy });
    },
    [dragging, sceneRect]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragging || !startRef.current) {
        setDragging(false);
        setDragOffset(null);
        startRef.current = null;
        return;
      }
      const rect = sceneRect.current?.getBoundingClientRect();
      if (!rect) {
        setDragging(false);
        setDragOffset(null);
        startRef.current = null;
        return;
      }
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      const newX = Math.max(2, Math.min(98, startRef.current.itemX + (px - startRef.current.pointerX)));
      const newY = Math.max(2, Math.min(95, startRef.current.itemY + (py - startRef.current.pointerY)));
      onPositionChange?.({ x: newX, y: newY });
      setDragging(false);
      setDragOffset(null);
      startRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    },
    [dragging, onPositionChange, sceneRect]
  );

  // 计算当前实际显示位置（拖拽中 = 原始 + 偏移）
  const displayX = dragging && dragOffset ? x + dragOffset.dx : x;
  const displayY = dragging && dragOffset ? y + dragOffset.dy : y;

  return (
    <button
      type="button"
      onClick={(e) => {
        // 拖拽中不触发点击
        if (dragging) return;
        onClick?.();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="absolute group focus:outline-none select-none"
      style={{
        left: `${displayX}%`,
        bottom: `${displayY}%`,
        transform: "translateX(-50%)",
        width: (sizes.crown + 16) * treeScale,
        height: (sizes.h + 8) * treeScale,
        cursor: draggable ? (dragging ? "grabbing" : "grab") : onClick ? "pointer" : "default",
        touchAction: "none",
        zIndex: dragging ? 50 : selected ? 10 : 1,
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

      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: 0,
          width: sizes.crown,
          height: sizes.h,
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
          <SpeciesTree
            species={item.species || "oak"}
            tier={stage.tier}
            accent={item.speciesColor || accent}
            accentDeep={item.speciesColorDeep || skin.divider}
            count={item.count}
            badge={variant === "friends" ? item.badge : undefined}
            isFriends={variant === "friends"}
          />
        </div>

        {/* 树名称徽章（常显，悬停态更突出） */}
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1.5 transition-all"
          style={{
            top: -22,
            fontSize: 11,
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.78)",
            color: "rgba(40,30,20,0.85)",
            letterSpacing: "0.04em",
            backdropFilter: "blur(6px)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
          }}
        >
          <span>{item.name}</span>
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
  onItemPositionChange,
  selectedId,
  variant = "my",
  draggable = true,
}: ForestSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const itemsKey = useMemo(() => items.map((i) => i.id).join(","), [items]);

  // 树木位置：均匀分布 + 稳定 hash 抖动；数量越多，缩放越小以保持 10+ 棵不重叠
  const treeScale = useMemo(() => {
    const n = items.length;
    if (n <= 1) return 1;
    if (n <= 3) return 0.95;
    if (n <= 5) return 0.88;
    if (n <= 8) return 0.78;
    if (n <= 12) return 0.65;
    if (n <= 18) return 0.55;
    return 0.48;
  }, [items.length]);

  const layout = useMemo(() => {
    const total = items.length;
    if (total === 0) return [];
    // 计算未自定义位置的树数量，用于自动分布
    const autoItems = items.filter((it) => !it.position);
    const placed = new Set<string>();
    return items.map((item, i) => {
      // 自定义位置：直接使用（用户拖拽后的结果）
      if (item.position) {
        placed.add(item.id);
        const treeScale = total <= 1 ? 1 : total <= 2 ? 0.55 : total <= 3 ? 0.4 : total <= 5 ? 0.32 : total <= 8 ? 0.26 : total <= 12 ? 0.22 : 0.19;
        return { item, x: item.position.x, y: item.position.y, treeScale };
      }
      // 自动分布：使用稳定 hash 抖动
      const autoIndex = Array.from(items.slice(0, i + 1).filter((it) => !it.position)).length - 1;
      const baseX = 8 + ((autoIndex + 0.5) / Math.max(1, autoItems.length)) * 84;
      const h = hashStr(item.id);
      const xJitter = (((h % 200) / 100) - 1) * 1.5;
      const x = Math.max(6, Math.min(94, baseX + xJitter));
      const yBase = 30 + (autoIndex % 3) * 5;
      const yJitter = (((h >> 8) % 80) / 10 - 4);
      const y = Math.max(10, Math.min(48, yBase + yJitter));
      const treeScale = total <= 1 ? 1 : total <= 2 ? 0.55 : total <= 3 ? 0.4 : total <= 5 ? 0.32 : total <= 8 ? 0.26 : total <= 12 ? 0.22 : 0.19;
      return { item, x, y, treeScale };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, itemsKey]);

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

      <div ref={sceneRef} style={sceneStyle} className={fillHeight ? "w-full h-full" : "w-full"}>
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
            onPositionChange={
              onItemPositionChange
                ? (p) => onItemPositionChange(item.id, p)
                : undefined
            }
            draggable={draggable && variant === "my"}
            skin={skin}
            variant={variant}
            index={i}
            sceneRect={sceneRef}
          />
        ))}

        {/* 空状态 */}
        {items.length === 0 && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ color: skin.textSecondary }}
          >
            <TreeDeciduous size={56} strokeWidth={1} className="opacity-40 mb-2" />
            <p className="text-sm opacity-70">这里还是一片荒地</p>
            <p className="text-xs opacity-50 mt-1">点击右下角种下第一棵树</p>
          </div>
        )}
      </div>
    </>
  );
}
