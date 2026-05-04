'use client';

import { useState, useEffect, useRef } from 'react';
import type { SkinTheme } from '@/lib/skins';

interface InsightPanelProps {
  year: number;
  month: number;
  day: number;
  skin: SkinTheme;
  onClose: () => void;
}

export default function InsightPanel({ year, month, day, skin, onClose }: InsightPanelProps) {
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const insightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day]);

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (insightRef.current) {
      insightRef.current.scrollTop = insightRef.current.scrollHeight;
    }
  }, [insight]);

  const fetchInsight = async () => {
    setLoading(true);
    setError('');
    setInsight('');

    try {
      // Gather user's data for this day
      let events: unknown[] = [];
      let todos: unknown[] = [];
      let overrideStatus = '';

      try {
        const evtsRaw = localStorage.getItem(`dayview-events-${year}-${month}-${day}`);
        if (evtsRaw) events = JSON.parse(evtsRaw);
      } catch { /* empty */ }
      try {
        const todosRaw = localStorage.getItem(`dayview-todos-${year}-${month}-${day}`);
        if (todosRaw) todos = JSON.parse(todosRaw);
      } catch { /* empty */ }
      try {
        const overridesRaw = localStorage.getItem(`calendar-overrides-${year}`);
        if (overridesRaw) {
          const overrides = JSON.parse(overridesRaw);
          overrideStatus = overrides[`${year}-${month}-${day}`] || '';
        }
      } catch { /* empty */ }

      const response = await fetch('/api/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, day, events, todos, overrides: overrideStatus }),
      });

      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setInsight(prev => prev + parsed.content);
              } else if (parsed.error) {
                setError(parsed.error);
              }
            } catch { /* skip malformed lines */ }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取洞察失败');
    } finally {
      setLoading(false);
    }
  };

  const s = skin;

  return (
    <div className="absolute top-0 right-0 bottom-0 z-40 flex flex-col overflow-hidden"
      style={{ backgroundColor: s.panelBg, left: '90px' }}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 relative overflow-hidden flex-shrink-0"
        style={s.headerBgImage
          ? { backgroundImage: `url(${s.headerBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: `linear-gradient(135deg, ${s.headerFrom} 0%, ${s.headerTo} 100%)` }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${s.sidebarFrom}dd, ${s.sidebarTo}cc)` }} />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="text-white/60 text-xs font-medium tracking-wider mb-0.5">DAILY INSIGHT</div>
            <div className="text-white text-2xl font-bold">{month}月{day}日 洞察</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors z-20 cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={insightRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {loading && !insight && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${s.swatch}40`, borderTopColor: s.swatch }} />
            <span style={{ color: s.textMuted }} className="text-sm">正在分析你的时间数据...</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {insight && (
          <div className="rounded-xl p-5 text-sm leading-relaxed whitespace-pre-wrap" style={{ backgroundColor: s.cardBg, color: s.textPrimary }}>
            {insight}
          </div>
        )}

        {loading && insight && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${s.swatch}40`, borderTopColor: s.swatch }} />
            <span style={{ color: s.textMuted }} className="text-xs">继续分析中...</span>
          </div>
        )}

        {!loading && insight && (
          <button
            onClick={fetchInsight}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 cursor-pointer"
            style={{ backgroundColor: `${s.swatch}15`, color: s.swatch }}
          >
            重新分析
          </button>
        )}
      </div>
    </div>
  );
}
