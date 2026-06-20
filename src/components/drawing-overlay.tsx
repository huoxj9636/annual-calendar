'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { apiFetch, apiFire } from '@/lib/api-client';

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
          apiFire('/api/calendar-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'drawing', year: Number(yearMatch[1]), data: newStrokes }),
          });
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

    // Load strokes from API (with localStorage migration)
    useEffect(() => {
      (async () => {
        try {
          const yearMatch = storageKey.match(/(\d{4})/);
          if (yearMatch) {
            const year = yearMatch[1];
            const res = await apiFetch(`/api/calendar-data?type=drawing&year=${year}`);
            if (res) {
              const data = res;
              if (data.strokes && Array.isArray(data.strokes) && data.strokes.length > 0) {
                setStrokes(data.strokes);
              } else {
                // No data in DB — try migrating from localStorage
                try {
                  const lsData = localStorage.getItem(storageKey);
                  if (lsData) {
                    const lsStrokes = JSON.parse(lsData);
                    if (Array.isArray(lsStrokes) && lsStrokes.length > 0) {
                      setStrokes(lsStrokes);
                      // Migrate to DB
                      await apiFetch('/api/calendar-data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'drawing', year: Number(year), data: lsStrokes }),
                      });
                      // Remove from localStorage after successful migration
                      localStorage.removeItem(storageKey);
                    }
                  }
                } catch { /* ignore localStorage errors */ }
              }
            }
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
