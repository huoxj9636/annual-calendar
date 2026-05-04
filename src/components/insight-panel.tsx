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

interface InsightGoal {
  id: string;
  name: string;
  icon: string;
  desc: string;
  focusPrompt: string;
}

const INSIGHT_GOALS: InsightGoal[] = [
  {
    id: 'procrastination',
    name: '拖延诊断',
    icon: '⏰',
    desc: '识别拖延模式与根本原因',
    focusPrompt: '重点分析拖延模式和根本原因：识别回避困难、完美主义、精力低谷等拖延类型，给出针对性的反拖延策略。',
  },
  {
    id: 'execution',
    name: '执行力评估',
    icon: '⚡',
    desc: '评估当日执行力与完成效率',
    focusPrompt: '重点评估执行力：给当日执行力打分(1-10)，分析任务完成率、时间利用率、专注度，给出提升执行力的具体方法。',
  },
  {
    id: 'energy',
    name: '精力分析',
    icon: '🔋',
    desc: '分析精力分布与低谷时段',
    focusPrompt: '重点分析精力管理：识别高精力与低精力时段，分析精力消耗模式，给出精力恢复和高效利用的建议。',
  },
  {
    id: 'priority',
    name: '优先级复盘',
    icon: '🎯',
    desc: '检视时间是否花在最重要的事上',
    focusPrompt: '重点分析优先级管理：检视时间是否花在最重要的事情上，识别"紧急但不重要"的陷阱，给出优先级调整建议。',
  },
  {
    id: 'habit',
    name: '习惯追踪',
    icon: '📈',
    desc: '追踪好习惯养成与坏习惯改善',
    focusPrompt: '重点分析习惯养成：识别正在建立的好习惯和需要改善的坏习惯，给出习惯固化策略和微习惯建议。',
  },
  {
    id: 'balance',
    name: '生活平衡',
    icon: '⚖️',
    desc: '工作/学习/生活/健康平衡度',
    focusPrompt: '重点分析生活平衡：评估工作、学习、生活、健康四个维度的投入比例，识别失衡区域，给出平衡调整建议。',
  },
];

export default function InsightPanel({ year, month, day, skin, onClose }: InsightPanelProps) {
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const insightRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (insightRef.current) {
      insightRef.current.scrollTop = insightRef.current.scrollHeight;
    }
  }, [insight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const fetchInsight = async (goalId: string) => {
    const goal = INSIGHT_GOALS.find(g => g.id === goalId);
    if (!goal) return;

    // Cancel previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSelectedGoal(goalId);
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
        body: JSON.stringify({
          year, month, day, events, todos, overrides: overrideStatus,
          focus: goal.focusPrompt,
          goalName: goal.name,
        }),
        signal: controller.signal,
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
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '获取洞察失败');
    } finally {
      setLoading(false);
    }
  };

  const s = skin;
  const activeGoal = INSIGHT_GOALS.find(g => g.id === selectedGoal);

  return (
    <div className="absolute top-0 bottom-0 z-40 flex overflow-hidden"
      style={{ backgroundColor: s.panelBg, left: '64px', right: '-6px' }}>
      {/* Left sidebar - Goal selection */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: s.divider, backgroundColor: `${s.sidebarFrom}10` }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: s.divider }}>
          <div className="text-xs font-medium tracking-wider mb-0.5" style={{ color: s.swatch }}>DAILY INSIGHT</div>
          <div className="text-lg font-bold" style={{ color: s.textPrimary }}>{month}月{day}日</div>
        </div>

        {/* Goal list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          <div className="px-2 py-1.5 text-xs font-medium tracking-wider" style={{ color: s.textMuted }}>
            选择洞察维度
          </div>
          {INSIGHT_GOALS.map(goal => (
            <button
              key={goal.id}
              onClick={() => fetchInsight(goal.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg transition-all cursor-pointer group"
              style={{
                backgroundColor: selectedGoal === goal.id ? `${s.swatch}20` : 'transparent',
                borderLeft: selectedGoal === goal.id ? `3px solid ${s.swatch}` : '3px solid transparent',
              }}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-lg leading-none mt-0.5">{goal.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: selectedGoal === goal.id ? s.swatch : s.textPrimary }}>
                    {goal.name}
                  </div>
                  <div className="text-xs mt-0.5 leading-snug" style={{ color: s.textMuted }}>
                    {goal.desc}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right content - Analysis result */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Right header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between flex-shrink-0 border-b"
          style={{ borderColor: s.divider }}>
          <div>
            {activeGoal ? (
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeGoal.icon}</span>
                <span className="text-lg font-bold" style={{ color: s.textPrimary }}>{activeGoal.name}</span>
              </div>
            ) : (
              <span className="text-lg font-bold" style={{ color: s.textPrimary }}>请选择洞察维度</span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors z-20 cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.textMuted} strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Analysis content */}
        <div ref={insightRef} className="flex-1 overflow-y-auto px-5 py-4">
          {!selectedGoal && !loading && !insight && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-5xl">🔍</div>
              <div className="text-center">
                <div className="text-base font-medium mb-1" style={{ color: s.textPrimary }}>选择一个洞察维度</div>
                <div className="text-sm" style={{ color: s.textMuted }}>从左侧选择你想深入了解的维度，AI将为你分析</div>
              </div>
            </div>
          )}

          {loading && !insight && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${s.swatch}40`, borderTopColor: s.swatch }} />
              <span style={{ color: s.textMuted }} className="text-sm">正在分析{activeGoal?.name || ''}...</span>
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
            <div className="flex items-center gap-2 mt-3">
              <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${s.swatch}40`, borderTopColor: s.swatch }} />
              <span style={{ color: s.textMuted }} className="text-xs">继续分析中...</span>
            </div>
          )}

          {!loading && insight && activeGoal && (
            <button
              onClick={() => fetchInsight(activeGoal.id)}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 cursor-pointer"
              style={{ backgroundColor: `${s.swatch}15`, color: s.swatch }}
            >
              重新分析
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
