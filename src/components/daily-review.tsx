'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
        mood: typeof parsed.mood === 'string' ? parsed.mood : '',
        reflections: migrate(parsed.reflections ?? parsed.insights),
        tomorrowTodo: migrate(parsed.tomorrowTodo ?? parsed.tomorrowFocus),
        moodScore: parsed.moodScore ?? (typeof parsed.mood === 'number' ? parsed.mood : 3),
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

interface SRLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  abort: () => void;
  onresult: ((event: SREventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SREventLike {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

function createRecognition(): SRLike | null {
  const SR = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  if (!SR) return null;
  return new (SR as new () => SRLike)();
}

type VoicePhase = 'idle' | 'recording' | 'polishing' | 'done';

export default function DailyReview({ year, month, day, skin, events, todos, onClose }: DailyReviewProps) {
  const [review, setReview] = useState<ReviewData>({ completed: '', goodThings: '', problems: '', mood: '', reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '' });
  const [mounted, setMounted] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Voice recording state
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [liveText, setLiveText] = useState('');
  const [recSeconds, setRecSeconds] = useState(0);
  const [polishedPreview, setPolishedPreview] = useState('');
  const recognitionRef = useRef<SRLike | null>(null);
  const finalTextRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
    const loaded = loadReview(year, month, day);
    setReview(loaded);
  }, [year, month, day]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const startVoiceRecording = useCallback(() => {
    const rec = createRecognition();
    if (!rec) { alert('当前浏览器不支持语音识别，请使用 Chrome 浏览器'); return; }

    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;

    finalTextRef.current = '';
    setLiveText('');
    setRecSeconds(0);
    setPolishedPreview('');
    setVoicePhase('recording');

    rec.onresult = (event: SREventLike) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          final += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      if (final) finalTextRef.current = final;
      setLiveText(finalTextRef.current + (interim ? (finalTextRef.current ? '\n' : '') + interim : ''));
    };

    rec.onerror = () => {
      // Auto-restart on error (e.g., no speech detected)
      if (finalTextRef.current !== '__STOPPED__') {
        try { rec.start(); } catch {}
      }
    };

    rec.onend = () => {
      // Auto-restart unless we manually stopped
      if (finalTextRef.current !== '__STOPPED__') {
        try { rec.start(); } catch {}
      }
    };

    recognitionRef.current = rec;
    rec.start();

    // Start timer
    timerRef.current = setInterval(() => {
      setRecSeconds(s => s + 1);
    }, 1000);
  }, []);

  /** Parse SSE stream from LLM API, return accumulated plain text */
  const parseSSEStream = async (reader: ReadableStreamDefaultReader<Uint8Array>, onChunk?: (text: string) => void): Promise<string> => {
    const decoder = new TextDecoder();
    let buffer = '';
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            result += parsed.content;
            onChunk?.(result);
          }
        } catch {}
      }
    }
    return result;
  };

  const stopVoiceRecording = useCallback(async () => {
    if (recognitionRef.current) {
      finalTextRef.current = '__STOPPED__';
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const spokenText = liveText.trim();
    if (!spokenText) {
      setVoicePhase('idle');
      return;
    }

    setVoicePhase('polishing');
    setPolishedPreview('');

    try {
      const res = await fetch('/api/auto-fill-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: `${year}年${month}月${day}日`,
          okrData: { objectives: [] },
          events: [],
          doneTodos: [],
          pendingTodos: [],
          voiceText: spokenText,
        }),
      });

      if (!res.ok || !res.body) {
        setVoicePhase('idle');
        return;
      }

      const text = await parseSSEStream(res.body.getReader(), (partial) => {
        setPolishedPreview(partial);
      });

      // Parse sections and fill review
      const sectionMap: Record<string, keyof ReviewData> = {
        '今天完成了什么': 'completed',
        '美好或值得关注的事': 'goodThings',
        '突发问题': 'problems',
        '今天心情如何': 'mood',
        '感想或总结': 'reflections',
        '明日待办': 'tomorrowTodo',
      };

      const sections: Record<string, string> = {};
      let currentKey = '';
      let currentLines: string[] = [];

      for (const line of text.split('\n')) {
        const trimmed = line.trim();
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

      setReview(prev => {
        const next = { ...prev };
        for (const [field, value] of Object.entries(sections)) {
          if (field in next) {
            const existing = String((next as Record<string, unknown>)[field] || '').trim();
            (next as Record<string, unknown>)[field] = existing ? existing + '\n' + value : value;
          }
        }
        saveReview(year, month, day, next);
        return next;
      });

      setVoicePhase('done');
      setTimeout(() => setVoicePhase('idle'), 1200);
    } catch {
      setVoicePhase('idle');
    }
  }, [year, month, day, liveText]);

  const autoFillReview = useCallback(async (currentReview: ReviewData) => {
    setAutoFilling(true);
    try {
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

      const text = await parseSSEStream(res.body.getReader());

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
      // Silent fail
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
  const fmtTime = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

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
            {autoFilling && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: skin.swatch + '15', color: skin.swatch }}>
                <span className="animate-spin">⟳</span>
                AI 填充中...
              </div>
            )}
            {!autoFilling && (
              <>
                <button onClick={startVoiceRecording}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1"
                  style={{ backgroundColor: '#ef444415', color: '#ef4444' }}
                >🎙️ 语音复盘</button>
                <button onClick={() => {
                  const fields = [
                    { label: '一、今天完成了什么？', key: 'completed' as const },
                    { label: '二、今天发生了哪些美好或值得关注的事？', key: 'goodThings' as const },
                    { label: '三、今天遇到了哪些突发问题？', key: 'problems' as const },
                    { label: '四、今天心情如何？', key: 'mood' as const },
                    { label: '五、今天有哪些感想或总结？', key: 'reflections' as const },
                    { label: '六、明日待办？', key: 'tomorrowTodo' as const },
                  ];
                  const text = fields.map(f => `${f.label}\n${(review as unknown as Record<string, string | number | undefined>)[f.key] || '（未填写）'}`).join('\n\n');
                  navigator.clipboard.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }).catch(() => {});
                }}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{ backgroundColor: skin.swatch + '15', color: skin.swatch }}
                >{copied ? '✓ 已复制' : '📋 复制'}</button>
                <button onClick={() => autoFillReview(review)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{ backgroundColor: skin.swatch + '15', color: skin.swatch }}
                >AI 重新填充</button>
              </>
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

      {/* Voice Recording Modal */}
      {voicePhase !== 'idle' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="w-[640px] rounded-2xl shadow-2xl p-8 flex flex-col items-center" style={{ backgroundColor: skin.panelBg }}>
            {voicePhase === 'recording' && (
              <>
                {/* Recording indicator */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xl font-bold" style={{ color: skin.textPrimary }}>正在录音</span>
                </div>
                {/* Timer */}
                <div className="text-4xl font-bold mb-6 tabular-nums" style={{ color: skin.swatch }}>
                  {fmtTime(recSeconds)}
                </div>
                {/* Live text */}
                <div className="w-full rounded-xl p-4 mb-6 max-h-[300px] overflow-y-auto" style={{ backgroundColor: skin.cardBg }}>
                  <div className="text-xs mb-2" style={{ color: skin.textMuted }}>实时转写：</div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: skin.textPrimary }}>
                    {liveText || '等待语音...'}
                  </div>
                </div>
                <button onClick={stopVoiceRecording}
                  className="px-8 py-3 rounded-xl text-white font-bold text-sm transition-all"
                  style={{ backgroundColor: '#ef4444' }}
                >⏹ 停止录音</button>
              </>
            )}
            {voicePhase === 'polishing' && (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <span className="animate-spin text-xl">⟳</span>
                  <span className="text-xl font-bold" style={{ color: skin.swatch }}>AI 润色中</span>
                </div>
                {/* Original text */}
                <div className="w-full rounded-xl p-3 mb-3" style={{ backgroundColor: skin.cardBg }}>
                  <div className="text-[10px] mb-1" style={{ color: skin.textMuted }}>原始语音：</div>
                  <div className="text-xs leading-relaxed whitespace-pre-wrap line-through opacity-50" style={{ color: skin.textMuted }}>
                    {liveText.slice(0, 200)}{liveText.length > 200 ? '...' : ''}
                  </div>
                </div>
                {/* Polished text streaming */}
                <div className="w-full rounded-xl p-3 border-2 border-dashed min-h-[150px] max-h-[250px] overflow-y-auto"
                  style={{ borderColor: skin.swatch + '30', backgroundColor: skin.swatch + '08' }}>
                  <div className="text-[10px] mb-1" style={{ color: skin.swatch }}>润色结果：</div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: skin.textPrimary }}>
                    {polishedPreview || '...'}
                  </div>
                </div>
              </>
            )}
            {voicePhase === 'done' && (
              <div className="flex flex-col items-center gap-3">
                <div className="text-4xl">✅</div>
                <div className="text-lg font-bold" style={{ color: skin.swatch }}>复盘已填充完成</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Review Section Component */
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
