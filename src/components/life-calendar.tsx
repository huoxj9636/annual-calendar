'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SKINS } from '@/lib/skins';
import ParticleEffect from '@/components/particle-effect';

interface LifeCalendarProps {
  birthYear: number;
  setBirthYear: (year: number) => void;
  onClose: () => void;
  skinKey?: string;
}

// ── Data types ──
type OKRStatus = 'not_started' | 'in_progress' | 'completed';

interface TomatoItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: number;
}

interface Task {
  id: string;
  title: string;
  estimatedTomatoes: number;
  tomatoes: TomatoItem[];
}

interface KeyResult {
  id: string;
  description: string;
  tasks: Task[];
}

interface OKRReview {
  id: string;
  date: string;
  content: string;
}

interface OKR {
  id: string;
  objective: string;
  status: OKRStatus;
  period: string;
  keyResults: KeyResult[];
  reviews: OKRReview[];
  createdAt: number;
}

type PeriodType = 'annual' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

// ── Constants ──
const STATUS_CYCLE: OKRStatus[] = ['not_started', 'in_progress', 'completed'];
const STATUS_CFG: Record<OKRStatus, { label: string; icon: string }> = {
  not_started: { label: '未开始', icon: '⚪' },
  in_progress: { label: '进行中', icon: '🔵' },
  completed: { label: '已完成', icon: '🟢' },
};

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Progress auto-calc ──
function taskProgress(t: Task): number {
  if (t.estimatedTomatoes <= 0) return 0;
  return Math.min(t.tomatoes.filter(tm => tm.completed).length / t.estimatedTomatoes, 1);
}
function krProgress(kr: KeyResult): number {
  if (kr.tasks.length === 0) return 0;
  return kr.tasks.reduce((s, t) => s + taskProgress(t), 0) / kr.tasks.length;
}
function okrProgress(okr: OKR): number {
  if (okr.keyResults.length === 0) return 0;
  return okr.keyResults.reduce((s, kr) => s + krProgress(kr), 0) / okr.keyResults.length;
}
function krTomatoStats(kr: KeyResult): { done: number; total: number } {
  let done = 0, total = 0;
  for (const t of kr.tasks) { total += t.estimatedTomatoes; done += t.tomatoes.filter(tm => tm.completed).length; }
  return { done, total };
}
function okrTomatoStats(okr: OKR): { done: number; total: number } {
  let done = 0, total = 0;
  for (const kr of okr.keyResults) { const s = krTomatoStats(kr); done += s.done; total += s.total; }
  return { done, total };
}

function statusColor(status: OKRStatus, swatch: string): string {
  switch (status) {
    case 'completed': return '#22c55e';
    case 'in_progress': return swatch;
    default: return '#94a3b8';
  }
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  return String(m).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800; gain.gain.value = 0.3;
    osc.start(); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5); osc.stop(ctx.currentTime + 0.5);
  } catch { /* ignore */ }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateOKRs(raw: any[]): OKR[] {
  return raw.map((o: any) => ({
    id: o.id || genId(),
    objective: o.objective || '',
    status: STATUS_CYCLE.includes(o.status as OKRStatus) ? (o.status as OKRStatus) : 'not_started',
    period: o.period || '',
    createdAt: o.createdAt || Date.now(),
    keyResults: (o.keyResults || []).map((kr: any) => ({
      id: kr.id || genId(),
      description: kr.description || '',
      tasks: (kr.tasks || []).map((t: any) => ({
        id: t.id || genId(),
        title: t.title || '',
        estimatedTomatoes: typeof t.estimatedTomatoes === 'number' ? t.estimatedTomatoes : (typeof t.targetValue === 'number' ? t.targetValue : 1),
        tomatoes: (t.tomatoes || []).map((tm: any) => ({
          id: tm.id || genId(),
          title: tm.title || '',
          completed: !!tm.completed,
          completedAt: tm.completedAt as number | undefined,
        })),
      })),
    })),
    reviews: (o.reviews || []).map((r: any) => ({
      id: r.id || genId(),
      date: r.date || '',
      content: r.content || '',
    })),
  })) as OKR[];
}

// ── Component ──
export default function LifeCalendar({ onClose, skinKey }: LifeCalendarProps) {
  const skin = SKINS.find(s => s.key === skinKey) || SKINS[0];
  const swatch = skin.swatch || '#6558c1';

  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [period, setPeriod] = useState<PeriodType>(() => { const m = new Date().getMonth(); if (m < 3) return 'Q1'; if (m < 6) return 'Q2'; if (m < 9) return 'Q3'; return 'Q4'; });
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Inline editing
  const [newO, setNewO] = useState('');
  const [expandedKR, setExpandedKR] = useState<Set<string>>(new Set());
  const [expandedTask, setExpandedTask] = useState<Set<string>>(new Set());
  const [editingO, setEditingO] = useState<string | null>(null);
  const [editOText, setEditOText] = useState('');
  const [addKR_O, setAddKR_O] = useState<string | null>(null);
  const [newKRDesc, setNewKRDesc] = useState('');
  const [addTask_KR, setAddTask_KR] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskEst, setNewTaskEst] = useState('1');
  const [addTomato_Task, setAddTomato_Task] = useState<string | null>(null);
  const [newTomatoTitle, setNewTomatoTitle] = useState('');
  const [reviewO, setReviewO] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');

  // Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerDone, setTimerDone] = useState(false);
  const [timerLabels, setTimerLabels] = useState<string[]>([]);
  const [timerNote, setTimerNote] = useState('');
  const activeCtx = useRef<{ okrId: string; krId: string; taskId: string; tomatoId: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Daily
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dailyTarget, setDailyTarget] = useState(8);
  const [interruptions, setInterruptions] = useState(0);

  const year = new Date().getFullYear();
  const periodKey = period === 'annual' ? `${year}` : `${year}-${period}`;
  const periodLabel = period === 'annual' ? `${year}年度` : `${year} ${period}`;

  // ── Load ──
  useEffect(() => {
    const saved = localStorage.getItem('okr-data');
    if (saved) { try { setOkrs(migrateOKRs(JSON.parse(saved))); } catch { /* ignore */ } }
    const dt = localStorage.getItem('tomato-daily-target');
    if (dt) setDailyTarget(Number(dt) || 8);
    const ir = localStorage.getItem(`tomato-interrupt-${todayKey}`);
    if (ir) setInterruptions(Number(ir) || 0);
    setMounted(true);
  }, [todayKey]);

  // ── Save ──
  useEffect(() => { if (mounted) localStorage.setItem('okr-data', JSON.stringify(okrs)); }, [okrs, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('tomato-daily-target', String(dailyTarget)); }, [dailyTarget, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem(`tomato-interrupt-${todayKey}`, String(interruptions)); }, [interruptions, mounted, todayKey]);

  // ── Derived ──
  const filteredOKRs = useMemo(() => okrs.filter(o => o.period === periodKey), [okrs, periodKey]);
  const selectedOKR = useMemo(() => okrs.find(o => o.id === selectedId) || null, [okrs, selectedId]);

  const globalStats = useMemo(() => {
    let totalTomatoes = 0, doneTomatoes = 0;
    for (const o of filteredOKRs) { const s = okrTomatoStats(o); totalTomatoes += s.total; doneTomatoes += s.done; }
    const avg = filteredOKRs.length > 0
      ? Math.round(filteredOKRs.reduce((s, o) => s + okrProgress(o), 0) / filteredOKRs.length * 100)
      : 0;
    return { totalOKRs: filteredOKRs.length, totalTomatoes, doneTomatoes, avgProgress: avg };
  }, [filteredOKRs]);

  const todayTomatoes = useMemo(() => {
    let c = 0;
    for (const o of okrs) for (const kr of o.keyResults) for (const t of kr.tasks) for (const tm of t.tomatoes) {
      if (tm.completed && tm.completedAt && new Date(tm.completedAt).toISOString().slice(0, 10) === todayKey) c++;
    }
    return c;
  }, [okrs, todayKey]);

  // ── Timer ──
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (!timerActive || timerPaused) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => { if (prev <= 1) { clearInterval(intervalRef.current!); return 0; } return prev - 1; });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerActive, timerPaused]);

  useEffect(() => {
    if (secondsLeft !== 0 || !timerActive) return;
    const ctx = activeCtx.current;
    if (ctx) {
      setOkrs(prev => prev.map(o => o.id !== ctx.okrId ? o : {
        ...o, keyResults: o.keyResults.map(kr => kr.id !== ctx.krId ? kr : {
          ...kr, tasks: kr.tasks.map(t => t.id !== ctx.taskId ? t : {
            ...t, tomatoes: t.tomatoes.map(tm => tm.id === ctx.tomatoId ? { ...tm, completed: true, completedAt: Date.now() } : tm),
          }),
        }),
      }));
      playBeep();
    }
    setTimerActive(false); setTimerDone(true); activeCtx.current = null;
    setTimeout(() => setTimerDone(false), 2000);
  }, [secondsLeft, timerActive]);

  // ── Actions ──
  const addOKR = useCallback(() => {
    if (!newO.trim()) return;
    const o: OKR = { id: genId(), objective: newO.trim(), status: 'in_progress', period: periodKey, keyResults: [], reviews: [], createdAt: Date.now() };
    setOkrs(prev => [...prev, o]); setNewO('');
    setSelectedId(o.id);
  }, [newO, periodKey]);

  const cycleStatus = useCallback((id: string) => {
    setOkrs(prev => prev.map(o => { if (o.id !== id) return o; const i = STATUS_CYCLE.indexOf(o.status); return { ...o, status: STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] }; }));
  }, []);

  const deleteOKR = useCallback((id: string) => {
    setOkrs(prev => prev.filter(o => o.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
  }, []);

  const saveObjective = useCallback((id: string) => {
    if (!editOText.trim()) { setEditingO(null); return; }
    setOkrs(prev => prev.map(o => o.id === id ? { ...o, objective: editOText.trim() } : o)); setEditingO(null);
  }, [editOText]);

  const addKR = useCallback((okrId: string) => {
    if (!newKRDesc.trim()) return;
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : {
      ...o, keyResults: [...o.keyResults, { id: genId(), description: newKRDesc.trim(), tasks: [] }],
    }));
    setNewKRDesc('');
  }, [newKRDesc]);

  const removeKR = useCallback((okrId: string, krId: string) => {
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : { ...o, keyResults: o.keyResults.filter(kr => kr.id !== krId) }));
  }, []);

  const addTask = useCallback((okrId: string, krId: string) => {
    if (!newTaskTitle.trim()) return;
    const est = Number(newTaskEst) || 1;
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : {
      ...o, keyResults: o.keyResults.map(kr => kr.id !== krId ? kr : {
        ...kr, tasks: [...kr.tasks, { id: genId(), title: newTaskTitle.trim(), estimatedTomatoes: est, tomatoes: [] }],
      }),
    }));
    setNewTaskTitle(''); setNewTaskEst('1');
  }, [newTaskTitle, newTaskEst]);

  const removeTask = useCallback((okrId: string, krId: string, taskId: string) => {
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : {
      ...o, keyResults: o.keyResults.map(kr => kr.id !== krId ? kr : { ...kr, tasks: kr.tasks.filter(t => t.id !== taskId) }),
    }));
  }, []);

  const addTomato = useCallback((okrId: string, krId: string, taskId: string) => {
    if (!newTomatoTitle.trim()) return;
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : {
      ...o, keyResults: o.keyResults.map(kr => kr.id !== krId ? kr : {
        ...kr, tasks: kr.tasks.map(t => t.id !== taskId ? t : {
          ...t, tomatoes: [...t.tomatoes, { id: genId(), title: newTomatoTitle.trim(), completed: false }],
        }),
      }),
    }));
    setNewTomatoTitle('');
  }, [newTomatoTitle]);

  const removeTomato = useCallback((okrId: string, krId: string, taskId: string, tomatoId: string) => {
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : {
      ...o, keyResults: o.keyResults.map(kr => kr.id !== krId ? kr : {
        ...kr, tasks: kr.tasks.map(t => t.id !== taskId ? t : { ...t, tomatoes: t.tomatoes.filter(tm => tm.id !== tomatoId) }),
      }),
    }));
  }, []);

  const startTimer = useCallback((okrId: string, krId: string, taskId: string, tomatoId: string, labels: string[]) => {
    activeCtx.current = { okrId, krId, taskId, tomatoId };
    setTimerLabels(labels);
    setSecondsLeft(25 * 60); setTimerActive(true); setTimerPaused(false); setTimerNote('');
  }, []);

  const addReview = useCallback((okrId: string) => {
    if (!reviewText.trim()) return;
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : {
      ...o, reviews: [...o.reviews, { id: genId(), date: new Date().toISOString().slice(0, 10), content: reviewText.trim() }],
    }));
    setReviewText('');
  }, [reviewText]);

  const toggleKR = useCallback((krId: string) => {
    setExpandedKR(prev => { const n = new Set(prev); n.has(krId) ? n.delete(krId) : n.add(krId); return n; });
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setExpandedTask(prev => { const n = new Set(prev); n.has(taskId) ? n.delete(taskId) : n.add(taskId); return n; });
  }, []);

  if (!mounted) return null;

  const s = {
    bg: skin.bodyBg, panelBg: skin.panelBg, cardBg: skin.cardBg, cardHover: skin.cardHover,
    text1: skin.textPrimary, text2: skin.textSecondary, textMuted: skin.textMuted,
    divider: skin.divider, progressTrack: skin.progressTrack, progressFill: skin.progressFill,
  };

  const pb = (pct: number, h: number = 6, color?: string) => (
    <div className="w-full rounded-full" style={{ height: h, backgroundColor: s.progressTrack }}>
      <div className="rounded-full transition-all duration-500" style={{
        width: `${Math.min(pct, 100)}%`, height: '100%',
        backgroundColor: color || (pct >= 100 ? '#22c55e' : pct >= 60 ? s.progressFill : pct >= 30 ? '#f97316' : s.textMuted),
      }} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: s.bg }}>

      {/* ══════════ LEFT PANEL: OKR LIST ══════════ */}
      <div className="w-[480px] flex-shrink-0 flex flex-col border-r" style={{ backgroundColor: s.panelBg, borderColor: s.divider }}>

        {/* Header banner */}
        <div className="flex-shrink-0 px-5 pb-5 relative overflow-hidden" style={{ paddingTop: '1.2rem', ...(skin.headerBgImage ? { backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(135deg, ${skin.headerFrom} 0%, ${skin.headerTo} 100%)` }) }}>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${skin.sidebarFrom}cc, ${skin.sidebarTo}bb)` }} />
          <ParticleEffect color={skin.swatch} count={30} />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-wide text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>人生旅途</h2>
                <div className="flex items-center gap-1 mt-2">
                  {(['annual', 'Q1', 'Q2', 'Q3', 'Q4'] as PeriodType[]).map(p => (
                    <button key={p} onClick={() => setPeriod(p)} className="px-2 py-0.5 rounded text-xs font-medium transition-all"
                            style={{ backgroundColor: period === p ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)', color: period === p ? '#fff' : 'rgba(255,255,255,0.7)' }}>
                      {p === 'annual' ? '年度' : p}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white/50 hover:text-white transition-colors"
                style={{ background: 'rgba(0,0,0,0.2)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex-shrink-0 px-5 py-2 flex items-center gap-4 text-xs border-b" style={{ borderColor: s.divider, backgroundColor: s.cardBg }}>
          <span style={{ color: s.textMuted }}>OKR <b style={{ color: s.text1 }}>{globalStats.totalOKRs}</b></span>
          <span style={{ color: s.textMuted }}>预估🍅 <b style={{ color: s.text1 }}>{globalStats.totalTomatoes}</b></span>
          <span style={{ color: s.textMuted }}>已完成🍅 <b style={{ color: '#22c55e' }}>{globalStats.doneTomatoes}</b></span>
          <span style={{ color: s.textMuted }}>完成率 <b style={{ color: swatch }}>{globalStats.avgProgress}%</b></span>
        </div>

        {/* Add OKR inline */}
        <div className="flex-shrink-0 px-5 py-2 flex items-center gap-2 border-b" style={{ borderColor: s.divider }}>
          <input type="text" value={newO} onChange={e => setNewO(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && addOKR()}
                 placeholder="输入目标，回车创建" className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                 style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
          <button onClick={addOKR} disabled={!newO.trim()} className="px-3 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-40"
                  style={{ backgroundColor: swatch }}>+ OKR</button>
        </div>

        {/* OKR list */}
        <div className="flex-1 overflow-y-auto">
          {filteredOKRs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: s.textMuted }}>
              <span className="text-4xl mb-2">🎯</span>
              <p className="text-sm">输入目标开始吧</p>
            </div>
          ) : filteredOKRs.map(okr => {
            const pct = Math.round(okrProgress(okr) * 100);
            const color = statusColor(okr.status, swatch);
            const tm = okrTomatoStats(okr);
            const isSelected = selectedId === okr.id;
            return (
              <div key={okr.id}
                   onClick={() => setSelectedId(okr.id)}
                   className="px-5 py-3 cursor-pointer transition-all border-l-[3px]"
                   style={{
                     backgroundColor: isSelected ? s.cardHover : 'transparent',
                     borderLeftColor: isSelected ? swatch : 'transparent',
                   }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: color + '18', color }}>
                    {STATUS_CFG[okr.status].icon}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: s.text1 }}>{okr.objective}</span>
                  <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">{pb(pct, 4, color)}</div>
                  <span className="text-[11px]" style={{ color: s.textMuted }}>🍅{tm.done}/{tm.total}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom daily bar */}
        <div className="flex-shrink-0 px-5 py-2 border-t flex items-center gap-3 text-xs" style={{ borderColor: s.divider, backgroundColor: s.cardBg }}>
          <span style={{ color: s.text2 }}>今日：<b style={{ color: '#22c55e' }}>{todayTomatoes}</b>🍅</span>
          <span style={{ color: s.text2 }}>计划：
            <button onClick={() => setDailyTarget(p => Math.max(1, p - 1))} className="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] mx-0.5"
                    style={{ backgroundColor: s.panelBg, color: s.textMuted }}>−</button>
            <b style={{ color: swatch }}>{dailyTarget}</b>
            <button onClick={() => setDailyTarget(p => p + 1)} className="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] mx-0.5"
                    style={{ backgroundColor: s.panelBg, color: s.textMuted }}>+</button>
            🍅
          </span>
          {interruptions > 0 && <span style={{ color: '#f97316' }}>中断{interruptions}</span>}
          {timerActive && (
            <button onClick={() => setTimerPaused(!timerPaused)} className="ml-auto text-xs px-2 py-0.5 rounded font-medium"
                    style={{ backgroundColor: timerPaused ? swatch : s.panelBg, color: timerPaused ? '#fff' : s.text2 }}>
              {timerPaused ? '▶' : '⏸'} {fmtTime(secondsLeft)}
            </button>
          )}
        </div>
      </div>

      {/* ══════════ RIGHT PANEL: OKR DETAIL ══════════ */}
      <div className="flex-1 overflow-y-auto">
        {!selectedOKR ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: s.textMuted }}>
            <span className="text-5xl mb-3">👈</span>
            <p>选择左侧OKR查看详情</p>
          </div>
        ) : (() => {
          const okr = selectedOKR;
          const pct = Math.round(okrProgress(okr) * 100);
          const color = statusColor(okr.status, swatch);
          const tmStats = okrTomatoStats(okr);
          return (
            <div className="p-6 space-y-5">
              {/* O Header */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => cycleStatus(okr.id)} className="text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer flex-shrink-0"
                          style={{ backgroundColor: color + '18', color }}>
                    {STATUS_CFG[okr.status].icon} {STATUS_CFG[okr.status].label}
                  </button>
                  {editingO === okr.id ? (
                    <input autoFocus value={editOText} onChange={e => setEditOText(e.target.value)}
                           onBlur={() => saveObjective(okr.id)}
                           onKeyDown={e => { if (e.key === 'Enter') saveObjective(okr.id); if (e.key === 'Escape') setEditingO(null); }}
                           className="flex-1 text-lg font-bold outline-none rounded-lg px-2 py-1"
                           style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                  ) : (
                    <h2 className="flex-1 text-lg font-bold cursor-pointer hover:opacity-80" style={{ color: s.text1 }}
                        onClick={() => { setEditingO(okr.id); setEditOText(okr.objective); }}>
                      O：{okr.objective}
                    </h2>
                  )}
                  <span className="text-2xl font-bold flex-shrink-0" style={{ color }}>{pct}%</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setReviewO(reviewO === okr.id ? null : okr.id)}
                            className="text-xs px-2 py-1 rounded hover:opacity-70" style={{ color: s.textMuted }}>复盘</button>
                    <button onClick={() => deleteOKR(okr.id)}
                            className="text-xs px-2 py-1 rounded hover:opacity-70" style={{ color: '#ef4444' }}>删除</button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">{pb(pct, 8, color)}</div>
                  <span className="text-sm whitespace-nowrap" style={{ color: s.textMuted }}>🍅 {tmStats.done}/{tmStats.total}</span>
                </div>
              </div>

              {/* KR List */}
              <div className="space-y-3">
                {okr.keyResults.map((kr, krIdx) => {
                  const krPct = Math.round(krProgress(kr) * 100);
                  const krColor = krPct >= 100 ? '#22c55e' : swatch;
                  const krTm = krTomatoStats(kr);
                  const isKRExpanded = expandedKR.has(kr.id);
                  return (
                    <div key={kr.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                      {/* KR Header */}
                      <button onClick={() => toggleKR(kr.id)} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:opacity-90 transition-opacity">
                        <span className="text-[10px]" style={{ color: krColor }}>{isKRExpanded ? '▾' : '▸'}</span>
                        <span className="text-xs font-bold" style={{ color: krColor }}>KR{krIdx + 1}</span>
                        <span className="flex-1 text-sm" style={{ color: s.text1 }}>{kr.description}</span>
                        <span className="text-xs font-bold" style={{ color: krColor }}>{krPct}%</span>
                        <span className="text-[11px]" style={{ color: s.textMuted }}>🍅{krTm.done}/{krTm.total}</span>
                        <span onClick={e => { e.stopPropagation(); removeKR(okr.id, kr.id); }}
                              className="text-xs opacity-30 hover:opacity-80" style={{ color: s.textMuted }}>✕</span>
                      </button>

                      {/* KR expanded: Tasks */}
                      {isKRExpanded && (
                        <div className="px-4 pb-3 space-y-2" style={{ borderLeft: `3px solid ${krColor}`, marginLeft: 16 }}>
                          {kr.tasks.map(task => {
                            const taskDone = task.tomatoes.filter(tm => tm.completed).length;
                            const isTaskExpanded = expandedTask.has(task.id);
                            return (
                              <div key={task.id} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${s.divider}` }}>
                                {/* Task Header */}
                                <button onClick={() => toggleTask(task.id)} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:opacity-90"
                                        style={{ backgroundColor: s.panelBg }}>
                                  <span className="text-[10px]" style={{ color: s.textMuted }}>{isTaskExpanded ? '▾' : '▸'}</span>
                                  <span className="text-sm" style={{ color: s.text1 }}>📋 {task.title}</span>
                                  <span className="ml-auto text-[11px]" style={{ color: s.textMuted }}>预估{task.estimatedTomatoes}🍅 · 完成{taskDone}🍅</span>
                                  <span onClick={e => { e.stopPropagation(); removeTask(okr.id, kr.id, task.id); }}
                                        className="text-xs opacity-30 hover:opacity-80" style={{ color: s.textMuted }}>✕</span>
                                </button>

                                {/* Task expanded: Tomatoes */}
                                {isTaskExpanded && (
                                  <div className="px-3 pb-2 space-y-1" style={{ borderLeft: `2px solid ${s.divider}`, marginLeft: 12 }}>
                                    {task.tomatoes.map(tm => (
                                      <div key={tm.id} className="flex items-center gap-2 py-1 px-2 rounded"
                                           style={{ backgroundColor: tm.completed ? s.cardBg : 'transparent' }}>
                                        <span className="text-sm" style={{ color: tm.completed ? '#22c55e' : s.textMuted }}>
                                          {tm.completed ? '☑' : '☐'}
                                        </span>
                                        <span className={`flex-1 text-sm ${tm.completed ? 'line-through' : ''}`}
                                              style={{ color: tm.completed ? s.textMuted : s.text2 }}>{tm.title}</span>
                                        {!tm.completed && (
                                          <button onClick={() => startTimer(okr.id, kr.id, task.id, tm.id, [okr.objective, kr.description, task.title, tm.title])}
                                                  className="text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 hover:brightness-110"
                                                  style={{ backgroundColor: swatch, color: '#fff' }}>
                                            ▶ 🍅
                                          </button>
                                        )}
                                        {tm.completed && <span className="text-[11px]" style={{ color: '#22c55e' }}>已完成</span>}
                                        <span onClick={() => removeTomato(okr.id, kr.id, task.id, tm.id)}
                                              className="text-xs opacity-20 hover:opacity-70 cursor-pointer" style={{ color: s.textMuted }}>✕</span>
                                      </div>
                                    ))}
                                    {/* Add tomato */}
                                    {addTomato_Task === task.id ? (
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <input autoFocus value={newTomatoTitle} onChange={e => setNewTomatoTitle(e.target.value)}
                                               onKeyDown={e => { if (e.key === 'Enter') addTomato(okr.id, kr.id, task.id); if (e.key === 'Escape') setAddTomato_Task(null); }}
                                               placeholder="番茄内容" className="flex-1 rounded px-2 py-1 text-sm outline-none"
                                               style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                                        <button onClick={() => addTomato(okr.id, kr.id, task.id)} className="text-sm font-bold px-2" style={{ color: swatch }}>+</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => { setAddTomato_Task(task.id); setNewTomatoTitle(''); }}
                                              className="text-xs hover:underline mt-1" style={{ color: swatch }}>+ 番茄</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Add task */}
                          {addTask_KR === kr.id ? (
                            <div className="flex items-center gap-1.5">
                              <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                                     onKeyDown={e => { if (e.key === 'Enter') addTask(okr.id, kr.id); if (e.key === 'Escape') setAddTask_KR(null); }}
                                     placeholder="任务名" className="flex-1 rounded px-2 py-1 text-sm outline-none"
                                     style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                              <input value={newTaskEst} onChange={e => setNewTaskEst(e.target.value)}
                                     placeholder="🍅" className="w-12 rounded px-2 py-1 text-sm outline-none text-center"
                                     style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                              <button onClick={() => addTask(okr.id, kr.id)} className="text-sm font-bold px-2" style={{ color: swatch }}>+</button>
                            </div>
                          ) : (
                            <button onClick={() => { setAddTask_KR(kr.id); setNewTaskTitle(''); setNewTaskEst('1'); }}
                                    className="text-xs hover:underline" style={{ color: swatch }}>+ 任务</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add KR */}
                {addKR_O === okr.id ? (
                  <div className="flex items-center gap-2">
                    <input autoFocus value={newKRDesc} onChange={e => setNewKRDesc(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') addKR(okr.id); if (e.key === 'Escape') setAddKR_O(null); }}
                           placeholder="关键结果描述" className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                           style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                    <button onClick={() => addKR(okr.id)} disabled={!newKRDesc.trim()}
                            className="text-sm font-bold disabled:opacity-30 px-2" style={{ color: swatch }}>+</button>
                  </div>
                ) : (
                  <button onClick={() => { setAddKR_O(okr.id); setNewKRDesc(''); }}
                          className="text-xs hover:underline" style={{ color: swatch }}>+ 关键结果</button>
                )}
              </div>

              {/* Review */}
              {reviewO === okr.id && (
                <div className="rounded-xl p-4" style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                  <div className="text-sm font-medium mb-2" style={{ color: s.text1 }}>复盘记录</div>
                  {okr.reviews.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {okr.reviews.map(r => (
                        <div key={r.id} className="text-sm px-3 py-1.5 rounded-lg" style={{ backgroundColor: s.panelBg }}>
                          <span className="text-[11px]" style={{ color: s.textMuted }}>{r.date}</span>
                          <span className="ml-2" style={{ color: s.text2 }}>{r.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input type="text" value={reviewText} onChange={e => setReviewText(e.target.value)}
                           onKeyDown={e => e.key === 'Enter' && addReview(okr.id)}
                           placeholder="复盘记录..." className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                           style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                    <button onClick={() => addReview(okr.id)} disabled={!reviewText.trim()}
                            className="text-sm font-bold disabled:opacity-30" style={{ color: swatch }}>↵</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ══════ TIMER MODAL ══════ */}
      {timerActive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl p-8 text-center min-w-[360px] shadow-2xl" style={{ backgroundColor: s.panelBg, border: `2px solid ${swatch}` }}>
            <div className="text-xs mb-4 max-w-[320px] mx-auto truncate" style={{ color: s.textMuted }}>
              {timerLabels.join(' → ')}
            </div>
            <div className="text-6xl font-bold mb-2 tabular-nums" style={{ color: timerPaused ? s.textMuted : s.text1 }}>
              {fmtTime(secondsLeft)}
            </div>
            <div className="text-sm mb-4" style={{ color: s.textMuted }}>专注模式</div>
            <div className="mx-auto w-56 mb-6">{pb(Math.round(((25 * 60 - secondsLeft) / (25 * 60)) * 100), 8, swatch)}</div>
            <div className="flex gap-3 justify-center mb-4">
              <button onClick={() => setTimerPaused(!timerPaused)}
                      className="px-6 py-2.5 rounded-xl text-white font-medium text-sm hover:brightness-110"
                      style={{ backgroundColor: timerPaused ? swatch : '#f59e0b' }}>
                {timerPaused ? '▶ 继续' : '⏸ 暂停'}
              </button>
              <button onClick={() => {
                setTimerActive(false); setTimerPaused(false); activeCtx.current = null; setSecondsLeft(25 * 60);
                setInterruptions(p => p + 1);
              }} className="px-6 py-2.5 rounded-xl text-white font-medium text-sm hover:brightness-110"
                      style={{ backgroundColor: '#ef4444' }}>
                放弃本次番茄
              </button>
            </div>
            <input type="text" value={timerNote} onChange={e => setTimerNote(e.target.value)}
                   placeholder="记录卡点或中断原因..."
                   className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                   style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
          </div>
        </div>
      )}

      {/* Timer done flash */}
      {timerDone && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
          <div className="text-4xl font-bold" style={{ color: '#22c55e' }}>🍅 完成!</div>
        </div>
      )}
    </div>
  );
}
