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
  completed: string;
  goodThings: string;
  problems: string;
  mood: string;
  reflections: string;
  tomorrowTodo: string;
  moodScore: number;
  energy: number;
  updatedAt: string;
}

const MOOD_LABELS = ['', '疲惫', '低落', '一般', '不错', '很棒'];
const ENERGY_LABELS = ['', '枯竭', '低迷', '正常', '充沛', '满格'];

function getStorageKey(year: number, month: number, day: number) {
  return `daily-review-${year}-${month}-${day}`;
}

function loadReview(year: number, month: number, day: number): ReviewData {
  if (typeof window === 'undefined') return { completed: '', goodThings: '', problems: '', mood: '', reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '' };
  try {
    const raw = localStorage.getItem(getStorageKey(year, month, day));
    if (raw) {
      const parsed = JSON.parse(raw);
      const migrate = (v: string[] | string | undefined): string => {
        if (Array.isArray(v)) return v.filter(s => s.trim()).join('\n');
        return v || '';
      };
      return {
        completed: migrate(parsed.completed ?? parsed.achievements),
        goodThings: migrate(parsed.goodThings ?? parsed.gratitude),
        problems: migrate(parsed.problems ?? parsed.regrets),
        mood: parsed.mood ?? '',
        reflections: migrate(parsed.reflections ?? parsed.insights),
        tomorrowTodo: migrate(parsed.tomorrowTodo ?? parsed.tomorrowFocus),
        moodScore: parsed.moodScore ?? parsed.mood ?? 3,
        energy: parsed.energy ?? 3,
        updatedAt: parsed.updatedAt ?? '',
      };
    }
  } catch {}
  return { completed: '', goodThings: '', problems: '', mood: '', reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '' };
}

function saveReview(year: number, month: number, day: number, data: ReviewData) {
  if (typeof window === 'undefined') return;
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(getStorageKey(year, month, day), JSON.stringify(data));
}

export default function DailyReview({ year, month, day, skin, events, todos, onClose }: DailyReviewProps) {
  const [review, setReview] = useState<ReviewData>({ completed: '', goodThings: '', problems: '', mood: '', reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '' });
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
        '今天完成了什么': 'completed',
        '美好或值得关注的事': 'goodThings',
        '突发问题': 'problems',
        '今天心情如何': 'mood',
        '感想或总结': 'reflections',
        '明日待办': 'tomorrowTodo',
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

  if (!mounted) return null;

  const dateStr = `${month}月${day}日`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[1100px] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ backgroundColor: skin.panelBg }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: skin.cellBorder }}>
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
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = skin.swatch; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = skin.cardHover; e.currentTarget.style.color = skin.textMuted; }}
          >✕</button>
        </div>

        {/* Content */}
        <div className="px-6 py-3">
          {/* 3-column grid: 6 sections in 2 rows */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <ReviewSection
              title="今天完成了什么？"
              icon="✓"
              value={review.completed}
              onChange={v => updateField('completed', v)}
              skin={skin}
              placeholder="列出今天完成的事项..."
              loading={autoFilling}
              compact
            />
            <ReviewSection
              title="今天发生了哪些美好或值得关注的事？"
              icon="✦"
              value={review.goodThings}
              onChange={v => updateField('goodThings', v)}
              skin={skin}
              placeholder="值得记录的好事..."
              loading={autoFilling}
              compact
            />
            <ReviewSection
              title="今天遇到了哪些突发问题？"
              icon="⚠"
              value={review.problems}
              onChange={v => updateField('problems', v)}
              skin={skin}
              placeholder="遇到的意外或困难..."
              loading={autoFilling}
              compact
            />
            <ReviewSection
              title="今天心情如何？"
              icon="☺"
              value={review.mood}
              onChange={v => updateField('mood', v)}
              skin={skin}
              placeholder="简单描述心情..."
              loading={autoFilling}
              compact
            />
            <ReviewSection
              title="今天有哪些感想或总结？"
              icon="◎"
              value={review.reflections}
              onChange={v => updateField('reflections', v)}
              skin={skin}
              placeholder="今天的思考..."
              loading={autoFilling}
              compact
            />
            <ReviewSection
              title="明日待办？"
              icon="→"
              value={review.tomorrowTodo}
              onChange={v => updateField('tomorrowTodo', v)}
              skin={skin}
              placeholder="明天要做的事..."
              loading={autoFilling}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Review Section Component - Single textarea with auto-numbering */
function ReviewSection({ title, icon, value, onChange, skin, placeholder, fullWidth, compact, loading }: {
  title: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
  skin: DailyReviewProps['skin'];
  placeholder: string;
  fullWidth?: boolean;
  compact?: boolean;
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
    if (!String(value).trim()) {
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
    <div className={`rounded-xl p-3 flex flex-col relative ${fullWidth ? 'col-span-2' : ''}`} style={{ backgroundColor: skin.cardBg }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm" style={{ color: skin.swatch }}>{icon}</span>
        <span className="text-sm font-bold" style={{ color: skin.textPrimary }}>{title}</span>
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
        style={{ color: skin.textPrimary, minHeight: fullWidth ? '120px' : '192px' }}
      />
    </div>
  );
}
