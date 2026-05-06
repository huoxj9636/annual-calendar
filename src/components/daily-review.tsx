'use client';

import { useState, useEffect, useCallback } from 'react';

interface DailyReviewProps {
  year: number;
  month: number;
  day: number;
  skin: {
    swatch: string;
    cardBg: string;
    cardHover: string;
    textPrimary: string;
    textMuted: string;
    panelBg: string;
    cellBorder: string;
    tabActive: string;
  };
  events: { title: string; startHour: number; startMin: number; endHour: number; endMin: number }[];
  todos: { text: string; done: boolean }[];
  onClose: () => void;
}

interface ReviewData {
  achievements: string[];   // 今日成就
  regrets: string[];        // 今日遗憾
  insights: string[];       // 关键洞察
  tomorrowFocus: string[];  // 明日重点
  mood: number;             // 心情 1-5
  energy: number;           // 精力 1-5
  updatedAt: string;
}

const MOOD_LABELS = ['', '疲惫', '低落', '一般', '不错', '很棒'];
const ENERGY_LABELS = ['', '枯竭', '低迷', '正常', '充沛', '满格'];
const DEFAULT_ITEMS = { achievements: ['', '', ''], regrets: ['', ''], insights: ['', ''], tomorrowFocus: ['', '', ''] };

function getStorageKey(year: number, month: number, day: number) {
  return `daily-review-${year}-${month}-${day}`;
}

function loadReview(year: number, month: number, day: number): ReviewData {
  if (typeof window === 'undefined') return { ...DEFAULT_ITEMS, mood: 3, energy: 3, updatedAt: '' };
  try {
    const raw = localStorage.getItem(getStorageKey(year, month, day));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...DEFAULT_ITEMS, mood: 3, energy: 3, updatedAt: '' };
}

function saveReview(year: number, month: number, day: number, data: ReviewData) {
  if (typeof window === 'undefined') return;
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(getStorageKey(year, month, day), JSON.stringify(data));
}

export default function DailyReview({ year, month, day, skin, events, todos, onClose }: DailyReviewProps) {
  const [review, setReview] = useState<ReviewData>({ ...DEFAULT_ITEMS, mood: 3, energy: 3, updatedAt: '' });
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'write' | 'ai'>('write');

  useEffect(() => {
    setMounted(true);
    setReview(loadReview(year, month, day));
  }, [year, month, day]);

  const updateField = useCallback((field: keyof ReviewData, value: string[] | number) => {
    setReview(prev => {
      const next = { ...prev, [field]: value };
      saveReview(year, month, day, next);
      return next;
    });
  }, [year, month, day]);

  const updateItem = useCallback((field: 'achievements' | 'regrets' | 'insights' | 'tomorrowFocus', index: number, value: string) => {
    setReview(prev => {
      const arr = [...prev[field]];
      arr[index] = value;
      // Auto-expand: if editing last item and it's not empty, add a new empty item
      if (index === arr.length - 1 && value.trim() !== '') {
        arr.push('');
      }
      const next = { ...prev, [field]: arr };
      saveReview(year, month, day, next);
      return next;
    });
  }, [year, month, day]);

  const removeItem = useCallback((field: 'achievements' | 'regrets' | 'insights' | 'tomorrowFocus', index: number) => {
    setReview(prev => {
      const arr = prev[field].filter((_, i) => i !== index);
      if (arr.length === 0) arr.push('');
      const next = { ...prev, [field]: arr };
      saveReview(year, month, day, next);
      return next;
    });
  }, [year, month, day]);

  const dayEvents = events.map(e => `${String(e.startHour).padStart(2,'0')}:${String(e.startMin).padStart(2,'0')}-${String(e.endHour).padStart(2,'0')}:${String(e.endMin).padStart(2,'0')} ${e.title}`);
  const doneTodos = todos.filter(t => t.done).map(t => t.text);
  const pendingTodos = todos.filter(t => !t.done).map(t => t.text);

  // AI analysis
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const runAiAnalysis = useCallback(async () => {
    setAiLoading(true);
    setAiAnalysis('');
    try {
      const res = await fetch('/api/daily-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: `${year}年${month}月${day}日`,
          achievements: review.achievements.filter(s => s.trim()),
          regrets: review.regrets.filter(s => s.trim()),
          insights: review.insights.filter(s => s.trim()),
          tomorrowFocus: review.tomorrowFocus.filter(s => s.trim()),
          mood: MOOD_LABELS[review.mood],
          energy: ENERGY_LABELS[review.energy],
          events: dayEvents,
          doneTodos,
          pendingTodos,
        }),
      });
      if (!res.ok || !res.body) { setAiAnalysis('分析失败，请稍后重试'); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAiAnalysis(text);
      }
    } catch {
      setAiAnalysis('网络错误，请稍后重试');
    } finally {
      setAiLoading(false);
    }
  }, [year, month, day, review, dayEvents, doneTodos, pendingTodos]);

  if (!mounted) return null;

  const dateStr = `${month}月${day}日`;

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ backgroundColor: skin.panelBg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: skin.cellBorder }}>
        <div>
          <div className="text-lg font-bold" style={{ color: skin.textPrimary }}>{dateStr} 复盘</div>
          <div className="text-[10px] font-medium tracking-wider" style={{ color: skin.textMuted }}>DAILY REVIEW</div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: skin.cardHover, color: skin.textMuted }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = skin.swatch, e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = skin.cardHover, e.currentTarget.style.color = skin.textMuted)}
        >✕</button>
      </div>

      {/* Tab */}
      <div className="flex gap-1 px-5 pt-3">
        <button onClick={() => setActiveTab('write')}
          className="px-4 py-1.5 text-sm font-medium rounded-full transition-all"
          style={activeTab === 'write'
            ? { backgroundColor: skin.swatch, color: '#fff' }
            : { backgroundColor: skin.cardBg, color: skin.textMuted }
          }
        >手写复盘</button>
        <button onClick={() => setActiveTab('ai')}
          className="px-4 py-1.5 text-sm font-medium rounded-full transition-all"
          style={activeTab === 'ai'
            ? { backgroundColor: skin.swatch, color: '#fff' }
            : { backgroundColor: skin.cardBg, color: skin.textMuted }
          }
        >AI 点评</button>
      </div>

      {activeTab === 'write' ? (
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {/* Mood & Energy */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl p-3" style={{ backgroundColor: skin.cardBg }}>
              <div className="text-xs font-medium mb-2" style={{ color: skin.textMuted }}>心情</div>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(v => (
                  <button key={v} onClick={() => updateField('mood', v)}
                    className="flex-1 py-1 text-xs rounded-md transition-all font-medium"
                    style={review.mood >= v
                      ? { backgroundColor: skin.swatch, color: '#fff' }
                      : { backgroundColor: skin.cardHover, color: skin.textMuted }
                    }
                  >{MOOD_LABELS[v]}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 rounded-xl p-3" style={{ backgroundColor: skin.cardBg }}>
              <div className="text-xs font-medium mb-2" style={{ color: skin.textMuted }}>精力</div>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(v => (
                  <button key={v} onClick={() => updateField('energy', v)}
                    className="flex-1 py-1 text-xs rounded-md transition-all font-medium"
                    style={review.energy >= v
                      ? { backgroundColor: skin.swatch, color: '#fff' }
                      : { backgroundColor: skin.cardHover, color: skin.textMuted }
                    }
                  >{ENERGY_LABELS[v]}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Achievements */}
          <ReviewSection
            title="今日成就"
            icon="★"
            items={review.achievements}
            onUpdate={(i, v) => updateItem('achievements', i, v)}
            onRemove={(i) => removeItem('achievements', i)}
            skin={skin}
            placeholder="记下一件值得骄傲的事..."
          />

          {/* Section: Regrets */}
          <ReviewSection
            title="今日遗憾"
            icon="△"
            items={review.regrets}
            onUpdate={(i, v) => updateItem('regrets', i, v)}
            onRemove={(i) => removeItem('regrets', i)}
            skin={skin}
            placeholder="写下未完成或做得不好的..."
          />

          {/* Section: Insights */}
          <ReviewSection
            title="关键洞察"
            icon="◎"
            items={review.insights}
            onUpdate={(i, v) => updateItem('insights', i, v)}
            onRemove={(i) => removeItem('insights', i)}
            skin={skin}
            placeholder="今天有什么新的认知？..."
          />

          {/* Section: Tomorrow */}
          <ReviewSection
            title="明日重点"
            icon="→"
            items={review.tomorrowFocus}
            onUpdate={(i, v) => updateItem('tomorrowFocus', i, v)}
            onRemove={(i) => removeItem('tomorrowFocus', i)}
            skin={skin}
            placeholder="明天最想完成的事..."
          />

          {/* Event summary */}
          {(dayEvents.length > 0 || doneTodos.length > 0 || pendingTodos.length > 0) && (
            <div className="rounded-xl p-3" style={{ backgroundColor: skin.cardBg }}>
              <div className="text-xs font-medium mb-2" style={{ color: skin.textMuted }}>今日日程摘要</div>
              {dayEvents.map((e, i) => (
                <div key={i} className="text-xs py-0.5" style={{ color: skin.textPrimary }}>• {e}</div>
              ))}
              {doneTodos.map((t, i) => (
                <div key={`d${i}`} className="text-xs py-0.5 line-through" style={{ color: skin.textMuted }}>✓ {t}</div>
              ))}
              {pendingTodos.map((t, i) => (
                <div key={`p${i}`} className="text-xs py-0.5" style={{ color: skin.swatch }}>○ {t}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {aiAnalysis === '' && !aiLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-sm" style={{ color: skin.textMuted }}>完成手写复盘后，让AI帮你深度分析</div>
              <button onClick={runAiAnalysis}
                className="px-6 py-2 rounded-full text-sm font-medium text-white transition-all"
                style={{ backgroundColor: skin.swatch }}
              >开始分析</button>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: skin.textPrimary, fontFamily: 'inherit' }}>
                {aiAnalysis}{aiLoading && <span className="animate-pulse">▌</span>}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Review Section Component */
function ReviewSection({ title, icon, items, onUpdate, onRemove, skin, placeholder }: {
  title: string;
  icon: string;
  items: string[];
  onUpdate: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  skin: DailyReviewProps['skin'];
  placeholder: string;
}) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: skin.cardBg }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm" style={{ color: skin.swatch }}>{icon}</span>
        <span className="text-xs font-bold" style={{ color: skin.textPrimary }}>{title}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 group">
            <span className="text-[10px] font-mono w-4 text-right flex-shrink-0" style={{ color: skin.textMuted }}>{i + 1}.</span>
            <input
              type="text"
              value={item}
              onChange={e => onUpdate(i, e.target.value)}
              placeholder={i === 0 ? placeholder : ''}
              className="flex-1 bg-transparent text-xs outline-none border-b border-transparent focus:border-current py-0.5 transition-colors"
              style={{ color: skin.textPrimary, borderColor: 'transparent' }}
              onFocus={e => (e.currentTarget.style.borderColor = skin.swatch + '40')}
              onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
            />
            {item.trim() !== '' && items.length > 1 && (
              <button onClick={() => onRemove(i)}
                className="opacity-0 group-hover:opacity-100 text-[10px] w-4 h-4 flex items-center justify-center rounded-full transition-opacity"
                style={{ color: skin.textMuted }}
              >✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
