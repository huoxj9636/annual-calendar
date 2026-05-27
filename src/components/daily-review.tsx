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

async function loadReview(year: number, month: number, day: number): Promise<ReviewData> {
  const defaultData: ReviewData = { completed: '', goodThings: '', problems: '', mood: '', reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '' };
  try {
    const res = await fetch(`/api/daily-review?year=${year}&month=${month}&day=${day}`);
    if (res.ok) {
      const data = await res.json();
      const hasDBData = data.completed || data.goodThings || data.problems || data.mood || data.reflections || data.tomorrowTodo;
      if (hasDBData) return data;
      // Migrate from localStorage if DB is empty
      try {
        const lsKey = `daily-review-${year}-${month}-${day}`;
        const lsData = localStorage.getItem(lsKey);
        if (lsData) {
          const parsed = JSON.parse(lsData) as ReviewData;
          const hasLSData = parsed.completed || parsed.goodThings || parsed.problems || parsed.mood || parsed.reflections || parsed.tomorrowTodo;
          if (hasLSData) {
            await fetch('/api/daily-review', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ year, month, day, ...parsed }),
            });
            localStorage.removeItem(lsKey);
            return parsed;
          }
        }
      } catch { /* ignore */ }
    }
  } catch {}
  return defaultData;
}

async function saveReview(year: number, month: number, day: number, data: ReviewData) {
  try {
    await fetch('/api/daily-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, day, ...data }),
    });
  } catch {}
}

async function clearReview(year: number, month: number, day: number) {
  try {
    await fetch(`/api/daily-review?year=${year}&month=${month}&day=${day}`, { method: 'DELETE' });
  } catch {}
}

type VoicePhase = 'idle' | 'recording' | 'transcribing' | 'polishing' | 'done';

export default function DailyReview({ year, month, day, skin, events, todos, onClose }: DailyReviewProps) {
  const [review, setReview] = useState<ReviewData>({ completed: '', goodThings: '', problems: '', mood: '', reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '' });
  const [mounted, setMounted] = useState(false);

  const [copied, setCopied] = useState(false);

  // Voice recording state — MediaRecorder based
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [recSeconds, setRecSeconds] = useState(0);
  const [polishedPreview, setPolishedPreview] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
    loadReview(year, month, day).then(setReview);
  }, [year, month, day]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    };
  }, []);

  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4',
      });

      chunksRef.current = [];
      setRecSeconds(0);
      setPolishedPreview('');
      setTranscribedText('');
      setVoicePhase('recording');

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second for reliability

      // Start timer
      timerRef.current = setInterval(() => {
        setRecSeconds(s => s + 1);
      }, 1000);
    } catch {
      alert('无法访问麦克风，请检查浏览器权限设置');
      setVoicePhase('idle');
    }
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
    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Wait a moment for final data
    await new Promise(r => setTimeout(r, 300));

    const chunks = chunksRef.current;
    if (!chunks.length) {
      setVoicePhase('idle');
      return;
    }

    // Phase 1: ASR — send audio to backend for professional speech recognition
    setVoicePhase('transcribing');

    try {
      const mimeType = chunks[0].type || 'audio/webm';
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const audioBlob = new Blob(chunks, { type: mimeType });

      const formData = new FormData();
      formData.append('audio', audioBlob, `recording.${ext}`);

      const asrRes = await fetch('/api/asr', {
        method: 'POST',
        body: formData,
      });

      if (!asrRes.ok) {
        const errData = await asrRes.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || 'ASR failed');
      }

      const asrData = await asrRes.json();
      const spokenText = (asrData as { text?: string }).text?.trim();
      if (!spokenText) {
        setVoicePhase('idle');
        return;
      }

      setTranscribedText(spokenText);

      // Phase 2: AI polishing
      setVoicePhase('polishing');
      setPolishedPreview('');

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

      // Parse sections and fill review — use flexible matching for section headers
      const sectionEntries: Array<{ keywords: string[]; field: keyof ReviewData }> = [
        { keywords: ['完成了什么'], field: 'completed' },
        { keywords: ['美好', '值得关注'], field: 'goodThings' },
        { keywords: ['突发问题', '遇到.*问题', '困难'], field: 'problems' },
        { keywords: ['心情'], field: 'mood' },
        { keywords: ['感想', '总结'], field: 'reflections' },
        { keywords: ['明日待办', '明天.*计划', '明天.*安排'], field: 'tomorrowTodo' },
      ];

      function matchSection(trimmed: string): keyof ReviewData | '' {
        // Match 【...】 format
        const bracketMatch = trimmed.match(/【(.+?)】/);
        if (bracketMatch) {
          const content = bracketMatch[1];
          for (const entry of sectionEntries) {
            if (entry.keywords.every(kw => new RegExp(kw).test(content))) {
              return entry.field;
            }
          }
        }
        // Match plain text like "今天完成了什么："
        const plainMatch = trimmed.replace(/[：:]/g, '');
        for (const entry of sectionEntries) {
          if (entry.keywords.every(kw => new RegExp(kw).test(plainMatch))) {
            return entry.field;
          }
        }
        return '';
      }

      const sections: Record<string, string> = {};
      let currentKey = '';
      let currentLines: string[] = [];

      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        const matched = matchSection(trimmed);
        if (matched) {
          if (currentKey && currentLines.length > 0) {
            sections[currentKey] = currentLines.join('\n');
          }
          currentKey = matched;
          currentLines = [];
        } else if (currentKey && trimmed) {
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
  }, [year, month, day]);

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
                <button onClick={async () => {
                  const empty = { completed: '', goodThings: '', problems: '', mood: '', reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '' };
                  setReview(empty);
                  await clearReview(year, month, day);
                }}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{ backgroundColor: skin.cardHover, color: skin.textMuted }}
                >🗑️ 清空</button>
              </>
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
              compact
            />
            <ReviewSection
              title="今天发生了哪些美好或值得关注的事？"
              icon="✦"
              value={review.goodThings}
              onChange={v => updateField('goodThings', v)}
              skin={skin}
              placeholder="值得记录的好事..."
              compact
            />
            <ReviewSection
              title="今天遇到了哪些突发问题？"
              icon="⚠"
              value={review.problems}
              onChange={v => updateField('problems', v)}
              skin={skin}
              placeholder="遇到的意外或困难..."
              compact
            />
            <ReviewSection
              title="今天心情如何？"
              icon="☺"
              value={review.mood}
              onChange={v => updateField('mood', v)}
              skin={skin}
              placeholder="简单描述心情..."
              compact
            />
            <ReviewSection
              title="今天有哪些感想或总结？"
              icon="◎"
              value={review.reflections}
              onChange={v => updateField('reflections', v)}
              skin={skin}
              placeholder="今天的思考..."
              compact
            />
            <ReviewSection
              title="明日待办？"
              icon="→"
              value={review.tomorrowTodo}
              onChange={v => updateField('tomorrowTodo', v)}
              skin={skin}
              placeholder="明天要做的事..."
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
                <div className="text-4xl font-bold mb-4 tabular-nums" style={{ color: skin.swatch }}>
                  {fmtTime(recSeconds)}
                </div>
                {/* Tips */}
                <div className="text-sm mb-6" style={{ color: skin.textMuted }}>
                  点击停止后将自动识别语音内容
                </div>
                <button onClick={stopVoiceRecording}
                  className="px-8 py-3 rounded-xl text-white font-bold text-sm transition-all"
                  style={{ backgroundColor: '#ef4444' }}
                >⏹ 停止录音</button>
              </>
            )}
            {voicePhase === 'transcribing' && (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <span className="animate-spin text-xl">⟳</span>
                  <span className="text-xl font-bold" style={{ color: skin.swatch }}>语音识别中</span>
                </div>
                <div className="text-sm" style={{ color: skin.textMuted }}>
                  正在使用专业语音识别引擎转写...
                </div>
              </>
            )}
            {voicePhase === 'polishing' && (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <span className="animate-spin text-xl">⟳</span>
                  <span className="text-xl font-bold" style={{ color: skin.swatch }}>AI 润色中</span>
                </div>
                {/* Original transcribed text */}
                {transcribedText && (
                  <div className="w-full rounded-xl p-3 mb-3" style={{ backgroundColor: skin.cardBg }}>
                    <div className="text-[10px] mb-1" style={{ color: skin.textMuted }}>语音识别结果：</div>
                    <div className="text-xs leading-relaxed whitespace-pre-wrap line-through opacity-50" style={{ color: skin.textMuted }}>
                      {transcribedText.slice(0, 200)}{transcribedText.length > 200 ? '...' : ''}
                    </div>
                  </div>
                )}
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
function ReviewSection({ title, icon, value, onChange, skin, placeholder, fullWidth, compact }: {
  title: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
  skin: DailyReviewProps['skin'];
  placeholder: string;
  fullWidth?: boolean;
  compact?: boolean;
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
