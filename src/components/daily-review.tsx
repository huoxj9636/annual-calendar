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
    const res = await fetch('/api/daily-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, day, ...data }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[saveReview] Failed:', res.status, err);
    }
  } catch (e) {
    console.error('[saveReview] Network error:', e);
  }
}

// Save gantt rows to localStorage
function saveGanttRows(year: number, month: number, day: number, rows: Array<{ id: number; task: string; startHour: number; endHour: number; color: string }>) {
  try {
    localStorage.setItem(`gantt-rows-${year}-${month}-${day}`, JSON.stringify(rows));
  } catch (e) {
    console.error('[saveGanttRows] Failed:', e);
  }
}

async function clearReview(year: number, month: number, day: number) {
  try {
    await fetch(`/api/daily-review?year=${year}&month=${month}&day=${day}`, { method: 'DELETE' });
  } catch {}
}

type VoicePhase = 'idle' | 'recording' | 'paused' | 'reviewing' | 'transcribing' | 'polishing' | 'done';

export default function DailyReview({ year, month, day, skin, events, todos, onClose }: DailyReviewProps) {
  const [review, setReview] = useState<ReviewData>({ completed: '', goodThings: '', problems: '', mood: '', reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '' });
  const reviewRef = useRef(review);
  reviewRef.current = review;
  const [mounted, setMounted] = useState(false);

  const [copied, setCopied] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importHtml, setImportHtml] = useState('');
  const [importMode, setImportMode] = useState<'text' | 'html'>('text');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const importTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // View mode: 'review' or 'gantt'
  const [viewMode, setViewMode] = useState<'review' | 'gantt'>('review');
  const [ganttRows, setGanttRows] = useState<Array<{ id: number; task: string; startHour: number; endHour: number; color: string }>>(() => {
    const rows = [];
    for (let i = 0; i < 15; i++) {
      rows.push({
        id: i + 1,
        task: '',
        startHour: 0,
        endHour: 24,
        color: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'][i % 8]
      });
    }
    return rows;
  });
  const ganttColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

  // Add a new gantt row
  const addGanttRow = () => {
    const newId = ganttRows.length > 0 ? Math.max(...ganttRows.map(r => r.id)) + 1 : 1;
    setGanttRows([...ganttRows, {
      id: newId,
      task: '',
      startHour: 0,
      endHour: 24,
      color: ganttColors[newId % ganttColors.length]
    }]);
  };

  // Update a gantt row
  const updateGanttRow = (id: number, field: 'task' | 'startHour' | 'endHour', value: string | number) => {
    setGanttRows(ganttRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  // Delete a gantt row
  const deleteGanttRow = (id: number) => {
    setGanttRows(ganttRows.filter(row => row.id !== id));
  };

  // Voice recording state — MediaRecorder based
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [recSeconds, setRecSeconds] = useState(0);
  const [polishedPreview, setPolishedPreview] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(40).fill(0));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  // Drag state for voice modal
  const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Drag handlers for voice modal
  const onDragMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const modal = (e.currentTarget as HTMLElement).closest('[data-voice-modal]') as HTMLElement;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
  };
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      setModalPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  useEffect(() => {
    setMounted(true);
    loadReview(year, month, day).then(setReview);
  }, [year, month, day]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  // Load gantt rows from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`gantt-rows-${year}-${month}-${day}`);
      if (stored) {
        const rows = JSON.parse(stored);
        if (Array.isArray(rows) && rows.length > 0) {
          setGanttRows(rows);
        }
      }
    } catch {}
  }, [year, month, day]);

  const startAudioVisualization = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    audioContextRef.current = audioCtx;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      const levels = Array.from(dataArray.slice(0, 40)).map(v => v / 255);
      setAudioLevels(levels);
      animFrameRef.current = requestAnimationFrame(update);
    };
    update();
  }, []);

  const stopAudioVisualization = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevels(new Array(40).fill(0));
  }, []);

  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      // Start audio visualization
      startAudioVisualization(stream);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecSeconds(s => s + 1);
      }, 1000);
    } catch {
      alert('无法访问麦克风，请检查浏览器权限设置');
      setVoicePhase('idle');
      setModalPos(null);
    }
  }, [startAudioVisualization]);

  const pauseVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopAudioVisualization();
    setVoicePhase('paused');
  }, [stopAudioVisualization]);

  const resumeVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    if (streamRef.current) {
      startAudioVisualization(streamRef.current);
    }
    timerRef.current = setInterval(() => {
      setRecSeconds(s => s + 1);
    }, 1000);
    setVoicePhase('recording');
  }, [startAudioVisualization]);

  const stopAndReview = useCallback(() => {
    // Stop recording but keep chunks for review
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopAudioVisualization();
    // Release microphone
    streamRef.current?.getTracks().forEach(t => t.stop());
    setVoicePhase('reviewing');
  }, [stopAudioVisualization]);

  const discardRecording = useCallback(() => {
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setVoicePhase('idle');
    setRecSeconds(0);
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

  const confirmAndTranscribe = useCallback(async () => {
    // Wait a moment for final data
    await new Promise(r => setTimeout(r, 300));

    const chunks = chunksRef.current;
    if (!chunks.length) {
      setVoicePhase('idle');
      setModalPos(null);
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
      setModalPos(null);
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
      setModalPos(null);
        return;
      }

      const text = await parseSSEStream(res.body.getReader(), (partial) => {
        setPolishedPreview(partial);
      });

      // Parse sections and fill review — use ordered priority matching
      // Order matters: more specific patterns first to avoid misclassification
      const sectionPatterns: Array<{ pattern: RegExp; field: keyof ReviewData }> = [
        { pattern: /完成了什么/, field: 'completed' },
        { pattern: /突发|遇到了.*问题|卡点|意外|困难/, field: 'problems' },
        { pattern: /美好|值得关注|好事/, field: 'goodThings' },
        { pattern: /心情/, field: 'mood' },
        { pattern: /明日待办|明日.*计划|明天.*待办|明天.*计划|明天.*安排/, field: 'tomorrowTodo' },
        { pattern: /感想|总结|感悟|收获/, field: 'reflections' },
      ];

      function matchSection(trimmed: string): keyof ReviewData | '' {
        // Match 【...】 format
        const bracketMatch = trimmed.match(/【(.+?)】/);
        const content = bracketMatch ? bracketMatch[1] : trimmed.replace(/[：:]/g, '');
        if (!content) return '';
        // Priority-ordered: first match wins
        for (const entry of sectionPatterns) {
          if (entry.pattern.test(content)) {
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

      // Compute the merged review data (append new sections to existing)
      const nextReview = { ...reviewRef.current };
      for (const [field, value] of Object.entries(sections)) {
        if (field in nextReview) {
          const existing = String((nextReview as Record<string, unknown>)[field] || '').trim();
          (nextReview as Record<string, unknown>)[field] = existing ? existing + '\n' + value : value;
        }
      }
      setReview(nextReview);
      saveReview(year, month, day, nextReview);

      setVoicePhase('done');
      setTimeout(() => setVoicePhase('idle'), 1200);
    } catch {
      setVoicePhase('idle');
      setModalPos(null);
    }
  }, [year, month, day]);

  const updateField = useCallback((field: keyof ReviewData, value: string | number) => {
    const next = { ...reviewRef.current, [field]: value };
    setReview(next);
    saveReview(year, month, day, next);
  }, [year, month, day]);

  if (!mounted) return null;

  const dateStr = `${month}月${day}日`;
  const fmtTime = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[1320px] h-[820px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ backgroundColor: skin.panelBg }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: skin.cellBorder }}>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xl font-bold" style={{ color: skin.textPrimary }}>{dateStr} 复盘</div>
              <div className="text-xs font-medium tracking-wider" style={{ color: skin.textMuted }}>DAILY REVIEW</div>
            </div>
            <>
              <button onClick={startVoiceRecording}
                  className="text-sm px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1"
                  style={{ backgroundColor: '#ef444415', color: '#ef4444' }}
                >🎙️ 语音复盘</button>
                <button onClick={() => setShowImport(true)}
                    className="text-sm px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1"
                    style={{ backgroundColor: '#3b82f615', color: '#3b82f6' }}
                  >📥 导入笔记</button>
                <button onClick={() => setViewMode(viewMode === 'gantt' ? 'review' : 'gantt')}
                    className="text-sm px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1"
                    style={{ backgroundColor: viewMode === 'gantt' ? '#22c55e' : '#22c55e15', color: viewMode === 'gantt' ? '#fff' : '#22c55e' }}
                  >📊 甘特图</button>
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
                  className="text-sm px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{ backgroundColor: skin.swatch + '15', color: skin.swatch }}
                >{copied ? '✓ 已复制' : '📋 复制'}</button>
                <button onClick={async () => {
                  const empty = { completed: '', goodThings: '', problems: '', mood: '', reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '' };
                  setReview(empty);
                  await clearReview(year, month, day);
                }}
                  className="text-sm px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{ backgroundColor: skin.swatch + '15', color: skin.swatch }}
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
        <div className="px-6 py-3 flex-1 overflow-auto">
          {viewMode === 'gantt' ? (
            /* Gantt View */
            <div className="flex flex-col gap-2">
              {/* Header row */}
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setViewMode('review')}
                    className="text-sm px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1"
                    style={{ backgroundColor: skin.cardHover, color: skin.textMuted }}
                  >← 返回复盘</button>
                <span className="text-lg font-bold" style={{ color: skin.textPrimary }}>24小时甘特图</span>
              </div>
              {/* Hour labels */}
              <div className="flex items-center pl-24 pr-4 mb-1">
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="w-10 text-center text-xs font-medium" style={{ color: skin.textMuted }}>{i}</div>
                ))}
              </div>
              {/* Rows */}
              {ganttRows.map((row, idx) => (
                <GanttRow
                  key={idx}
                  row={row}
                  idx={idx}
                  skin={skin}
                  ganttColors={ganttColors}
                  onUpdateRow={(r) => {
                    const next = [...ganttRows];
                    next[idx] = r;
                    setGanttRows(next);
                    saveGanttRows(year, month, day, next);
                  }}
                  onDelete={() => {
                    if (ganttRows.length > 1) {
                      const next = ganttRows.filter((_, i) => i !== idx);
                      setGanttRows(next);
                      saveGanttRows(year, month, day, next);
                    }
                  }}
                />
              ))}
              {/* Add row button */}
              <button
                onClick={() => {
                  const newId = ganttRows.length > 0 ? Math.max(...ganttRows.map(r => r.id)) + 1 : 1;
                  const next = [...ganttRows, { id: newId, task: '', startHour: 0, endHour: 24, color: ganttColors[newId % ganttColors.length] }];
                  setGanttRows(next);
                  saveGanttRows(year, month, day, next);
                }}
                className="mt-2 text-sm px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 w-full justify-center"
                style={{ backgroundColor: skin.cardHover, color: skin.textMuted }}
              >➕ 添加新行</button>
            </div>
          ) : (
            /* Review View */
            <div className="grid grid-cols-3 grid-rows-2 gap-3 mb-3 h-full">
              <ReviewSection
              title="今天完成了什么？"
              icon="✓"
              value={review.completed}
              onChange={v => updateField('completed', v)}
              skin={skin}
              placeholder="列出今天完成的事项..."
            />
            <ReviewSection
              title="今天发生了哪些美好或值得关注的事？"
              icon="✦"
              value={review.goodThings}
              onChange={v => updateField('goodThings', v)}
              skin={skin}
              placeholder="值得记录的好事..."
            />
            <ReviewSection
              title="今天遇到了哪些突发问题？"
              icon="⚠"
              value={review.problems}
              onChange={v => updateField('problems', v)}
              skin={skin}
              placeholder="遇到的意外或困难..."
            />
            <ReviewSection
              title="今天心情如何？"
              icon="☺"
              value={review.mood}
              onChange={v => updateField('mood', v)}
              skin={skin}
              placeholder="简单描述心情..."
            />
            <ReviewSection
              title="今天有哪些感想或总结？"
              icon="◎"
              value={review.reflections}
              onChange={v => updateField('reflections', v)}
              skin={skin}
              placeholder="今天的思考..."
            />
            <ReviewSection
              title="明日待办？"
              icon="→"
              value={review.tomorrowTodo}
              onChange={v => updateField('tomorrowTodo', v)}
              skin={skin}
              placeholder="明天要做的事..."
            />
          </div>
          )}
        </div>
      </div>

      {/* Voice Recording Modal — draggable floating panel */}
      {voicePhase !== 'idle' && (
        <div
          data-voice-modal
          className="fixed z-[70] rounded-2xl shadow-2xl p-6 flex flex-col items-center select-none"
          style={{
            backgroundColor: skin.panelBg,
            left: modalPos ? modalPos.x : '50%',
            top: modalPos ? modalPos.y : '50%',
            transform: modalPos ? 'none' : 'translate(-50%, -50%)',
            minWidth: 420,
            cursor: isDragging ? 'grabbing' : 'default',
          }}
        >
            {/* Drag handle */}
            <div
              onMouseDown={onDragMouseDown}
              className="w-full flex items-center justify-center mb-3 cursor-grab active:cursor-grabbing py-1"
              style={{ touchAction: 'none' }}
            >
              <div className="w-10 h-1.5 rounded-full" style={{ backgroundColor: skin.textMuted + '40' }} />
            </div>
            {(voicePhase === 'recording' || voicePhase === 'paused') && (
              <>
                {/* Recording indicator */}
                <div className="flex items-center gap-3 mb-4">
                  <span className={`w-3 h-3 rounded-full ${voicePhase === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`} />
                  <span className="text-xl font-bold" style={{ color: skin.textPrimary }}>
                    {voicePhase === 'recording' ? '正在录音' : '已暂停'}
                  </span>
                </div>
                {/* Timer */}
                <div className="text-4xl font-bold mb-4 tabular-nums" style={{ color: skin.swatch }}>
                  {fmtTime(recSeconds)}
                </div>
                {/* Audio waveform visualization */}
                <div className="flex items-center justify-center gap-[2px] h-16 mb-6 w-full px-4">
                  {audioLevels.map((level, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all duration-75"
                      style={{
                        width: '6px',
                        height: `${Math.max(4, level * 56)}px`,
                        backgroundColor: voicePhase === 'paused' ? skin.textMuted : skin.swatch,
                        opacity: voicePhase === 'paused' ? 0.4 : 0.5 + level * 0.5,
                      }}
                    />
                  ))}
                </div>
                {/* Controls */}
                <div className="flex items-center gap-4">
                  {voicePhase === 'recording' ? (
                    <>
                      <button onClick={pauseVoiceRecording}
                        className="px-6 py-2.5 rounded-xl font-bold text-base transition-all border"
                        style={{ borderColor: skin.swatch + '40', color: skin.swatch }}
                      >⏸ 暂停</button>
                      <button onClick={stopAndReview}
                        className="px-6 py-2.5 rounded-xl text-white font-bold text-base transition-all"
                        style={{ backgroundColor: '#ef4444' }}
                      >⏹ 结束</button>
                    </>
                  ) : (
                    <>
                      <button onClick={resumeVoiceRecording}
                        className="px-6 py-2.5 rounded-xl font-bold text-base transition-all border"
                        style={{ borderColor: skin.swatch + '40', color: skin.swatch }}
                      >▶ 继续</button>
                      <button onClick={stopAndReview}
                        className="px-6 py-2.5 rounded-xl text-white font-bold text-sm transition-all"
                        style={{ backgroundColor: '#ef4444' }}
                      >⏹ 结束</button>
                    </>
                  )}

            </div>
          </>
        )}
        {voicePhase === 'reviewing' && (
              <>
                <div className="text-4xl mb-4">🎤</div>
                <div className="text-lg font-bold mb-2" style={{ color: skin.textPrimary }}>
                  录音完成 · {fmtTime(recSeconds)}
                </div>
                <div className="text-base mb-8" style={{ color: skin.textMuted }}>
                  是否采用这段录音进行语音识别？
                </div>
                <div className="flex items-center gap-6">
                  <button onClick={discardRecording}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all border-2"
                    style={{ borderColor: '#ef444460', color: '#ef4444', backgroundColor: '#ef444410' }}
                    title="弃用"
                  >✕</button>
                  <button onClick={confirmAndTranscribe}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all border-2"
                    style={{ borderColor: '#22c55e60', color: '#22c55e', backgroundColor: '#22c55e10' }}
                    title="采用"
                  >✓</button>
                </div>
              </>
            )}
            {voicePhase === 'transcribing' && (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <span className="animate-spin text-xl">⟳</span>
                  <span className="text-xl font-bold" style={{ color: skin.swatch }}>语音识别中</span>
                </div>
                <div className="text-base" style={{ color: skin.textMuted }}>
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
                <div className="w-full rounded-xl p-4 border-2 border-dashed min-h-[180px] max-h-[300px] overflow-y-auto"
                  style={{ borderColor: skin.swatch + '30', backgroundColor: skin.swatch + '08' }}>
                  <div className="text-xs mb-1" style={{ color: skin.swatch }}>润色结果：</div>
                  <div className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: skin.textPrimary }}>
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
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowImport(false); } }}>
          <div className="w-[840px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ backgroundColor: skin.panelBg }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: skin.cellBorder }}>
              <div className="font-bold" style={{ color: skin.textPrimary }}>📥 导入笔记</div>
              <div className="flex items-center gap-1">
                <button onClick={() => setImportMode('text')}
                  className="px-3 py-1 rounded-lg text-sm font-medium transition-all"
                  style={{ backgroundColor: importMode === 'text' ? skin.swatch + '20' : 'transparent', color: importMode === 'text' ? skin.swatch : skin.textMuted, border: '1px solid ' + (importMode === 'text' ? skin.swatch + '40' : 'transparent') }}
                >纯文本</button>
                <button onClick={() => setImportMode('html')}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{ backgroundColor: importMode === 'html' ? skin.swatch + '20' : 'transparent', color: importMode === 'html' ? skin.swatch : skin.textMuted, border: '1px solid ' + (importMode === 'html' ? skin.swatch + '40' : 'transparent') }}
                >HTML</button>
                <span className="mx-2" style={{ color: skin.cellBorder }}>|</span>
                <button onClick={() => { setShowImport(false); }} className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: skin.cardHover, color: skin.textMuted }}>✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5 flex flex-col gap-3">
              <>
                  <div className="text-base" style={{ color: skin.textMuted }}>
                    {importMode === 'text'
                      ? '粘贴每日复盘文本，系统会自动识别日期并将内容智能分类到6个复盘维度。'
                      : '粘贴或导入本地 HTML 文件，系统会自动识别日期并将内容智能分类到6个复盘维度。'}
                  </div>
                  {importMode === 'html' && (
                    <div className="flex items-center gap-2">
                      <label
                        className="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all hover:opacity-80"
                        style={{ backgroundColor: skin.swatch + '15', color: skin.swatch, border: '1px solid ' + skin.swatch + '30' }}
                      >
                        📂 选择本地 HTML 文件
                        <input
                          type="file"
                          accept=".html,.htm"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const text = await file.text();
                              setImportHtml(text);
                            } catch {
                              alert('读取文件失败，请重试');
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {importHtml && (
                        <span className="text-xs" style={{ color: skin.textMuted }}>
                          已加载 {importHtml.length > 1000 ? (importHtml.length / 1024).toFixed(1) + 'KB' : importHtml.length + '字'}
                        </span>
                      )}
                    </div>
                  )}
                  <textarea
                    value={importHtml}
                    onChange={e => setImportHtml(e.target.value)}
                    placeholder={importMode === 'text'
                      ? "在此粘贴复盘文本内容...\n\n支持格式：\n· 2024年5月27日\n今天完成了xxx，心情不错\n明天要继续推进xxx\n\n· 2024-05-28\n今天遇到了xxx问题..."
                      : "在此粘贴笔记 HTML 内容...\n\n支持格式：\n· 2024年5月27日 + 内容\n· 2024-05-27 + 内容\n· 2024/05/27 + 内容"}
                    className="w-full h-[300px] rounded-xl p-4 text-base resize-none focus:outline-none focus:ring-2"
                    style={{ backgroundColor: skin.cardHover, color: skin.textPrimary, borderColor: skin.cellBorder }}
                  />
                  <button
                    onClick={async () => {
                      if (!importHtml.trim() || importing) return;
                      setImporting(true);
                      setImportProgress(0);
                      // 模拟进度条：快速到90%，最后10%等真实完成
                      importTimerRef.current = setInterval(() => {
                        setImportProgress(prev => {
                          if (prev >= 90) return prev; // 90%后停住
                          return prev + Math.random() * 8 + 2;
                        });
                      }, 300);
                      try {
                        const res = await fetch('/api/import-review', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(importMode === 'text' ? { text: importHtml, year, month, day } : { html: importHtml }),
                        });
                        const data = await res.json();
                        if (importTimerRef.current) clearInterval(importTimerRef.current);
                        setImportProgress(100);
                        await new Promise(r => setTimeout(r, 300)); // 让用户看到100%
                        if (data.error) {
                          alert(data.error);
                        } else if (data.taskId) {
                          // 异步任务已创建，后台处理中
                          // 关闭导入弹窗，用户可通过"后台任务"按钮查看进度
                          setShowImport(false);
                          setImportHtml('');
                        } else {
                          // 兼容旧版同步返回
                          const freshData = await loadReview(year, month, day);
                          if (freshData) setReview(freshData);
                          setShowImport(false);
                          setImportHtml('');
                        }
                      } catch (err) {
                        if (importTimerRef.current) clearInterval(importTimerRef.current);
                        alert('导入失败: ' + (err instanceof Error ? err.message : '未知错误'));
                      } finally {
                        setImporting(false);
                        setImportProgress(0);
                        if (importTimerRef.current) clearInterval(importTimerRef.current);
                      }
                    }}
                    disabled={!importHtml.trim() || importing}
                    className="px-6 py-2.5 rounded-xl font-medium text-white text-base transition-all disabled:opacity-50"
                    style={{ backgroundColor: importing ? skin.textMuted : '#3b82f6' }}
                  >
                    {importing ? (
                      <span className="flex flex-col items-center gap-2 w-full">
                        <span>⏳ 正在解析和分类...</span>
                        <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: skin.textMuted + '25' }}>
                          <div
                            className="h-full rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${importProgress}%`, background: `linear-gradient(90deg, ${skin.swatch}90, ${skin.swatch})` }}
                          />
                        </div>
                        <span className="text-xs opacity-70">{Math.round(importProgress)}%</span>
                      </span>
                    ) : '🚀 开始导入'}
                  </button>
                </>
            </div>
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
    <div className={`rounded-xl p-4 flex flex-col h-full relative transition-colors duration-300 ${fullWidth ? 'col-span-2' : ''}`} style={{ backgroundColor: value.trim() ? skin.cardBg : `${skin.cardBg}60` }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base" style={{ color: skin.swatch }}>{icon}</span>
        <span className="text-base font-bold" style={{ color: skin.textPrimary }}>{title}</span>
      </div>
      <textarea
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full flex-1 bg-transparent text-sm leading-relaxed outline-none border border-transparent rounded-lg p-2.5 resize-none transition-colors"
        style={{ color: skin.textPrimary }}
      />
    </div>
  );
}

/* Gantt Row Component */
type GanttRowData = {
  id: number;
  task: string;
  startHour: number;
  endHour: number;
  color: string;
};

type DailyReviewSkin = {
  swatch: string;
  panelBg: string;
  cardBg: string;
  cardHover: string;
  textPrimary: string;
  textMuted: string;
  cellBorder: string;
  tabActive: string;
};

function GanttRow({ row, idx, skin, onUpdateRow, onDelete }: {
  row: GanttRowData;
  idx: number;
  skin: DailyReviewSkin;
  ganttColors: string[];
  onUpdateRow: (row: GanttRowData) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex mb-1 items-center group">
      {/* Task name input */}
      <div className="w-[140px] shrink-0 px-2">
        <input
          type="text"
          value={row.task}
          onChange={e => onUpdateRow({ ...row, task: e.target.value })}
          placeholder={`事项 ${idx + 1}`}
          className="w-full px-2 py-1.5 rounded-lg text-sm outline-none border"
          style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, borderColor: skin.cellBorder }}
        />
      </div>
      {/* Time bar */}
      <div className="flex-1 relative h-8 rounded-lg mx-0.5" style={{ backgroundColor: skin.cardHover }}>
        <div
          className="absolute h-full rounded-lg cursor-pointer transition-all hover:opacity-80"
          style={{
            left: `${(row.startHour / 24) * 100}%`,
            width: `${((row.endHour - row.startHour) / 24) * 100}%`,
            backgroundColor: row.color,
            minWidth: '4px',
          }}
          title={`${row.startHour}:00 - ${row.endHour}:00`}
        />
        {/* Hour grid lines */}
        <div className="absolute inset-0 pointer-events-none" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)' }}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="border-r opacity-20" style={{ borderColor: skin.cellBorder }} />
          ))}
        </div>
        {/* Click handlers */}
        <div className="absolute inset-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)' }}>
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              className="cursor-pointer hover:bg-black/5"
              onClick={(e) => {
                const parentRect = e.currentTarget.parentElement!.getBoundingClientRect();
                const clickX = e.clientX - parentRect.left;
                const totalWidth = parentRect.width;
                const clickedHour = Math.floor((clickX / totalWidth) * 24);

                const startDist = Math.abs(clickX - (row.startHour / 24) * totalWidth);
                const endDist = Math.abs(clickX - (row.endHour / 24) * totalWidth);

                if (startDist < endDist && clickedHour < row.endHour) {
                  onUpdateRow({ ...row, startHour: clickedHour });
                } else if (clickedHour > row.startHour) {
                  onUpdateRow({ ...row, endHour: clickedHour + 1 > 24 ? 24 : clickedHour + 1 });
                }
              }}
            />
          ))}
        </div>
      </div>
      {/* Delete button */}
      <div className="w-[40px] shrink-0 text-center">
        <button
          onClick={onDelete}
          className="w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
        >×</button>
      </div>
    </div>
  );
}
