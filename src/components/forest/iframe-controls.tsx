"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

const STORAGE_KEY = "iframe-control-pos";
const DRAG_THRESHOLD = 4;
const BTN_SIZE = 40;
const SAFE_MARGIN = 8;

const DEFAULT_RETURN: Point = { x: SAFE_MARGIN, y: SAFE_MARGIN };
const DEFAULT_EXTERNAL: Point = { x: SAFE_MARGIN, y: SAFE_MARGIN };

function loadStoredPos(): { return: Point; external: Point } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{
      return: Point;
      external: Point;
    }>;
    if (!parsed?.return || !parsed?.external) return null;
    return {
      return: { x: Number(parsed.return.x) || 0, y: Number(parsed.return.y) || 0 },
      external: { x: Number(parsed.external.x) || 0, y: Number(parsed.external.y) || 0 },
    };
  } catch {
    return null;
  }
}

function saveStoredPos(pos: { return: Point; external: Point }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore quota / privacy mode
  }
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function useWindowSize() {
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const update = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

/**
 * Make an absolutely-positioned element draggable.
 *
 * - Drag starts after a small pointer movement threshold to avoid stealing
 *   normal clicks.
 * - Position is clamped to the current viewport so the button never escapes.
 * - Position changes can be persisted through the optional `onChange` callback.
 */
function useDraggable(initial: Point, onChange?: (next: Point) => void) {
  const [pos, setPos] = useState<Point>(initial);
  const [dragging, setDragging] = useState(false);

  const stateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    moved: false,
  });

  const setPosRef = useRef(setPos);
  setPosRef.current = setPos;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      stateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
        moved: false,
      };
    },
    [pos.x, pos.y]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const s = stateRef.current;
      if (s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      s.moved = true;
      const maxX = Math.max(SAFE_MARGIN, window.innerWidth - BTN_SIZE - SAFE_MARGIN);
      const maxY = Math.max(SAFE_MARGIN, window.innerHeight - BTN_SIZE - SAFE_MARGIN);
      const next: Point = {
        x: clamp(s.origX + dx, SAFE_MARGIN, maxX),
        y: clamp(s.origY + dy, SAFE_MARGIN, maxY),
      };
      setPosRef.current(next);
      onChangeRef.current?.(next);
      if (!dragging) setDragging(true);
    },
    [dragging]
  );

  const wasDraggingRef = useRef(false);

  const finishDrag = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const s = stateRef.current;
      if (s.pointerId !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      wasDraggingRef.current = s.moved;
      stateRef.current = {
        pointerId: null,
        startX: 0,
        startY: 0,
        origX: 0,
        origY: 0,
        moved: false,
      };
      if (s.moved) {
        setTimeout(() => {
          wasDraggingRef.current = false;
          setDragging(false);
        }, 0);
      }
    },
    []
  );

  return {
    pos,
    setPos,
    dragging,
    wasDraggingRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
  };
}

export function IframeControls({
  treeName,
  treeLink,
  onBack,
}: {
  treeName: string;
  treeLink: string;
  onBack: () => void;
}) {
  const mounted = useMounted();
  const { w, h } = useWindowSize();

  const stored = useRef<{ return: Point; external: Point } | null>(null);
  if (stored.current === null && typeof window !== "undefined") {
    stored.current = loadStoredPos();
  }
  const fallback = {
    return: DEFAULT_RETURN,
    external: {
      x: typeof window !== "undefined"
        ? window.innerWidth - BTN_SIZE - SAFE_MARGIN
        : SAFE_MARGIN,
      y: SAFE_MARGIN,
    },
  };
  const initial = stored.current ?? fallback;

  const returnCtrl = useDraggable(initial.return);
  const externalCtrl = useDraggable(initial.external);

  // 任意一个按钮位置变化都同步写一次 localStorage。
  // 拖动过程中会高频触发，所以 setPos 时不再调 onChange，
  // 而是直接依赖 pos 这个 React state，React 会自动 dedupe。
  useEffect(() => {
    if (!mounted) return;
    saveStoredPos({ return: returnCtrl.pos, external: externalCtrl.pos });
  }, [mounted, returnCtrl.pos, externalCtrl.pos]);

  // Re-clamp on resize so a button that was placed on a wide monitor doesn't
  // end up off-screen on a smaller window.
  useEffect(() => {
    if (!mounted || w === 0) return;
    const clampTo = (p: Point): Point => {
      const maxX = Math.max(SAFE_MARGIN, w - BTN_SIZE - SAFE_MARGIN);
      const maxY = Math.max(SAFE_MARGIN, h - BTN_SIZE - SAFE_MARGIN);
      return { x: clamp(p.x, SAFE_MARGIN, maxX), y: clamp(p.y, SAFE_MARGIN, maxY) };
    };
    const r1 = clampTo(returnCtrl.pos);
    if (r1.x !== returnCtrl.pos.x || r1.y !== returnCtrl.pos.y) returnCtrl.setPos(r1);
    const r2 = clampTo(externalCtrl.pos);
    if (r2.x !== externalCtrl.pos.x || r2.y !== externalCtrl.pos.y) externalCtrl.setPos(r2);
  }, [w, h, mounted, returnCtrl, externalCtrl]);

  if (!mounted) return null;

  // 两个按钮用同一套主题色 + 同一套尺寸，确保视觉一致 + 拖拽手感一致。
  // 新窗口按钮改用 <button> + window.open，避免 <a href target=_blank>
  // 拦截 pointer 事件 / 系统拖拽行为造成的"拖拽不灵敏"。
  const baseClass =
    "fixed z-[80] w-8 h-8 rounded-full shadow-md flex items-center justify-center select-none transition-transform duration-150 ease-out";

  const handleReturnClick = (e: React.MouseEvent) => {
    if (returnCtrl.wasDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onBack();
  };

  const handleExternalClick = (e: React.MouseEvent) => {
    if (externalCtrl.wasDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    window.open(treeLink, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <button
        type="button"
        aria-label="返回森林"
        title={`返回森林（${treeName}）`}
        onClick={handleReturnClick}
        className={`${baseClass} bg-primary text-primary-foreground hover:scale-110 active:scale-95 ${
          returnCtrl.dragging ? "cursor-grabbing scale-110 ring-2 ring-primary/40" : "cursor-grab"
        }`}
        style={{
          left: returnCtrl.pos.x,
          top: returnCtrl.pos.y,
          touchAction: "none",
        }}
        {...returnCtrl.handlers}
      >
        <ArrowLeftIcon size={16} />
      </button>

      <button
        type="button"
        aria-label="在新标签页打开"
        title="在新标签页打开"
        onClick={handleExternalClick}
        className={`${baseClass} bg-primary text-primary-foreground hover:scale-110 active:scale-95 ${
          externalCtrl.dragging ? "cursor-grabbing scale-110 ring-2 ring-primary/40" : "cursor-grab"
        }`}
        style={{
          left: externalCtrl.pos.x,
          top: externalCtrl.pos.y,
          touchAction: "none",
        }}
        {...externalCtrl.handlers}
      >
        <ExternalIcon size={15} />
      </button>
    </>
  );
}

function ArrowLeftIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function ExternalIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v7H3V3h7" />
    </svg>
  );
}
