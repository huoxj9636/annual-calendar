"use client";

/**
 * ForestScene - 森林全景场景画布
 *
 * 设计意象：清晨薄雾笼罩的山谷森林
 * 四层透视：晨空 → 远山 → 中景 → 草地
 * 树苗按节点数量成长为不同阶段
 */

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Cloud, Sun, X, TreeDeciduous, Maximize2, Minimize2 } from "lucide-react";
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
  /**
   * 画布复位触发器：每次变化时，ForestScene 内部自动把画布 pan 归零 + 清空 localStorage。
   * 用于"创建新树后自动把画布定位到让新树在中心"。
   */
  resetTrigger?: number;
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
      const rect = sceneRect.current?.getBoundingClientRect();
      if (!rect) return;
      // 计算指针在画布中的位置（百分比）
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      // 当前树的底部锚点位置
      const itemX = x;
      const itemY = y;
      startRef.current = { pointerX: px, pointerY: py, itemX, itemY };
      wasDraggedRef.current = false;
      setDragOffset({ dx: 0, dy: 0 });
      setDragging(true);
      btn.setPointerCapture(e.pointerId);
      e.stopPropagation();
    },
    [draggable, sceneRect, x, y]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || !startRef.current) return;
      const rect = sceneRect.current?.getBoundingClientRect();
      if (!rect) return;
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      // left: 0% 在画布最左 → 指针向右 px 增大 → dx 应为 + (left 增大)
      // bottom: 0% 在画布最底 → 指针向下 py 增大 → bottom 应减小 → dy 应为 - (py 增量取反)
      const dx = px - startRef.current.pointerX;
      const dy = -(py - startRef.current.pointerY);
      // 用像素距离判断是否真的在拖动（避免抖动被识别为点击失败）
      const rectForDist = sceneRect.current?.getBoundingClientRect();
      if (rectForDist) {
        const dPx = Math.hypot(
          (px - startRef.current.pointerX) * rectForDist.width / 100,
          (py - startRef.current.pointerY) * rectForDist.height / 100
        );
        if (dPx > DRAG_THRESHOLD_PX) {
          wasDraggedRef.current = true;
        }
      }
      setDragOffset({ dx, dy });
    },
    [dragging, sceneRect]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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
      // bottom 坐标系与屏幕 Y 反向：指针向下时 bottom 减小
      const newY = Math.max(2, Math.min(95, startRef.current.itemY - (py - startRef.current.pointerY)));
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
    </div>
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
        { top: 12, delay: 6, duration: 46, scale: 0.85 },
        { top: 22, delay: 20, duration: 50, scale: 0.6 },
        { top: 4, delay: 32, duration: 42, scale: 1.1 },
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
            left: -300,
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
    { left: 12, top: 22, size: 120, delay: 0 },
    { left: 35, top: 12, size: 160, delay: 1.5 },
    { left: 55, top: 30, size: 100, delay: 3 },
    { left: 72, top: 18, size: 140, delay: 0.8 },
    { left: 88, top: 28, size: 110, delay: 2.2 },
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
  resetTrigger,
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
  // 画布缩放：1 = 原始 200%×200%，0.5 = 鸟瞰全图（看全整个画布边界）
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
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
  const CANVAS_W = 200; // % 相对外层可视区
  const CANVAS_H = 200; // % 相对外层可视区
  const ZOOM_MIN = 0.4; // 最大缩小 0.4 倍（让 200% 画布缩小到 80% 视口）
  const ZOOM_MAX = 1.2; // 最大放大 1.2 倍
  const isBirdseye = zoom <= 0.55; // 鸟瞰模式（缩到刚好能看全画布）

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
      const rawZoom = localStorage.getItem("forest-canvas-zoom");
      if (rawZoom) {
        const z = parseFloat(rawZoom);
        if (!isNaN(z) && z >= ZOOM_MIN && z <= ZOOM_MAX) {
          setZoom(z);
        }
      }
    } catch {}
  }, []);

  // 外部触发画布复位：resetTrigger 每次变化时把画布 pan 归零并恢复 zoom
  useEffect(() => {
    if (resetTrigger === undefined) return;
    setPan({ x: 0, y: 0 });
    setZoom(1);
    try {
      localStorage.removeItem("forest-canvas-pan");
      localStorage.removeItem("forest-canvas-zoom");
    } catch {}
  }, [resetTrigger]);

  // 平移限制：保证物理画布始终有内容覆盖可视区
  // 物理画布 200%，pan 范围 [-50, 50]（pan=0 是中心）
  // pan=+50：可视区看到物理画布 0-50% 区域（左边）
  // pan=-50：可视区看到物理画布 50-100% 区域（右边）
  // pan 范围随 zoom 反比放大：zoom 越小（画布越小），允许的 pan 范围越大
  // 物理画布 200%×200%，zoom 缩放后 inner 实际尺寸 200%×zoom
  // 视口只能看到 100% 视口宽，要让 inner 任意边界对齐视口边界，pan 范围 = 50 / zoom
  const panRange = 50 / zoom;
  const clampPan = useCallback((x: number, y: number) => {
    const r = 50 / zoom;
    return {
      x: Math.max(-r, Math.min(r, x)),
      y: Math.max(-r, Math.min(r, y)),
    };
  }, [zoom]);

  // 画布拖拽处理
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // 仅在 my 变体支持画布拖动
      if (variant !== "my") return;
      // 仅主按钮（左键 / touch）
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // 排除树和删除按钮（树的 pointerdown 会 stopPropagation，所以这里能进来说明按的是空白处）
      // 但保险起见再检查一次
      if (target.closest("[data-forest-tree]") || target.closest("[data-forest-delete]")) {
        return;
      }
      e.preventDefault();
      panStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      canvasPannedRef.current = false;
      setPanning(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    },
    [pan, variant]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!panning || !panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.pointerX;
      const dy = e.clientY - panStartRef.current.pointerY;
      if (Math.hypot(dx, dy) > PAN_THRESHOLD_PX) {
        canvasPannedRef.current = true;
      }
      // 把像素转成 %（外层可视区宽/高）
      const rect = sceneRef.current?.getBoundingClientRect();
      if (!rect) return;
      // 保护：rect 宽高为 0 时（fillHeight 父容器未布局）使用回退值
      const w = rect.width > 0 ? rect.width : 360;
      const h = rect.height > 0 ? rect.height : 360;
      const dxPct = (dx / w) * 100;
      const dyPct = (dy / h) * 100;
      // 拖动方向 = 画布内容跟随手指（drag mode）
      // 向左拖 (dx<0) → panX 增大 → translate(-panX%) 内层向左移 → 看到画布右边内容
      // 向上拖 (dy<0) → panY 增大 → translate(-panY%) 内层向上移 → 看到画布下方内容
      setPan(
        clampPan(panStartRef.current.panX - dxPct, panStartRef.current.panY - dyPct)
      );
    },
    [panning, clampPan]
  );

  const handleCanvasPointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!panning) {
        panStartRef.current = null;
        return;
      }
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setPanning(false);
      panStartRef.current = null;
      // 持久化
      try {
        localStorage.setItem("forest-canvas-pan", JSON.stringify(pan));
        localStorage.setItem("forest-canvas-zoom", String(zoom));
      } catch {}
    },
    [panning, pan, zoom]
  );

  // 鸟瞰全图：把画布缩放到刚好能看全 200%×200% 物理画布边界
  // 物理画布 200%×200% = 720×720，视口 360×360
  // 要看全 → 缩放比例 360/720 = 0.5，加上 pan=0 让画布居中
  const handleBirdseye = useCallback(() => {
    setZoom(0.5);
    setPan({ x: 0, y: 0 });
    try {
      localStorage.setItem("forest-canvas-zoom", "0.5");
      localStorage.setItem(
        "forest-canvas-pan",
        JSON.stringify({ x: 0, y: 0 })
      );
    } catch {}
  }, []);

  // 退出鸟瞰：恢复 zoom=1（pan 保持）
  const handleExitBirdseye = useCallback(() => {
    setZoom(1);
    try {
      localStorage.setItem("forest-canvas-zoom", "1");
    } catch {}
  }, []);

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
          100% { transform: translateX(calc(200vw + 400px)) scale(var(--s, 1)); }
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
            物理画布 200%×200%，zoom=1 时正常显示，zoom=0.5 时鸟瞰全图
            pan 范围 [-50/zoom, 50/zoom]，pan=0 时画布居中（看到画布中点） */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${CANVAS_W * zoom}%`,
            height: `${CANVAS_H * zoom}%`,
            transform: `translate(-50%, -50%) translate(${-pan.x}%, ${-pan.y}%)`,
            transition: panning ? "none" : "transform 0.35s ease-out",
          }}
        >
        {/* 晨曦太阳 */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: "85%",
            top: "6%",
            color: "#FFD27A",
            filter: "drop-shadow(0 0 16px rgba(255, 210, 122, 0.5))",
            animation: "sunbeamPulse 6s ease-in-out infinite",
          }}
        >
          <Sun size={48} fill="currentColor" strokeWidth={1} />
        </div>

        {/* 漂浮云朵 */}
        <DriftingClouds />

        {/* 远山（三层叠加，从远到近）—— 扩展到整个物理画布宽度（200%×200%） */}
        <svg
          className="absolute inset-x-0 bottom-0 w-full pointer-events-none"
          viewBox="0 0 2000 220"
          preserveAspectRatio="none"
          style={{ height: "85%" }}
        >
          {/* 最远山：连绵圆润的低矮山脊（横跨整个物理画布） */}
          <path
            d="M0,180 Q40,150 80,160 Q140,135 200,150 Q260,125 320,145 Q400,120 480,135 Q560,115 640,130 Q720,110 800,135 Q880,125 960,140 Q1040,118 1120,140 Q1180,128 1240,145 Q1300,125 1360,142 Q1420,120 1480,135 Q1540,115 1600,130 Q1660,108 1720,128 Q1780,118 1840,135 Q1900,122 1960,138 L2000,142 L2000,220 L0,220 Z"
            fill={skin.swatch}
            opacity={0.14}
          />
          {/* 中景山：连绵圆润 + 多座不对称多棱角山峰 */}
          <path
            d="M0,200 Q60,170 130,185 Q200,160 280,175 Q360,140 440,170 Q500,158 540,168 L555,148 L570,128 L585,112 L600,100 L615,118 L628,138 L640,160 L660,168 Q740,150 820,170 Q880,160 940,178 Q1000,155 1080,172 Q1140,142 1200,168 Q1260,158 1320,172 L1340,148 L1360,128 L1380,108 L1400,92 L1420,112 L1438,135 L1452,158 L1475,168 Q1540,150 1620,170 Q1700,160 1780,175 Q1860,160 1940,170 L2000,175 L2000,220 L0,220 Z"
            fill={skin.swatch}
            opacity={0.22}
          />
          {/* 近山：圆润丘陵 + 多座不对称多棱角山峰（重复覆盖整个物理画布） */}
          <path
            d="M0,215 Q60,195 130,205 Q190,185 250,200 Q280,180 300,188 L315,160 L330,138 L345,118 L362,132 L378,150 L395,170 Q420,188 480,205 Q510,195 540,205 Q570,180 590,192 L605,158 L620,138 L635,118 L650,108 L665,128 L680,148 L695,168 Q720,188 770,205 Q800,195 850,205 Q890,180 920,195 L935,168 L950,148 L965,128 L980,118 L995,138 L1010,158 L1025,178 Q1050,195 1100,205 Q1140,195 1180,200 Q1215,180 1240,192 L1255,160 L1270,138 L1285,118 L1300,108 L1315,128 L1330,148 L1345,168 Q1370,188 1420,205 Q1460,195 1500,205 Q1535,180 1555,192 L1570,158 L1585,138 L1600,118 L1615,108 L1630,128 L1645,148 L1660,168 Q1685,188 1740,205 Q1780,195 1820,205 Q1860,180 1880,192 L1895,160 L1910,138 L1925,118 L1940,108 L1955,128 L1970,148 L1985,168 L2000,200 L2000,220 L0,220 Z"
            fill={skin.swatch}
            opacity={0.32}
          />
        </svg>

        {/* 草地（覆盖整个物理画布宽度） */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: "45%",
            background: `linear-gradient(180deg, ${skin.swatch}30 0%, ${skin.swatch}50 100%)`,
          }}
        />

        {/* 阳光光斑 */}
        <Sunbeams />

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

        {/* 鸟瞰全图 / 退出鸟瞰 按钮：缩放画布到刚好能看全 200% 物理画布边界 */}
        {variant === "my" && items.length > 0 && !isBirdseye && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleBirdseye();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute z-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs shadow-md hover:scale-105 transition-transform"
            style={{
              left: 12,
              top: 12,
              background: `${skin.swatch}cc`,
              color: "white",
              backdropFilter: "blur(8px)",
            }}
            aria-label="鸟瞰全图"
            title="鸟瞰全图：缩小到能看全画布边界"
          >
            <Maximize2 size={12} />
            <span>鸟瞰全图</span>
          </button>
        )}

        {variant === "my" && isBirdseye && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleExitBirdseye();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute z-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs shadow-md hover:scale-105 transition-transform"
            style={{
              left: 12,
              top: 12,
              background: `${skin.swatch}cc`,
              color: "white",
              backdropFilter: "blur(8px)",
            }}
            aria-label="退出鸟瞰"
            title="退出鸟瞰：恢复正常缩放"
          >
            <Minimize2 size={12} />
            <span>退出鸟瞰</span>
          </button>
        )}
      </div>
    </>
  );
}
