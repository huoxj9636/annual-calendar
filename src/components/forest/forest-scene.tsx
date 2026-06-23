"use client";

/**
 * ForestScene - 森林全景场景画布
 *
 * 设计意象：清晨薄雾笼罩的山谷森林
 * 四层透视：晨空 → 远山 → 中景 → 草地
 * 树苗按节点数量成长为不同阶段
 */

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { X, TreeDeciduous, Pencil } from "lucide-react";
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
  /** 可选：自定义缩放比例（滚轮缩放），默认 1 */
  scale?: number;
  /** 可选：知识节点列表（用于判断是否有果实） */
  nodes?: Array<{ type: string; content: string }>;
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
  /** 编辑树木回调（提供时悬停会出现编辑按钮） */
  onItemEdit?: (id: string) => void;
  /** 选中的 item id（高亮） */
  selectedId?: string;
  /** 变体：my = 我的森林，friends = 好友森林 */
  variant?: "my" | "friends";
  /** 拖动树木结束回调（持久化新位置） */
  onItemPositionChange?: (id: string, position: { x: number; y: number }) => void;
  /** 滚轮缩放树木回调（持久化新缩放） */
  onItemScaleChange?: (id: string, scale: number) => void;
  /** 是否允许拖拽（默认 true，仅 my 变体可拖） */
  draggable?: boolean;
  /**
   * 画布复位触发器：每次变化时，ForestScene 内部自动把画布 pan 归零 + 清空 localStorage。
   * 用于"创建新树后自动把画布定位到让新树在中心"。
   */
  resetTrigger?: number;
  /**
   * 焦点树 id：变化时触发短暂视觉高亮（pulse），不 pan（树永远在屏幕内）。
   */
  focusTreeId?: string | null;
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

// 基础尺寸：固定为成树大小（不再随节点数变化）。整体放大后按 0.75 缩放，
// 树之间用 treeScale 等比缩放以避免 10+ 棵树重叠。
const TREE_HEIGHTS: Record<number, { h: number; crown: number; trunk: number }> = {
  0: { h: 117, crown: 54, trunk: 36 },  // 空地（树桩）
  1: { h: 459, crown: 315, trunk: 144 },
  2: { h: 459, crown: 315, trunk: 144 },
  3: { h: 459, crown: 315, trunk: 144 },
  4: { h: 459, crown: 315, trunk: 144 },
  5: { h: 459, crown: 315, trunk: 144 },
};

/** 单棵树 */
function ForestTree({
  item,
  x,
  y,
  selected,
  focused,
  onClick,
  onDelete,
  onEdit,
  onPositionChange,
  onScaleChange,
  draggable,
  skin,
  variant,
  index,
  treeScale = 1,
  zoom = 1,
  sceneRect,
  innerRect: innerRectProp,
}: {
  item: ForestItem;
  x: number;
  y: number;
  selected: boolean;
  focused?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onScaleChange?: (scale: number) => void;
  draggable?: boolean;
  skin: SkinTheme;
  variant: "my" | "friends";
  index: number;
  treeScale?: number;
  zoom?: number; // 画布缩放比例，树也要跟着缩放
  sceneRect: React.RefObject<HTMLDivElement | null>;
  innerRect?: React.RefObject<HTMLDivElement | null>;
}) {
  // 物理画布占外层可视区的 200%（与 ForestScene 中的 CANVAS_W 保持一致）
  const CANVAS_W = 200;
  const stage = getStage(item.count);
  const sizes = TREE_HEIGHTS[stage.size] || TREE_HEIGHTS[1];
  const accent = item.accentColor || skin.swatch;

  // 树的缩放范围（滚轮放大缩小）
  const SCALE_MIN = 0.5;
  const SCALE_MAX = 2.0;
  const SCALE_STEP = 0.1;
  const currentScale = item.scale ?? 1;

  // 滚轮放大缩小树
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!onScaleChange) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
      const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, currentScale + delta));
      if (newScale !== currentScale) {
        onScaleChange(newScale);
      }
    },
    [onScaleChange, currentScale]
  );

  // 计算指针位置：优先用 inner（物理画布）rect，让 px/py 和 x/y 同坐标系
  // 这样树在 inner 内的位置可以拖到整个 0-100% 范围（视觉上覆盖整个可视区）
  const getPointerInCanvas = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const inner = innerRectProp?.current;
      if (inner) {
        const r = inner.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          return {
            px: ((e.clientX - r.left) / r.width) * 100,
            py: ((e.clientY - r.top) / r.height) * 100,
            rectW: r.width,
            rectH: r.height,
          };
        }
      }
      // 兜底：用 sceneRect（外层可视区），并按 inner/scene 比例换算到 inner 坐标系
      const scene = sceneRect.current;
      if (!scene) return null;
      const r = scene.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      const ratio = 100 / (CANVAS_W * zoom);
      return {
        px: ((e.clientX - r.left) / r.width) * 100 * ratio,
        py: ((e.clientY - r.top) / r.height) * 100 * ratio,
        rectW: r.width,
        rectH: r.height,
      };
    },
    [innerRectProp, sceneRect, zoom]
  );

  // 拖拽状态
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const startRef = useRef<{ pointerX: number; pointerY: number; itemX: number; itemY: number } | null>(null);
  // 标记本次按下-抬起是否发生过实际拖动（移动 > 阈值）
  // 用于拖拽后阻止误触的 click 事件
  const wasDraggedRef = useRef(false);
  // 移动距离阈值（像素），超过此值认为是拖动而非点击
  const DRAG_THRESHOLD_PX = 4;

  // 树冠颜色：从主题色到略深渐变
  // 用 mix-blend 不可靠，直接用主色 + alpha 表示深浅
  const crownOpacity = 0.55 + stage.size * 0.05; // 越大越浓
  const crownDeep = 0.85 + stage.size * 0.03;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggable) return;
      // 仅响应主键（左键 / 触屏）
      if (e.button !== 0) return;
      const btn = e.currentTarget;
      const p = getPointerInCanvas(e);
      if (!p) return;
      // 当前树的底部锚点位置
      const itemX = x;
      const itemY = y;
      startRef.current = { pointerX: p.px, pointerY: p.py, itemX, itemY };
      wasDraggedRef.current = false;
      setDragOffset({ dx: 0, dy: 0 });
      setDragging(true);
      btn.setPointerCapture(e.pointerId);
      e.stopPropagation();
    },
    [draggable, getPointerInCanvas, x, y]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || !startRef.current) return;
      const p = getPointerInCanvas(e);
      if (!p) return;
      const px = p.px;
      const py = p.py;
      // left: 0% 在画布最左 → 指针向右 px 增大 → dx 应为 + (left 增大)
      // bottom: 0% 在画布最底 → 指针向下 py 增大 → bottom 应减小 → dy 应为 - (py 增量取反)
      const rawDx = px - startRef.current.pointerX;
      const rawDy = -(py - startRef.current.pointerY);
      // 实时边界限制：拖动过程中树不能飘出画布
      const minX = 0;
      const maxX = 100;
      const minY = 0;
      const maxY = 100;
      const targetX = Math.max(minX, Math.min(maxX, startRef.current.itemX + rawDx));
      const targetY = Math.max(minY, Math.min(maxY, startRef.current.itemY + rawDy));
      const dx = targetX - startRef.current.itemX;
      const dy = targetY - startRef.current.itemY;
      // 用像素距离判断是否真的在拖动（避免抖动被识别为点击失败）
      const dPx = Math.hypot(
        (px - startRef.current.pointerX) * p.rectW / 100,
        (py - startRef.current.pointerY) * p.rectH / 100
      );
      if (dPx > DRAG_THRESHOLD_PX) {
        wasDraggedRef.current = true;
      }
      setDragOffset({ dx, dy });
    },
    [dragging, getPointerInCanvas]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || !startRef.current) {
        setDragging(false);
        setDragOffset(null);
        startRef.current = null;
        return;
      }
      const p = getPointerInCanvas(e);
      if (!p) {
        setDragging(false);
        setDragOffset(null);
        startRef.current = null;
        return;
      }
      const newX = Math.max(0, Math.min(100, startRef.current.itemX + (p.px - startRef.current.pointerX)));
      // bottom 坐标系与屏幕 Y 反向：指针向下时 bottom 减小
      const newY = Math.max(0, Math.min(100, startRef.current.itemY - (p.py - startRef.current.pointerY)));
      onPositionChange?.({ x: newX, y: newY });
      setDragging(false);
      setDragOffset(null);
      startRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    },
    [dragging, onPositionChange, getPointerInCanvas]
  );

  // 计算当前实际显示位置（拖拽中 = 原始 + 偏移）
  const displayX = dragging && dragOffset ? x + dragOffset.dx : x;
  const displayY = dragging && dragOffset ? y + dragOffset.dy : y;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        // 如果本次按下-抬起发生过拖动（移动 > 阈值），则不触发点击
        if (wasDraggedRef.current) {
          wasDraggedRef.current = false;
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        // 拖拽中也不触发点击
        if (dragging) return;
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!dragging) onClick?.();
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={handleWheel}
      className="absolute group focus:outline-none select-none"
      style={{
        left: `${displayX}%`,
        bottom: `${displayY}%`,
        transform: "translateX(-50%)",
        width: (sizes.crown + 16) * treeScale * zoom * currentScale,
        height: (sizes.h + 8) * treeScale * zoom * currentScale,
        cursor: draggable ? (dragging ? "grabbing" : "grab") : onClick ? "pointer" : "default",
        touchAction: "none",
        zIndex: dragging ? 50 : selected ? 10 : 1,
        animation: focused ? "focusPulse 1.2s ease-out 2" : undefined,
      }}
      title={`${item.name} · ${stage.label} · ${item.count} 个知识`}
    >
      {/* focus pulse 光环：围绕树冠中心的扩散高亮圆环 */}
      {focused && (
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            // 树冠中心位置（从容器顶部算）：树冠高度的一半
            top: sizes.crown * 0.5 * treeScale * zoom * currentScale,
            transform: "translateY(-50%)",
            width: sizes.crown * 1.6 * treeScale * zoom * currentScale,
            height: sizes.crown * 1.6 * treeScale * zoom * currentScale,
            border: `2px solid ${skin.swatch}`,
            animation: "focusRing 1.2s ease-out 2",
          }}
        />
      )}
      {/* 树阴影（草地投影）- 保持固定大小，不随树缩放 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full blur-[2px]"
        style={{
          bottom: -2,
          width: sizes.crown * 0.7 * zoom,
          height: 6 * zoom,
          background: "rgba(0,0,0,0.18)",
        }}
      />

      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: 0,
          width: sizes.crown * zoom * currentScale,
          height: sizes.h * zoom * currentScale,
        }}
      >
        {/* 波纹树（真实树木：有云朵状树冠 + 梯形树干 + 树皮纹路） */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: 0,
            width: sizes.crown * 1.4 * zoom * currentScale,
            height: (sizes.trunk + sizes.crown) * zoom * currentScale,
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
            hasFruit={!!(item.nodes && item.nodes.some((n) => n.type === "fruit"))}
          />
        </div>

        {/* 树名称徽章（常显，悬停态更突出） - 保持固定大小，不随树缩放 */}
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1.5 transition-all"
          style={{
            top: -22 * zoom,
            fontSize: 11 * zoom,
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
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onEdit();
              }}
              onPointerDown={(e) => {
                // 阻止冒泡到外层 div 的拖拽/点击逻辑
                e.stopPropagation();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
              }}
              aria-label="编辑这棵树"
              className="ml-0.5 rounded-full flex items-center justify-center pointer-events-auto transition-colors"
              style={{ 
                background: "rgba(255,255,255,0.18)",
                width: 16,
                height: 16,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.42)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.18)";
              }}
              title="编辑这棵树"
            >
              <Pencil size={10} strokeWidth={2.5} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete();
              }}
              onPointerDown={(e) => {
                // 阻止冒泡到外层 div 的拖拽/点击逻辑
                e.stopPropagation();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
              }}
              aria-label="拔除这棵树"
              className="ml-0.5 rounded-full flex items-center justify-center pointer-events-auto transition-colors"
              style={{ 
                background: "rgba(255,255,255,0.18)",
                width: 16,
                height: 16,
              }}
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
    </div>
  );
}

/** 漂浮云朵 */

/** 阳光光斑 */

export default function ForestScene({
  items,
  skin,
  height = 360,
  fillHeight = false,
  onItemClick,
  onItemDelete,
  onItemEdit,
  onItemPositionChange,
  onItemScaleChange,
  selectedId,
  variant = "my",
  draggable = true,
  resetTrigger,
  focusTreeId,
}: ForestSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
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
      // y 分布：25-75%（画布中间 50% 区域），上下都有空间
      const yBase = 25 + (autoIndex % 4) * 12;
      const yJitter = (((h >> 8) % 80) / 10 - 4);
      const y = Math.max(20, Math.min(75, yBase + yJitter));
      const treeScale = total <= 1 ? 1 : total <= 2 ? 0.55 : total <= 3 ? 0.4 : total <= 5 ? 0.32 : total <= 8 ? 0.26 : total <= 12 ? 0.22 : 0.19;
      return { item, x, y, treeScale };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, itemsKey]);

  // 画布平移状态（相对物理画布的偏移，单位 px）
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // zoom 固定为 1（不再支持缩放）
  const zoom = 1;
  const [panning, setPanning] = useState(false);
  // 焦点高亮 pulse：被 focus 的树 id（2.4s 后自动清空）
  const [focusPulseId, setFocusPulseId] = useState<string | null>(null);
  const panStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const canvasPannedRef = useRef(false); // 画布本次按下-抬起是否发生实际平移
  const PAN_THRESHOLD_PX = 4; // 平移阈值（像素）

  // 物理画布尺寸（比可视区大，给平移留空间）
  // 横向 200% 给左右平移空间，纵向 200% 给上下平移空间
  // zoom 缩放会等比调整 inner 实际尺寸，pan 范围也按 zoom 反比放大
  const CANVAS_W = 100; // % 相对外层可视区（inner = sceneRef，树永远在屏幕内）
  const CANVAS_H = 100; // % 相对外层可视区

  // 从 localStorage 读取画布平移和缩放（持久化）
  useEffect(() => {
    try {
      const rawPan = localStorage.getItem("forest-canvas-pan");
      if (rawPan) {
        const saved = JSON.parse(rawPan);
        if (
          typeof saved?.x === "number" &&
          typeof saved?.y === "number" &&
          Math.abs(saved.x) <= 200 &&
          Math.abs(saved.y) <= 200
        ) {
          setPan({ x: saved.x, y: saved.y });
        }
      }
    } catch {}
  }, []);

  // 外部触发画布复位：resetTrigger 每次变化时把画布 pan 归零并恢复 zoom
  useEffect(() => {
    if (resetTrigger === undefined) return;
    setPan({ x: 0, y: 0 });
    try {
      localStorage.removeItem("forest-canvas-pan");
    } catch {}
  }, [resetTrigger]);

  // 外部触发 focus 树：focusTreeId 变化时，pan 调整到让该树在可视区中央 + 短暂高亮 pulse
  useEffect(() => {
    if (!focusTreeId) return;
    const target = items.find((it) => it.id === focusTreeId);
    if (!target) return;
    // 触发高亮 pulse：2.4s 后清除（不 pan，树永远在屏幕内）
    setFocusPulseId(focusTreeId);
    const t = setTimeout(() => {
      setFocusPulseId((cur) => (cur === focusTreeId ? null : cur));
    }, 2400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTreeId]);

  // 外部触发"鸟瞰"：计算所有树的总中心，pan 让总中心对齐可视区中心 + zoom 归 1
  // 用于"拖完树后找不到树了"的一键复位
  // 平移限制：禁用（画布不动，树永远在屏幕内）
  // inner = sceneRef（100%×100%），pan 固定为 {x:0, y:0}

  // 画布拖拽处理（禁用：所有树永远在屏幕内，不需要拖画布）
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // 禁用画布拖动
      return;
    },
    []
  );
  const handleCanvasPointerMove = useCallback(() => {}, []);
  const handleCanvasPointerEnd = useCallback(() => {}, []);

  // 关键样式：画布背景跟日历主页主题色保持一致
  const sceneStyle: React.CSSProperties = {
    ...(fillHeight ? { height: "100%" } : { height }),
    background: skin.panelBg,
    borderRadius: fillHeight ? 0 : 16,
    // 不裁切：树的拖动范围不限于可视区
    overflow: "visible",
    position: "relative",
  };

  return (
    <>
      <style>{`
        @keyframes pulseRing {
          0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
          50%      { opacity: 0.2; transform: translateX(-50%) scale(1.2); }
        }
        @keyframes focusPulse {
          0%   { transform: translateX(-50%) scale(1); }
          40%  { transform: translateX(-50%) scale(1.06); }
          100% { transform: translateX(-50%) scale(1); }
        }
        @keyframes focusRing {
          0%   { opacity: 0.85; transform: translate(-50%, -50%) scale(0.5); }
          80%  { opacity: 0;    transform: translate(-50%, -50%) scale(1.6); }
          100% { opacity: 0;    transform: translate(-50%, -50%) scale(1.6); }
        }
      `}</style>

      <div
        ref={sceneRef}
        style={{
          ...sceneStyle,
          cursor: panning ? "grabbing" : "grab",
          touchAction: "none",
        }}
        className={fillHeight ? "w-full h-full" : "w-full"}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerEnd}
        onPointerCancel={handleCanvasPointerEnd}
      >
        {/* 内层物理画布：所有内容在内层，支持平移和缩放
            画布背景用主题色（跟日历主页背景保持一致） */}
        <div
          ref={innerRef}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${CANVAS_W * zoom}%`,
            height: `${CANVAS_H * zoom}%`,
            transform: `translate(-50%, -50%) translate(${-pan.x}%, ${-pan.y}%)`,
            transition: panning ? "none" : "transform 0.35s ease-out",
            // inner 退化为纯 transform 容器：不画背景、不裁切、树的拖动范围不再受 inner 边界限制
            overflow: "visible",
          }}
        >
        {/* 树木 */}
        {layout.map(({ item, x, y }, i) => (
          <div
            key={`wrap-${item.id}`}
            data-forest-tree
            style={{ display: "contents" }}
          >
          <ForestTree
            key={item.id}
            item={item}
            x={x}
            y={y}
            selected={item.id === selectedId}
            focused={item.id === focusPulseId || focusPulseId === "__all__"}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            onDelete={onItemDelete ? () => onItemDelete(item.id) : undefined}
            onEdit={onItemEdit ? () => onItemEdit(item.id) : undefined}
            onPositionChange={
              onItemPositionChange
                ? (p) => onItemPositionChange(item.id, p)
                : undefined
            }
            onScaleChange={
              onItemScaleChange
                ? (s) => onItemScaleChange(item.id, s)
                : undefined
            }
            draggable={draggable && variant === "my"}
            skin={skin}
            variant={variant}
            index={i}
            zoom={zoom}
            sceneRect={sceneRef}
            innerRect={innerRef}
          />
          </div>
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

      </div>
    </>
  );
}
