'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  isEraser: boolean;
}

export interface DrawingOverlayHandle {
  drawingEnabled: boolean;
  setDrawingEnabled: (v: boolean) => void;
  tool: 'pen' | 'eraser';
  setTool: (v: 'pen' | 'eraser') => void;
  penColor: string;
  setPenColor: (v: string) => void;
  overlayVisible: boolean;
  setOverlayVisible: (v: boolean) => void;
  handleUndo: () => void;
  handleClear: () => void;
  hasStrokes: boolean;
}

interface DrawingOverlayProps {
  storageKey: string;
  visible: boolean;
}

const DrawingOverlay = forwardRef<DrawingOverlayHandle, DrawingOverlayProps>(
  function DrawingOverlay({ storageKey, visible }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
    const [penColor, setPenColor] = useState('#ef4444');
    const penWidth = 3;
    const [drawingEnabled, setDrawingEnabled] = useState(false);
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [canvasReady, setCanvasReady] = useState(false);

    // Keep ref in sync
    useEffect(() => {
      strokesRef.current = strokes;
    }, [strokes]);

    const saveStrokes = useCallback((newStrokes: Stroke[]) => {
      try {
        // Extract year from storageKey like "calendar-drawing-2025"
        const yearMatch = storageKey.match(/(\d{4})/);
        if (yearMatch) {
          fetch('/api/calendar-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'drawing', year: Number(yearMatch[1]), data: newStrokes }),
          }).catch(() => {});
        }
      } catch { /* ignore */ }
    }, [storageKey]);

    const handleUndo = useCallback(() => {
      setStrokes(prev => {
        const newStrokes = prev.slice(0, -1);
        saveStrokes(newStrokes);
        return newStrokes;
      });
    }, [saveStrokes]);

    const handleClear = useCallback(() => {
      setStrokes([]);
      saveStrokes([]);
    }, [saveStrokes]);

    // Expose handle
    useImperativeHandle(ref, () => ({
      drawingEnabled,
      setDrawingEnabled,
      tool,
      setTool,
      penColor,
      setPenColor,
      overlayVisible,
      setOverlayVisible,
      handleUndo,
      handleClear,
      hasStrokes: strokes.length > 0,
    }), [drawingEnabled, tool, penColor, overlayVisible, strokes.length, handleUndo, handleClear]);

    // Load strokes: localStorage 永远优先（用户最近操作的真相），DB 作为兜底
    useEffect(() => {
      (async () => {
        try {
          const yearMatch = storageKey.match(/(\d{4})/);
          if (!yearMatch) return;
          const year = yearMatch[1];

          // 1) 先看 localStorage
          let lsStrokes: Stroke[] | null = null;
          try {
            const lsRaw = localStorage.getItem(storageKey);
            if (lsRaw) {
              const parsed = JSON.parse(lsRaw);
              if (Array.isArray(parsed) && parsed.length > 0) lsStrokes = parsed;
            }
          } catch { /* ignore */ }

          // 2) 再看 DB
          let dbStrokes: Stroke[] | null = null;
          try {
            const res = await fetch(`/api/calendar-data?type=drawing&year=${year}`);
            if (res.ok) {
              const data = await res.json();
              if (data.strokes && Array.isArray(data.strokes) && data.strokes.length > 0) {
                dbStrokes = data.strokes;
              }
            }
          } catch { /* ignore */ }

          // 诊断日志（用户可在 console 看到发生了什么）
          // eslint-disable-next-line no-console
          console.log('[画布恢复诊断]', {
            year,
            localStorageCount: lsStrokes?.length ?? 0,
            dbCount: dbStrokes?.length ?? 0,
            source: lsStrokes ? 'localStorage' : (dbStrokes ? 'database' : 'empty'),
          });

          // 3) 优先级：localStorage > DB
          if (lsStrokes) {
            setStrokes(lsStrokes);
            // 同步到 DB（保证以后清缓存也不丢）
            if (!dbStrokes || dbStrokes.length !== lsStrokes.length) {
              try {
                await fetch('/api/calendar-data', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'drawing', year: Number(year), data: lsStrokes }),
                });
              } catch { /* ignore */ }
            }
            // 保留 localStorage 备份，不再 remove
          } else if (dbStrokes) {
            setStrokes(dbStrokes);
            // 备份到 localStorage
            try {
              localStorage.setItem(storageKey, JSON.stringify(dbStrokes));
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      })();
    }, [storageKey]);

    // Redraw function
    const redraw = useCallback((current: Stroke | null = null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const allStrokes = current ? [...strokesRef.current, current] : strokesRef.current;

      for (const stroke of allStrokes) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (stroke.isEraser) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.lineWidth = stroke.width * 4;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width;
        }

        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
    }, []);

    // Resize canvas and redraw
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;

      const resize = () => {
        const rect = parent.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = rect.width;
          canvas.height = rect.height;
          setCanvasReady(true);
          // Redraw after resize since setting canvas.width clears content
          redraw();
        }
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(parent);
      return () => observer.disconnect();
    }, [redraw]);

    // Redraw when strokes change
    useEffect(() => {
      if (canvasReady) {
        redraw(currentStroke);
      }
    }, [strokes, currentStroke, canvasReady, redraw]);

    const getPos = (e: React.MouseEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      if (!drawingEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = getPos(e);
      const stroke: Stroke = {
        points: [pos],
        color: penColor,
        width: penWidth,
        isEraser: tool === 'eraser',
      };
      setCurrentStroke(stroke);
      setIsDrawing(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDrawing || !currentStroke) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = getPos(e);
      setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pos] } : null);
    };

    const handleMouseUp = () => {
      if (!isDrawing || !currentStroke) return;
      const newStrokes = [...strokes, currentStroke];
      setStrokes(newStrokes);
      saveStrokes(newStrokes);
      setCurrentStroke(null);
      setIsDrawing(false);
    };

    if (!visible) return null;

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-30"
        style={{
          pointerEvents: drawingEnabled ? 'auto' : 'none',
          opacity: overlayVisible ? 0.6 : 0,
          transition: 'opacity 0.3s',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    );
  }
);

export default DrawingOverlay;
