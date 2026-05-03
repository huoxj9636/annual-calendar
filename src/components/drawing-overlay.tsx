'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

interface DrawingOverlayProps {
  storageKey: string;
  visible: boolean;
}

export default function DrawingOverlay({ storageKey, visible }: DrawingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [penColor, setPenColor] = useState('#ef4444');
  const penWidth = 3;
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);

  // Load strokes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setStrokes(JSON.parse(saved) as Stroke[]);
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  // Save strokes to localStorage
  const saveStrokes = useCallback((s: Stroke[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(s));
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
    saveStrokes(newStrokes);
    setCurrentStroke(null);
    setIsDrawing(false);
  };

  const handleUndo = () => {
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    saveStrokes(newStrokes);
  };

  const handleClear = () => {
    setStrokes([]);
    saveStrokes([]);
  };

  if (!visible) return null;

  return (
    <>
      {/* Canvas overlay */}
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

      {/* Drawing toolbar */}
      <div
        className="absolute top-2 right-4 z-40 flex items-center gap-1.5 rounded-full px-2 py-1 shadow-lg transition-all"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        {/* Draw mode toggle */}
        <button
          onClick={() => setDrawingEnabled(!drawingEnabled)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all"
          style={{
            background: drawingEnabled ? '#ef4444' : 'rgba(0,0,0,0.06)',
            color: drawingEnabled ? 'white' : '#666',
          }}
          title={drawingEnabled ? '退出画笔' : '开启画笔'}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>

        {drawingEnabled && (
          <>
            {/* Pen tool */}
            <button
              onClick={() => setTool('pen')}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all"
              style={{
                background: tool === 'pen' ? '#3b82f6' : 'rgba(0,0,0,0.06)',
                color: tool === 'pen' ? 'white' : '#666',
              }}
              title="画笔"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="4" />
              </svg>
            </button>

            {/* Eraser tool */}
            <button
              onClick={() => setTool('eraser')}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all"
              style={{
                background: tool === 'eraser' ? '#3b82f6' : 'rgba(0,0,0,0.06)',
                color: tool === 'eraser' ? 'white' : '#666',
              }}
              title="橡皮擦"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.8 1.4c.8-.8 2-.8 2.8 0l5 5c.8.8.8 2 0 2.8L11 20" />
              </svg>
            </button>

            {/* Color options */}
            {['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'].map(c => (
              <button
                key={c}
                onClick={() => { setPenColor(c); setTool('pen'); }}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-125"
                style={{
                  backgroundColor: c,
                  borderColor: penColor === c ? '#1e293b' : 'transparent',
                }}
                title="选择颜色"
              />
            ))}

            {/* Undo */}
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all disabled:opacity-30"
              style={{ background: 'rgba(0,0,0,0.06)', color: '#666' }}
              title="撤销"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8" />
                <path d="M7 6l-4 4 4 4" />
              </svg>
            </button>

            {/* Clear all */}
            <button
              onClick={handleClear}
              disabled={strokes.length === 0}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all disabled:opacity-30"
              style={{ background: 'rgba(0,0,0,0.06)', color: '#666' }}
              title="清除全部"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </>
        )}

        {/* Show/hide overlay toggle (only if strokes exist) */}
        {strokes.length > 0 && (
          <button
            onClick={() => setOverlayVisible(!overlayVisible)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all"
            style={{
              background: overlayVisible ? 'rgba(0,0,0,0.06)' : 'rgba(239,68,68,0.1)',
              color: overlayVisible ? '#666' : '#ef4444',
            }}
            title={overlayVisible ? '隐藏画迹' : '显示画迹'}
          >
            {overlayVisible ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
        )}
      </div>
    </>
  );
}
