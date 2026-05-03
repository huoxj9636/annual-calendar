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
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
    const [penColor, setPenColor] = useState('#ef4444');
    const penWidth = 3;
    const [drawingEnabled, setDrawingEnabled] = useState(false);
    const [overlayVisible, setOverlayVisible] = useState(true);

    const handleUndo = useCallback(() => {
      setStrokes(prev => {
        const newStrokes = prev.slice(0, -1);
        try { localStorage.setItem(storageKey, JSON.stringify(newStrokes)); } catch { /* ignore */ }
        return newStrokes;
      });
    }, [storageKey]);

    const handleClear = useCallback(() => {
      setStrokes([]);
      try { localStorage.setItem(storageKey, JSON.stringify([])); } catch { /* ignore */ }
    }, [storageKey]);

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

    // Load strokes from localStorage
    useEffect(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setStrokes(JSON.parse(saved) as Stroke[]);
        }
      } catch { /* ignore */ }
    }, [storageKey]);

    // Resize canvas to match parent
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;

      const resize = () => {
        const rect = parent.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(parent);
      return () => observer.disconnect();
    }, []);

    // Redraw all strokes
    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

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
    }, [strokes, currentStroke]);

    useEffect(() => {
      redraw();
    }, [redraw]);

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
      try { localStorage.setItem(storageKey, JSON.stringify(newStrokes)); } catch { /* ignore */ }
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
