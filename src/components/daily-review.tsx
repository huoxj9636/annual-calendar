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
  gratitude: string;
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
  if (typeof window === 'undefined') return { achievements: '', regrets: '', insights: '', tomorrowFocus: '', gratitude: '', mood: 3, energy: 3, updatedAt: '' };
  try {
    const raw = localStorage.getItem(getStorageKey(year, month, day));
    if (raw) {
      const parsed = JSON.parse(raw);
      const migrate = (v: string[] | string | undefined): string => {
        if (Array.isArray(v)) return v.filter(s => s.trim()).join('\n');
        return v || '';
      };
      return {
        achievements: migrate(parsed.achievements),
        regrets: migrate(parsed.regrets),
        insights: migrate(parsed.insights),
        tomorrowFocus: migrate(parsed.tomorrowFocus),
        gratitude: migrate(parsed.gratitude),
        mood: parsed.mood ?? 3,
        energy: parsed.energy ?? 3,
        updatedAt: parsed.updatedAt ?? '',
      };
    }
  } catch {}
  return { achievements: '', regrets: '', insights: '', tomorrowFocus: '', gratitude: '', mood: 3, energy: 3, updatedAt: '' };
}

function saveReview(year: number, month: number, day: number, data: ReviewData) {
  if (typeof window === 'undefined') return;
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(getStorageKey(year, month, day), JSON.stringify(data));
}

export default function DailyReview({ year, month, day, skin, events, todos, onClose }: DailyReviewProps) {
  const [review, setReview] = useState<ReviewData>({ achievements: '', regrets: '', insights: '', tomorrowFocus: '', gratitude: '', mood: 3, energy: 3, updatedAt: '' });
  const [mounted, setMounted] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loaded = loadReview(year, month, day);
    setReview(loaded);
  }, [year, month, day]);

  const autoFillReview = useCallback(async (currentReview: ReviewData) => {
    setAutoFilling(true);
    try {
      // Read OKR data from localStorage
      let okrData = { objectives: [] as { title: string; period: string; children: { title: string; targetValue: number; children: { title: string; done: boolean }[] }[] }[] };
      try {
        const raw = localStorage.getItem('okr-data');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.objectives) okrData = parsed;
        }
      } catch {}

      const dayEvents = events.map(e => `${String(e.startHour).padStart(2,'0')}:${String(e.startMin).padStart(2,'0')}-${String(e.endHour).padStart(2,'0')}:${String(e.endMin).padStart(2,'0')} ${e.title}`);
      const doneTodos = todos.filter(t => t.done).map(t => t.text);
      const pendingTodos = todos.filter(t => !t.done).map(t => t.text);

      const res = await fetch('/api/auto-fill-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: `${year}年${month}月${day}日`,
          okrData,
          events: dayEvents,
          doneTodos,
          pendingTodos,
        }),
      });

      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }

      // Parse the 5 sections from AI response
      const sections: Record<string, string> = {};
      const sectionMap: Record<string, keyof ReviewData> = {
        '今日亮点': 'achievements',
        '今日反思': 'regrets',
        '今日收获': 'insights',
        '明日行动': 'tomorrowFocus',
        '今日感恩': 'gratitude',
      };

      let currentKey = '';
      let currentLines: string[] = [];

      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        // Check if this line is a section header
        let found = false;
        for (const [label, field] of Object.entries(sectionMap)) {
          if (trimmed.includes('【' + label + '】') || trimmed === label || trimmed === label + '：' || trimmed === label + ':') {
            if (currentKey && currentLines.length > 0) {
              sections[currentKey] = currentLines.join('\n');
            }
            currentKey = field;
            currentLines = [];
            found = true;
            break;
          }
        }
        if (!found && currentKey && trimmed) {
          currentLines.push(trimmed);
        }
      }
      if (currentKey && currentLines.length > 0) {
        sections[currentKey] = currentLines.join('\n');
      }

      // Update review with parsed sections
      setReview(prev => {
        const next = { ...prev };
        for (const [field, value] of Object.entries(sections)) {
          if (field in next) {
            (next as Record<string, unknown>)[field] = value;
          }
        }
        saveReview(year, month, day, next);
        return next;
      });
    } catch {
      // Silent fail - user can still manually fill
    } finally {
      setAutoFilling(false);
    }
  }, [year, month, day, events, todos]);

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
          highlights: toArray(review.achievements),
          reflections: toArray(review.regrets),
          takeaways: toArray(review.insights),
          nextActions: toArray(review.tomorrowFocus),
          gratitude: toArray(review.gratitude),
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
        <div className="flex items-center gap-3">
          <div>
            <div className="text-lg font-bold" style={{ color: skin.textPrimary }}>{dateStr} 复盘</div>
            <div className="text-[10px] font-medium tracking-wider" style={{ color: skin.textMuted }}>DAILY REVIEW</div>
          </div>
          {autoFilling ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: skin.swatch + '15', color: skin.swatch }}>
              <span className="animate-spin">⟳</span>
              AI 填充中...
            </div>
          ) : (
            <button onClick={() => autoFillReview(review)}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
              style={{ backgroundColor: skin.swatch + '15', color: skin.swatch }}
            >AI 重新填充</button>
          )}
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: skin.cardHover, color: skin.textMuted }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = skin.swatch, e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = skin.cardHover, e.currentTarget.style.color = skin.textMuted)}
        >✕</button>
      </div>

      {/* Content - Left/Right Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Form */}
        <div className="flex-1 overflow-y-auto px-5 py-3 border-r" style={{ borderColor: skin.cellBorder }}>
          {/* Mood & Energy */}
          <div className="flex gap-3 mb-3">
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

          {/* 2-column grid: 5 sections (2+2+1) */}
          <div className="grid grid-cols-2 gap-3">
            <ReviewSection
              title="今日亮点"
              icon="★"
              value={review.achievements}
              onChange={v => updateField('achievements', v)}
              skin={skin}
              placeholder="记下今天值得骄傲的事..."
              loading={autoFilling}
            />
            <ReviewSection
              title="今日反思"
              icon="△"
              value={review.regrets}
              onChange={v => updateField('regrets', v)}
              skin={skin}
              placeholder="哪里做得不好？为什么？..."
              loading={autoFilling}
            />
            <ReviewSection
              title="今日收获"
              icon="◎"
              value={review.insights}
              onChange={v => updateField('insights', v)}
              skin={skin}
              placeholder="今天学到了什么？意识到了什么？..."
              loading={autoFilling}
            />
            <ReviewSection
              title="明日行动"
              icon="→"
              value={review.tomorrowFocus}
              onChange={v => updateField('tomorrowFocus', v)}
              skin={skin}
              placeholder="明天最需要完成的事..."
              loading={autoFilling}
            />
            <ReviewSection
              title="今日感恩"
              icon="♥"
              value={review.gratitude}
              onChange={v => updateField('gratitude', v)}
              skin={skin}
              placeholder="今天有什么值得感恩的人或事..."
              fullSpan
              loading={autoFilling}
            />
          </div>
        </div>

        {/* Right: AI Review */}
        <div className="w-[320px] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: skin.cellBorder }}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm" style={{ color: skin.swatch }}>◈</span>
              <span className="text-xs font-bold" style={{ color: skin.textPrimary }}>AI 点评</span>
            </div>
            {aiAnalysis && (
              <button onClick={runAiAnalysis} disabled={aiLoading}
                className="text-[10px] px-2 py-0.5 rounded-full font-medium transition-all"
                style={{ backgroundColor: skin.cardHover, color: skin.textMuted }}
              >重新分析</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {aiAnalysis === '' && !aiLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="text-xs" style={{ color: skin.textMuted }}>完成左侧复盘后</div>
                <button onClick={runAiAnalysis}
                  className="px-5 py-2 rounded-full text-xs font-medium text-white transition-all"
                  style={{ backgroundColor: skin.swatch }}
                >让AI帮你复盘今日</button>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: skin.textPrimary, fontFamily: 'inherit' }}>
                {aiAnalysis}{aiLoading && <span className="animate-pulse">▌</span>}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Review Section Component - Single textarea with auto-numbering */
function ReviewSection({ title, icon, value, onChange, skin, placeholder, fullSpan, loading }: {
  title: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
  skin: DailyReviewProps['skin'];
  placeholder: string;
  fullSpan?: boolean;
  loading?: boolean;
}) {
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
      
      const currentLine = before.split('\n').pop() || '';
      const match = currentLine.match(/^(\d+)\.\s*/);
      
      if (match) {
        e.preventDefault();
        const nextNum = parseInt(match[1]) + 1;
        const newText = before + '\n' + nextNum + '. ' + after;
        onChange(newText);
        requestAnimationFrame(() => {
          if (ta) ta.selectionStart = ta.selectionEnd = pos + 1 + match[0].length;
        });
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!value.trim()) {
      onChange('1. ');
      const el = e.currentTarget;
      requestAnimationFrame(() => {
        if (el && el.isConnected) el.selectionStart = el.selectionEnd = 3;
      });
    }
    e.currentTarget.style.borderColor = skin.swatch + '50';
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'transparent';
    const cleaned = value
      .split('\n')
      .filter(line => line.trim() && line.trim() !== '.' && !/^\d+\.\s*$/.test(line))
      .map((line, i) => {
        const content = line.replace(/^\d+\.\s*/, '');
        return content ? `${i + 1}. ${content}` : '';
      })
      .join('\n');
    if (cleaned !== value) {
      onChange(cleaned);
    }
  };

  return (
    <div className={`rounded-xl p-3 flex flex-col relative ${fullSpan ? 'col-span-2' : ''}`} style={{ backgroundColor: skin.cardBg }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm" style={{ color: skin.swatch }}>{icon}</span>
        <span className="text-xs font-bold" style={{ color: skin.textPrimary }}>{title}</span>
        {loading && (
          <span className="ml-auto text-[10px] animate-pulse" style={{ color: skin.swatch }}>AI填充中...</span>
        )}
      </div>
      <textarea
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={6}
        className="w-full bg-transparent text-xs leading-relaxed outline-none border border-transparent rounded-lg p-2 resize-none transition-colors"
        style={{ color: skin.textPrimary, minHeight: fullSpan ? '80px' : '120px' }}
      />
    </div>
  );
}
