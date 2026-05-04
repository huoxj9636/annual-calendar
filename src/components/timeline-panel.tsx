'use client';

import { useState, useEffect, useMemo } from 'react';
import type { SkinTheme } from '@/lib/skins';

interface TimelinePanelProps {
  year: number;
  month: number;
  day: number;
  skin: SkinTheme;
  onClose: () => void;
  mode?: 'calendar' | 'tasks';
  onModeChange?: (mode: 'calendar' | 'tasks') => void;
  onDayClick?: (year: number, month: number, day: number) => void;
}

interface TimelineEvent {
  time: string;
  title: string;
  color: string;
  duration?: string;
  done?: boolean;
}

export default function TimelinePanel({ year, month, day, skin, onClose, mode: modeProp, onModeChange, onDayClick }: TimelinePanelProps) {
  const [internalMode, setInternalMode] = useState<'calendar' | 'tasks'>(modeProp || 'calendar');
  const effectiveMode = modeProp || internalMode;
  const handleModeChange = (m: 'calendar' | 'tasks') => {
    setInternalMode(m);
    onModeChange?.(m);
  };
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [todos, setTodos] = useState<{ text: string; done: boolean }[]>([]);

  useEffect(() => {
    const evKey = `dayview-events-${year}-${month}-${day}`;
    const todoKey = `dayview-todos-${year}-${month}-${day}`;
    try {
      const raw = localStorage.getItem(evKey);
      if (raw) setEvents(JSON.parse(raw));
      else setEvents([]);
    } catch { setEvents([]); }
    try {
      const raw = localStorage.getItem(todoKey);
      if (raw) setTodos(JSON.parse(raw));
      else setTodos([]);
    } catch { setTodos([]); }
  }, [year, month, day]);

  const navigateDate = (offset: number) => {
    const d = new Date(year, month - 1, day + offset);
    onDayClick?.(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };
  const dayName = useMemo(() => {
    const d = new Date(year, month - 1, day);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[d.getDay()];
  }, [year, month, day]);

  // Merge events and todos into timeline
  const timelineItems = useMemo(() => {
    if (effectiveMode === 'calendar') {
      // Show events sorted by time
      return events
        .filter((e: TimelineEvent) => e.time)
        .sort((a: TimelineEvent, b: TimelineEvent) => a.time.localeCompare(b.time))
        .map((e: TimelineEvent) => ({
          time: e.time,
          title: e.title,
          color: e.color || skin.tabActive,
          duration: e.duration,
          done: e.done,
          type: 'event' as const,
        }));
    } else {
      // Show todos as checklist
      return todos.map((t: { text: string; done: boolean }, i: number) => ({
        time: '',
        title: t.text,
        color: t.done ? skin.checkColor : skin.crossColor,
        done: t.done,
        type: 'task' as const,
        index: i,
      }));
    }
  }, [effectiveMode, events, todos, skin]);

  const toggleTodo = (index: number) => {
    const updated = [...todos];
    updated[index].done = !updated[index].done;
    setTodos(updated);
    const todoKey = `dayview-todos-${year}-${month}-${day}`;
    localStorage.setItem(todoKey, JSON.stringify(updated));
  };

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  return (
    <div
      className="absolute inset-0 z-40 animate-fade-in"
      style={{ background: skin.bodyBg, backdropFilter: 'blur(8px)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: skin.divider, backgroundColor: skin.panelBg }}
      >
        <div className="flex items-center gap-4">
          {/* Calendar button */}
          <button
            onClick={() => handleModeChange('calendar')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer"
            style={{
              backgroundColor: effectiveMode === 'calendar' ? skin.swatch + '20' : 'transparent',
              color: effectiveMode === 'calendar' ? skin.swatch : skin.textMuted,
              border: effectiveMode === 'calendar' ? `1.5px solid ${skin.swatch}40` : '1.5px solid transparent',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            日程
          </button>
          {/* Tasks button */}
          <button
            onClick={() => handleModeChange('tasks')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer"
            style={{
              backgroundColor: effectiveMode === 'tasks' ? skin.swatch + '20' : 'transparent',
              color: effectiveMode === 'tasks' ? skin.swatch : skin.textMuted,
              border: effectiveMode === 'tasks' ? `1.5px solid ${skin.swatch}40` : '1.5px solid transparent',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            任务
          </button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate(-1)}
            className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: skin.cardBg, color: skin.textSecondary }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = skin.cardHover; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = skin.cardBg; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button
            onClick={() => { const now = new Date(); onDayClick?.(now.getFullYear(), now.getMonth() + 1, now.getDate()); }}
            className="px-2 py-0.5 rounded text-xs font-medium cursor-pointer"
            style={{ backgroundColor: skin.cardBg, color: skin.textSecondary }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = skin.cardHover; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = skin.cardBg; }}
          >
            今天
          </button>
          <button
            onClick={() => navigateDate(1)}
            className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: skin.cardBg, color: skin.textSecondary }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = skin.cardHover; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = skin.cardBg; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <span className="text-xl font-bold ml-1" style={{ color: skin.textPrimary }}>
            {day}
          </span>
          <div className="flex flex-col">
            <span className="text-xs" style={{ color: skin.textMuted }}>{dayName}</span>
            <span className="text-xs font-medium" style={{ color: skin.textSecondary }}>
              {year}年{monthNames[month - 1]}
            </span>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
        >
          <span className="text-white text-sm">✕</span>
        </button>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-y-auto px-6 py-4" style={{ height: 'calc(100% - 64px)' }}>
        {timelineItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: skin.divider + '30' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={skin.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {effectiveMode === 'calendar' ? (
                  <>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </>
                ) : (
                  <>
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </>
                )}
              </svg>
            </div>
            <span className="text-sm" style={{ color: skin.textMuted }}>
              {effectiveMode === 'calendar' ? '暂无日程安排' : '暂无待办任务'}
            </span>
            <span className="text-xs" style={{ color: skin.textMuted + '80' }}>
              点击右侧日期添加
            </span>
          </div>
        ) : (
          <div className="relative pl-6">
            {/* Timeline line */}
            <div
              className="absolute left-3 top-0 bottom-0 w-0.5"
              style={{ backgroundColor: skin.divider }}
            />

            {timelineItems.map((item, idx) => (
              <div key={idx} className="relative mb-4 last:mb-0">
                {/* Timeline dot */}
                <div
                  className="absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2"
                  style={{
                    borderColor: item.color,
                    backgroundColor: item.done ? item.color : skin.panelBg,
                  }}
                />

                {/* Content card */}
                <div
                  className="rounded-xl px-4 py-3 transition-all"
                  style={{
                    backgroundColor: skin.cardBg,
                    borderLeft: `3px solid ${item.color}`,
                    boxShadow: `0 1px 3px ${skin.divider}40`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {item.time && (
                        <span
                          className="text-xs font-semibold mr-2"
                          style={{ color: item.color }}
                        >
                          {item.time}
                        </span>
                      )}
                      {item.type === 'task' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleTodo(item.index!)}
                            className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs transition-all cursor-pointer"
                            style={{
                              border: `1.5px solid ${item.done ? skin.checkColor : skin.divider}`,
                              backgroundColor: item.done ? skin.checkColor + '20' : 'transparent',
                              color: item.done ? skin.checkColor : 'transparent',
                            }}
                          >
                            ✓
                          </button>
                          <span
                            className="text-sm"
                            style={{
                              color: item.done ? skin.textMuted : skin.textPrimary,
                              textDecoration: item.done ? 'line-through' : 'none',
                            }}
                          >
                            {item.title}
                          </span>
                        </div>
                      ) : (
                        <span
                          className="text-sm font-medium"
                          style={{ color: skin.textPrimary }}
                        >
                          {item.title}
                        </span>
                      )}
                    </div>
                    {item.type === 'event' && item.duration && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-md flex-shrink-0"
                        style={{ backgroundColor: item.color + '15', color: item.color }}
                      >
                        {item.duration}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
