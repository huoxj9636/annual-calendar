'use client';

import { useState, useEffect, useRef } from 'react';
import type { SkinTheme } from '@/lib/skins';

interface TrackPanelProps {
  year: number;
  skin: SkinTheme;
  onClose: () => void;
}

export default function TrackPanel({ year, skin, onClose }: TrackPanelProps) {
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const analysisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (analysisRef.current) {
      analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
    }
  }, [analysis]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError('');
    setAnalysis('');

    try {
      // Gather all data for the selected period
      const summaryLines: string[] = [];

      for (let m = startMonth; m <= endMonth; m++) {
        const daysInMonth = new Date(year, m, 0).getDate();
        let monthSummary = `\n【${m}月】\n`;

        // Get overrides (satisfaction)
        let satisfied = 0;
        let crossed = 0;
        try {
          const overridesRaw = localStorage.getItem(`calendar-overrides-${year}`);
          if (overridesRaw) {
            const overrides = JSON.parse(overridesRaw);
            for (let d = 1; d <= daysInMonth; d++) {
              const key = `${year}-${m}-${d}`;
              if (overrides[key] === 'checked') satisfied++;
              else if (overrides[key] === 'crossed') crossed++;
            }
          }
        } catch { /* empty */ }
        monthSummary += `满意度：${satisfied}天满意，${crossed}天不满意\n`;

        // Get events and todos for each day
        let eventCount = 0;
        let todoCount = 0;
        let todoDoneCount = 0;
        const eventTitles: string[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          try {
            const evtsRaw = localStorage.getItem(`dayview-events-${year}-${m}-${d}`);
            if (evtsRaw) {
              const evts = JSON.parse(evtsRaw);
              eventCount += evts.length;
              evts.forEach((e: { title?: string; text?: string }) => {
                if (e.title || e.text) eventTitles.push(e.title || e.text || '');
              });
            }
          } catch { /* empty */ }
          try {
            const todosRaw = localStorage.getItem(`dayview-todos-${year}-${m}-${d}`);
            if (todosRaw) {
              const todos = JSON.parse(todosRaw);
              todoCount += todos.length;
              todos.forEach((t: { done?: boolean }) => { if (t.done) todoDoneCount++; });
            }
          } catch { /* empty */ }
        }
        monthSummary += `日程：${eventCount}个，待办：${todoCount}个（已完成${todoDoneCount}个）\n`;
        if (eventTitles.length > 0) {
          monthSummary += `主要日程：${eventTitles.slice(0, 10).join('、')}\n`;
        }

        summaryLines.push(monthSummary);
      }

      const response = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: `${year}年${startMonth}月`,
          endDate: `${year}年${endMonth}月`,
          summary: summaryLines.join('\n'),
        }),
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
                setAnalysis(prev => prev + parsed.content);
              } else if (parsed.error) {
                setError(parsed.error);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setLoading(false);
    }
  };

  const s = skin;

  return (
    <div className="absolute top-0 bottom-0 z-40 flex flex-col overflow-hidden"
      style={{ backgroundColor: s.panelBg, left: '64px', right: '-6px' }}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 relative overflow-hidden flex-shrink-0"
        style={s.headerBgImage
          ? { backgroundImage: `url(${s.headerBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: `linear-gradient(135deg, ${s.headerFrom} 0%, ${s.headerTo} 100%)` }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${s.sidebarFrom}55, ${s.sidebarTo}44)` }} />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="text-white/60 text-xs font-medium tracking-wider mb-0.5">LIFE TRACK</div>
            <div className="text-white text-2xl font-bold">轨迹分析</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors z-20 cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Time range selector */}
      <div className="px-5 py-3 flex items-center gap-3 border-b flex-shrink-0" style={{ borderColor: s.divider }}>
        <span className="text-sm font-medium" style={{ color: s.textSecondary }}>分析范围</span>
        <select
          value={startMonth}
          onChange={e => setStartMonth(Number(e.target.value))}
          className="px-2 py-1 rounded-lg text-sm border outline-none"
          style={{ backgroundColor: s.cardBg, color: s.textPrimary, borderColor: s.divider }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}月</option>
          ))}
        </select>
        <span style={{ color: s.textMuted }}>—</span>
        <select
          value={endMonth}
          onChange={e => setEndMonth(Number(e.target.value))}
          className="px-2 py-1 rounded-lg text-sm border outline-none"
          style={{ backgroundColor: s.cardBg, color: s.textPrimary, borderColor: s.divider }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}月</option>
          ))}
        </select>
        <button
          onClick={fetchAnalysis}
          disabled={loading}
          className="ml-auto px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-80 cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: s.swatch }}
        >
          {loading ? '分析中...' : '开始分析'}
        </button>
      </div>

      {/* Analysis content */}
      <div ref={analysisRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {!analysis && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={s.swatch} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.4}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span style={{ color: s.textMuted }} className="text-sm">选择时间范围，AI 将分析你的轨迹</span>
          </div>
        )}

        {loading && !analysis && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${s.swatch}40`, borderTopColor: s.swatch }} />
            <span style={{ color: s.textMuted }} className="text-sm">正在分析你的轨迹数据...</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {analysis && (
          <div className="rounded-xl p-5 text-sm leading-relaxed whitespace-pre-wrap" style={{ backgroundColor: s.cardBg, color: s.textPrimary }}>
            {analysis}
          </div>
        )}

        {loading && analysis && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${s.swatch}40`, borderTopColor: s.swatch }} />
            <span style={{ color: s.textMuted }} className="text-xs">继续分析中...</span>
          </div>
        )}
      </div>
    </div>
  );
}
