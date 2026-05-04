'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SkinTheme } from '@/lib/skins';

interface TrackPanelProps {
  year: number;
  skin: SkinTheme;
  onClose: () => void;
}

interface PlannedEvent {
  id: string;
  title: string;
  time: string;
  endTime?: string;
  color?: string;
  done?: boolean;
}

interface ActualTime {
  actualStart?: string;
  actualEnd?: string;
}

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

// Convert "HH:MM" to minutes from midnight
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Format minutes to "HH:MM"
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export default function TrackPanel({ year, skin, onClose }: TrackPanelProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [actualTimes, setActualTimes] = useState<Record<string, ActualTime>>({});
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plannedEvents, setPlannedEvents] = useState<PlannedEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const daysInMonth = new Date(year, selectedMonth, 0).getDate();

  // Load planned events for selected day
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem(`dayview-events-${year}-${selectedMonth}-${selectedDay}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setPlannedEvents(Array.isArray(parsed) ? parsed : []);
      } else {
        setPlannedEvents([]);
      }
    } catch {
      setPlannedEvents([]);
    }
  }, [year, selectedMonth, selectedDay, mounted]);

  // Load actual times
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem(`track-actual-${year}-${selectedMonth}-${selectedDay}`);
      if (raw) {
        setActualTimes(JSON.parse(raw));
      } else {
        setActualTimes({});
      }
    } catch {
      setActualTimes({});
    }
  }, [year, selectedMonth, selectedDay, mounted]);

  // Save actual times
  const saveActualTimes = useCallback((times: Record<string, ActualTime>) => {
    if (!mounted) return;
    setActualTimes(times);
    localStorage.setItem(`track-actual-${year}-${selectedMonth}-${selectedDay}`, JSON.stringify(times));
  }, [year, selectedMonth, selectedDay, mounted]);

  const updateActualTime = (eventId: string, field: 'actualStart' | 'actualEnd', value: string) => {
    const updated = {
      ...actualTimes,
      [eventId]: { ...actualTimes[eventId], [field]: value }
    };
    saveActualTimes(updated);
  };

  // Calculate delay for an event
  const getDelay = (event: PlannedEvent): number | null => {
    const actual = actualTimes[event.id];
    if (!actual?.actualStart || !event.time) return null;
    const plannedMin = timeToMinutes(event.time);
    const actualMin = timeToMinutes(actual.actualStart);
    return actualMin - plannedMin;
  };

  // Calculate duration difference
  const getDurationDiff = (event: PlannedEvent): number | null => {
    const actual = actualTimes[event.id];
    if (!actual?.actualStart || !actual?.actualEnd || !event.time || !event.endTime) return null;
    const plannedDur = timeToMinutes(event.endTime) - timeToMinutes(event.time);
    const actualDur = timeToMinutes(actual.actualEnd) - timeToMinutes(actual.actualStart);
    return actualDur - plannedDur;
  };

  // Fetch AI analysis
  const fetchAnalysis = async () => {
    setLoading(true);
    setError('');
    setAnalysis('');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Build comparison data
      const comparisonLines = plannedEvents.map(e => {
        const actual = actualTimes[e.id];
        const delay = getDelay(e);
        const durDiff = getDurationDiff(e);
        let line = `任务「${e.title}」：计划 ${e.time}${e.endTime ? `-${e.endTime}` : ''}`;
        if (actual?.actualStart) {
          line += `，实际 ${actual.actualStart}${actual.actualEnd ? `-${actual.actualEnd}` : ''}`;
        } else {
          line += `，未记录实际时间`;
        }
        if (delay !== null) {
          line += `，${delay > 0 ? `延迟${delay}分钟` : delay < 0 ? `提前${Math.abs(delay)}分钟` : '准时'}`;
        }
        if (durDiff !== null) {
          line += `，${durDiff > 0 ? `超时${durDiff}分钟` : durDiff < 0 ? `提前${Math.abs(durDiff)}分钟完成` : '按时完成'}`;
        }
        line += e.done ? '，已完成' : '，未完成';
        return line;
      }).join('\n');

      // Get satisfaction data for context
      let satisfactionInfo = '';
      try {
        const overridesRaw = localStorage.getItem(`calendar-overrides-${year}`);
        if (overridesRaw) {
          const overrides = JSON.parse(overridesRaw);
          let satisfied = 0, crossed = 0;
          for (let d = 1; d <= daysInMonth; d++) {
            const key = `${year}-${selectedMonth}-${d}`;
            if (overrides[key] === 'checked') satisfied++;
            else if (overrides[key] === 'crossed') crossed++;
          }
          satisfactionInfo = `当月满意度：${satisfied}天满意，${crossed}天不满意`;
        }
      } catch { /* empty */ }

      const response = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          date: `${year}年${selectedMonth}月${selectedDay}日`,
          plannedVsActual: comparisonLines,
          satisfaction: satisfactionInfo,
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
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : '分析失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const s = skin;

  // Timeline constants
  const TIMELINE_START = 6;
  const TIMELINE_END = 23;
  const TOTAL_HOURS = TIMELINE_END - TIMELINE_START;

  // Calculate bar position as percentage
  const getBarPosition = (time: string, endTime: string) => {
    const startMin = timeToMinutes(time);
    const endMin = timeToMinutes(endTime);
    const left = ((startMin - TIMELINE_START * 60) / (TOTAL_HOURS * 60)) * 100;
    const width = ((endMin - startMin) / (TOTAL_HOURS * 60)) * 100;
    return { left: Math.max(0, left), width: Math.max(0.5, width) };
  };

  return (
    <div className="absolute top-0 bottom-0 z-40 flex flex-col overflow-hidden"
      style={{ backgroundColor: s.panelBg, left: '64px', right: '-6px' }}>

      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b flex-shrink-0 flex items-center justify-between" style={{ borderColor: s.divider }}>
        <div>
          <div className="text-xs font-medium tracking-wider mb-0.5" style={{ color: s.swatch }}>LIFE TRACK</div>
          <div className="text-2xl font-bold" style={{ color: s.textPrimary }}>轨迹对照</div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer" style={{ backgroundColor: s.cardHover }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.textMuted} strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Date selector */}
      <div className="px-5 py-3 flex items-center gap-2 border-b flex-shrink-0" style={{ borderColor: s.divider }}>
        <select
          value={selectedMonth}
          onChange={e => { setSelectedMonth(Number(e.target.value)); setSelectedDay(1); }}
          className="px-2 py-1 rounded-lg text-sm border outline-none cursor-pointer"
          style={{ backgroundColor: s.cardBg, color: s.textPrimary, borderColor: s.divider }}
        >
          {MONTHS.map((label, i) => (
            <option key={i} value={i + 1}>{label}</option>
          ))}
        </select>
        <select
          value={selectedDay}
          onChange={e => setSelectedDay(Number(e.target.value))}
          className="px-2 py-1 rounded-lg text-sm border outline-none cursor-pointer"
          style={{ backgroundColor: s.cardBg, color: s.textPrimary, borderColor: s.divider }}
        >
          {Array.from({ length: daysInMonth }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}日</option>
          ))}
        </select>
        <span className="text-sm ml-1" style={{ color: s.textSecondary }}>
          {year}年{selectedMonth}月{selectedDay}日
        </span>
      </div>

      {/* Main content - scrollable */}
      <div ref={analysisRef} className="flex-1 overflow-y-auto">
        {plannedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={s.swatch} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity={0.3}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <div style={{ color: s.textMuted }} className="text-sm text-center">
              当天暂无日程<br />
              <span className="text-xs">请先在日程中添加任务，再回来对照轨迹</span>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-5">

            {/* Gantt Chart - Planned vs Actual */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${s.swatch}60` }} />
                <span className="text-xs" style={{ color: s.textMuted }}>计划时间</span>
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.swatch }} />
                <span className="text-xs" style={{ color: s.textMuted }}>实际时间</span>
              </div>

              {/* Timeline header */}
              <div className="relative h-5 mb-1" style={{ marginLeft: '80px' }}>
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                  const hour = TIMELINE_START + i;
                  const left = (i / TOTAL_HOURS) * 100;
                  return (
                    <div key={hour} className="absolute text-[10px]" style={{ left: `${left}%`, transform: 'translateX(-50%)', color: s.textMuted }}>
                      {hour}
                    </div>
                  );
                })}
              </div>

              {/* Event rows */}
              <div className="space-y-2">
                {plannedEvents.map((event) => {
                  const actual = actualTimes[event.id];
                  const delay = getDelay(event);
                  const durDiff = getDurationDiff(event);
                  const isEditing = editingEventId === event.id;

                  return (
                    <div key={event.id}>
                      {/* Gantt row */}
                      <div className="flex items-center gap-2 h-8">
                        <div className="w-[72px] flex-shrink-0 text-xs truncate text-right pr-1" style={{ color: s.textSecondary }}>
                          {event.title}
                        </div>
                        <div className="flex-1 relative h-full rounded" style={{ backgroundColor: `${s.divider}30` }}>
                          {/* Planned bar */}
                          {event.time && event.endTime && (
                            <div
                              className="absolute top-0.5 h-[10px] rounded-sm"
                              style={{
                                ...getBarPosition(event.time, event.endTime),
                                backgroundColor: `${s.swatch}40`,
                                border: `1px solid ${s.swatch}60`,
                              }}
                            />
                          )}
                          {/* Actual bar */}
                          {actual?.actualStart && actual?.actualEnd && (
                            <div
                              className="absolute bottom-0.5 h-[10px] rounded-sm"
                              style={{
                                ...getBarPosition(actual.actualStart, actual.actualEnd),
                                backgroundColor: s.swatch,
                                opacity: 0.85,
                              }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Delay indicator */}
                      {(delay !== null || durDiff !== null) && (
                        <div className="flex items-center gap-2 ml-[80px] text-[11px]" style={{ color: s.textMuted }}>
                          {delay !== null && (
                            <span style={{ color: delay > 0 ? '#ef4444' : delay < 0 ? '#22c55e' : s.textMuted }}>
                              {delay > 0 ? `延迟${delay}min` : delay < 0 ? `提前${Math.abs(delay)}min` : '准时'}
                            </span>
                          )}
                          {durDiff !== null && (
                            <span style={{ color: durDiff > 0 ? '#ef4444' : durDiff < 0 ? '#22c55e' : s.textMuted }}>
                              {durDiff > 0 ? `超时${durDiff}min` : durDiff < 0 ? `省时${Math.abs(durDiff)}min` : '按时'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actual time input row */}
                      <div className="flex items-center gap-2 ml-[80px] mt-1 mb-1">
                        <button
                          onClick={() => setEditingEventId(isEditing ? null : event.id)}
                          className="text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer"
                          style={{ backgroundColor: s.cardHover, color: s.textSecondary }}
                        >
                          {isEditing ? '收起' : '记录实际'}
                        </button>
                        {actual?.actualStart && (
                          <span className="text-[11px]" style={{ color: s.swatch }}>
                            实际 {actual.actualStart}{actual.actualEnd ? ` - ${actual.actualEnd}` : ''}
                          </span>
                        )}
                      </div>

                      {/* Expanded editing */}
                      {isEditing && (
                        <div className="ml-[80px] p-3 rounded-lg mb-2 flex items-center gap-3" style={{ backgroundColor: s.cardBg }}>
                          <div className="flex items-center gap-1">
                            <span className="text-xs" style={{ color: s.textMuted }}>开始</span>
                            <input
                              type="time"
                              value={actual?.actualStart || ''}
                              onChange={e => updateActualTime(event.id, 'actualStart', e.target.value)}
                              className="px-1.5 py-0.5 rounded text-xs border outline-none"
                              style={{ backgroundColor: s.panelBg, color: s.textPrimary, borderColor: s.divider }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs" style={{ color: s.textMuted }}>结束</span>
                            <input
                              type="time"
                              value={actual?.actualEnd || ''}
                              onChange={e => updateActualTime(event.id, 'actualEnd', e.target.value)}
                              className="px-1.5 py-0.5 rounded text-xs border outline-none"
                              style={{ backgroundColor: s.panelBg, color: s.textPrimary, borderColor: s.divider }}
                            />
                          </div>
                          {actual?.actualStart && (
                            <button
                              onClick={() => {
                                const updated = { ...actualTimes };
                                delete updated[event.id];
                                saveActualTimes(updated);
                              }}
                              className="text-[11px] px-2 py-0.5 rounded cursor-pointer"
                              style={{ color: '#ef4444' }}
                            >
                              清除
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const withActual = plannedEvents.filter(e => actualTimes[e.id]?.actualStart);
                const delays = plannedEvents.map(e => getDelay(e)).filter((d): d is number => d !== null);
                const avgDelay = delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
                const onTimeCount = delays.filter(d => d <= 0).length;
                const completionRate = plannedEvents.length > 0 ? Math.round((plannedEvents.filter(e => e.done).length / plannedEvents.length) * 100) : 0;

                return (
                  <>
                    <div className="rounded-lg p-3 text-center" style={{ backgroundColor: s.cardBg }}>
                      <div className="text-xl font-bold" style={{ color: s.swatch }}>{withActual.length}/{plannedEvents.length}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: s.textMuted }}>已记录</div>
                    </div>
                    <div className="rounded-lg p-3 text-center" style={{ backgroundColor: s.cardBg }}>
                      <div className="text-xl font-bold" style={{ color: avgDelay > 0 ? '#ef4444' : '#22c55e' }}>
                        {delays.length > 0 ? `${avgDelay > 0 ? '+' : ''}${avgDelay}min` : '--'}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: s.textMuted }}>平均偏差</div>
                    </div>
                    <div className="rounded-lg p-3 text-center" style={{ backgroundColor: s.cardBg }}>
                      <div className="text-xl font-bold" style={{ color: s.swatch }}>{completionRate}%</div>
                      <div className="text-[11px] mt-0.5" style={{ color: s.textMuted }}>完成率</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Analyze button */}
            <button
              onClick={fetchAnalysis}
              disabled={loading || plannedEvents.length === 0}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-80 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: s.swatch }}
            >
              {loading ? 'AI 分析中...' : 'AI 分析轨迹对照'}
            </button>

            {/* Analysis result */}
            {error && (
              <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                {error}
              </div>
            )}

            {analysis && (
              <div className="rounded-xl p-5 text-base leading-relaxed whitespace-pre-wrap" style={{ backgroundColor: s.cardBg, color: s.textPrimary }}>
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
        )}
      </div>
    </div>
  );
}
