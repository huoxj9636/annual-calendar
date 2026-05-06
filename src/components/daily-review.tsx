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
  achievements: string;
  regrets: string;
  insights: string;
  tomorrowFocus: string;
  mood: number;
  energy: number;
  updatedAt: string;
}

const MOOD_LABELS = ['', '疲惫', '低落', '一般', '不错', '很棒'];
const ENERGY_LABELS = ['', '枯竭', '低迷', '正常', '充沛', '满格'];

function getStorageKey(year: number, month: number, day: number) {
  return `daily-review-${year}-${month}-${day}`;
}

function loadReview(year: number, month: number, day: number): ReviewData {
  if (typeof window === 'undefined') return { achievements: '', regrets: '', insights: '', tomorrowFocus: '', mood: 3, energy: 3, updatedAt: '' };
  try {
    const raw = localStorage.getItem(getStorageKey(year, month, day));
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate from old array format to string format
      const migrate = (v: string[] | string | undefined): string => {
        if (Array.isArray(v)) return v.filter(s => s.trim()).join('\n');
        return v || '';
      };
      return {
        achievements: migrate(parsed.achievements),
        regrets: migrate(parsed.regrets),
        insights: migrate(parsed.insights),
        tomorrowFocus: migrate(parsed.tomorrowFocus),
        mood: parsed.mood ?? 3,
        energy: parsed.energy ?? 3,
        updatedAt: parsed.updatedAt ?? '',
      };
    }
  } catch {}
  return { achievements: '', regrets: '', insights: '', tomorrowFocus: '', mood: 3, energy: 3, updatedAt: '' };
}

function saveReview(year: number, month: number, day: number, data: ReviewData) {
  if (typeof window === 'undefined') return;
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(getStorageKey(year, month, day), JSON.stringify(data));
}

export default function DailyReview({ year, month, day, skin, events, todos, onClose }: DailyReviewProps) {
  const [review, setReview] = useState<ReviewData>({ achievements: '', regrets: '', insights: '', tomorrowFocus: '', mood: 3, energy: 3, updatedAt: '' });
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'write' | 'ai'>('write');

  useEffect(() => {
    setMounted(true);
    setReview(loadReview(year, month, day));
  }, [year, month, day]);

  const updateField = useCallback((field: keyof ReviewData, value: string | number) => {
    setReview(prev => {
      const next = { ...prev, [field]: value };
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
      const toArray = (s: string) => s.split('\n').filter(l => l.trim());
      const res = await fetch('/api/daily-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: `${year}年${month}月${day}日`,
          achievements: toArray(review.achievements),
          regrets: toArray(review.regrets),
          insights: toArray(review.insights),
          tomorrowFocus: toArray(review.tomorrowFocus),
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
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
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

          {/* 2x2 Grid: Achievements, Regrets, Insights, Tomorrow */}
          <div className="grid grid-cols-2 gap-3">
            <ReviewSection
              title="今日成就"
              icon="★"
              value={review.achievements}
              onChange={v => updateField('achievements', v)}
              skin={skin}
              placeholder="记下一件值得骄傲的事..."
            />
            <ReviewSection
              title="今日遗憾"
              icon="△"
              value={review.regrets}
              onChange={v => updateField('regrets', v)}
              skin={skin}
              placeholder="写下未完成或做得不好的..."
            />
            <ReviewSection
              title="关键洞察"
              icon="◎"
              value={review.insights}
              onChange={v => updateField('insights', v)}
              skin={skin}
              placeholder="今天有什么新的认知？..."
            />
            <ReviewSection
              title="明日重点"
              icon="→"
              value={review.tomorrowFocus}
              onChange={v => updateField('tomorrowFocus', v)}
              skin={skin}
              placeholder="明天最想完成的事..."
            />
          </div>

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

/* Review Section Component - Single textarea with auto-numbering */
function ReviewSection({ title, icon, value, onChange, skin, placeholder }: {
  title: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
  skin: DailyReviewProps['skin'];
  placeholder: string;
}) {
  // Convert value to numbered display: add "1. " prefix on each line
  const displayValue = value;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const ta = e.currentTarget;
      const pos = ta.selectionStart;
      const before = ta.value.substring(0, pos);
      const after = ta.value.substring(pos);
      
      // Check if current line starts with a number pattern like "1. " or "2. "
      const currentLine = before.split('\n').pop() || '';
      const match = currentLine.match(/^(\d+)\.\s*/);
      
      if (match) {
        e.preventDefault();
        const nextNum = parseInt(match[1]) + 1;
        const newText = before + '\n' + nextNum + '. ' + after;
        onChange(newText);
        // Set cursor after the new number prefix
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = pos + 1 + match[0].length;
        });
      }
    }
  };

  // Add initial numbering if empty
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!value.trim()) {
      onChange('1. ');
      requestAnimationFrame(() => {
        e.currentTarget.selectionStart = e.currentTarget.selectionEnd = 3;
      });
    }
    e.currentTarget.style.borderColor = skin.swatch + '50';
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'transparent';
    // Clean up empty numbered lines on blur
    const cleaned = value
      .split('\n')
      .filter(line => line.trim() && line.trim() !== '.' && !/^\d+\.\s*$/.test(line))
      .map((line, i) => {
        // Re-number lines
        const content = line.replace(/^\d+\.\s*/, '');
        return content ? `${i + 1}. ${content}` : '';
      })
      .join('\n');
    if (cleaned !== value) {
      onChange(cleaned);
    }
  };

  return (
    <div className="rounded-xl p-3 flex flex-col" style={{ backgroundColor: skin.cardBg }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm" style={{ color: skin.swatch }}>{icon}</span>
        <span className="text-xs font-bold" style={{ color: skin.textPrimary }}>{title}</span>
      </div>
      <textarea
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={4}
        className="w-full bg-transparent text-xs leading-relaxed outline-none border border-transparent rounded-lg p-2 resize-none transition-colors"
        style={{ color: skin.textPrimary, minHeight: '80px' }}
      />
    </div>
  );
}
