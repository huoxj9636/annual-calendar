'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SKINS } from '@/lib/skins';

interface LifeCalendarProps {
  birthYear: number;
  setBirthYear: (year: number) => void;
  onClose: () => void;
  skinKey?: string;
}

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
  targetValue: number;
  currentValue: number;
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

const STATUS_CYCLE: OKRStatus[] = ['not_started', 'in_progress', 'completed'];
const STATUS_DISPLAY: Record<OKRStatus, { label: string; icon: string }> = {
  not_started: { label: '未开始', icon: '⚪' },
  in_progress: { label: '进行中', icon: '🔵' },
  completed: { label: '已完成', icon: '🟢' },
};

function genId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function getCurrentYear(): number { return new Date().getFullYear(); }
function getCurrentQuarter(): PeriodType { const m = new Date().getMonth(); if (m < 3) return 'Q1'; if (m < 6) return 'Q2'; if (m < 9) return 'Q3'; return 'Q4'; }

function calcOKRProgress(okr: OKR): number {
  if (okr.keyResults.length === 0) return 0;
  const total = okr.keyResults.reduce((sum, kr) => {
    const pct = kr.targetValue > 0 ? Math.min(kr.currentValue / kr.targetValue, 1) : 0;
    return sum + pct;
  }, 0);
  return Math.round((total / okr.keyResults.length) * 100);
}

function statusColor(status: OKRStatus, swatch: string): string {
  switch (status) { case 'completed': return '#22c55e'; case 'in_progress': return swatch; default: return '#94a3b8'; }
}

function krTomatoStats(kr: KeyResult): { done: number; total: number } {
  let done = 0, total = 0;
  for (const t of kr.tasks) { total += t.estimatedTomatoes; done += t.tomatoes.filter(tm => tm.completed).length; }
  return { done, total };
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
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

export default function LifeCalendar({ onClose, skinKey }: LifeCalendarProps) {
  const skin = SKINS.find(s => s.key === skinKey) || SKINS[0];
  const swatch = skin.swatch || '#6558c1';

  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [period, setPeriod] = useState<PeriodType>(getCurrentQuarter());
  const [year] = useState(getCurrentYear());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickInput, setQuickInput] = useState('');
  const [mounted, setMounted] = useState(false);

  // Inline edits
  const [editingO, setEditingO] = useState<string | null>(null);
  const [editOText, setEditOText] = useState('');
  const [editingKR, setEditingKR] = useState<string | null>(null);
  const [editKRVal, setEditKRVal] = useState(0);
  const [newKRDesc, setNewKRDesc] = useState('');
  const [newKRTarget, setNewKRTarget] = useState('');
  const [newTaskKR, setNewTaskKR] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskEst, setNewTaskEst] = useState('1');
  const [newTomatoTask, setNewTomatoTask] = useState<string | null>(null);
  const [newTomatoTitle, setNewTomatoTitle] = useState('');
  const [reviewText, setReviewText] = useState('');

  // Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerDone, setTimerDone] = useState(false);
  const [timerLabels, setTimerLabels] = useState<string[]>([]);
  const activeCtx = useRef<{ okrId: string; krId: string; taskId: string; tomatoId: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Daily stats
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dailyTarget, setDailyTarget] = useState(8);
  const [interruptions, setInterruptions] = useState(0);

  const periodKey = period === 'annual' ? `${year}` : `${year}-${period}`;
  const periodLabel = period === 'annual' ? `${year}年度` : `${year} Q${period.slice(1)}`;

  // ── Load ──
  useEffect(() => {
    const saved = localStorage.getItem('okr-data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((o: OKR & { keyResults?: KeyResult[] & { tasks?: Task[] }[] }) => ({
          ...o,
          status: STATUS_CYCLE.includes(o.status as OKRStatus) ? o.status : 'not_started',
          keyResults: (o.keyResults || []).map((kr: KeyResult & { tasks?: Task[] }) => ({
            ...kr,
            tasks: kr.tasks || [],
          })),
        }));
        setOkrs(migrated);
      } catch { /* ignore */ }
    }
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

  const filteredOKRs = useMemo(() => okrs.filter(o => o.period === periodKey), [okrs, periodKey]);
  const selectedOKR = useMemo(() => okrs.find(o => o.id === selectedId) || null, [okrs, selectedId]);

  const stats = useMemo(() => {
    const total = filteredOKRs.length;
    const completed = filteredOKRs.filter(o => o.status === 'completed').length;
    const inProgress = filteredOKRs.filter(o => o.status === 'in_progress').length;
    const avgProgress = total > 0 ? Math.round(filteredOKRs.reduce((s, o) => s + calcOKRProgress(o), 0) / total) : 0;
    return { total, completed, inProgress, avgProgress };
  }, [filteredOKRs]);

  const todayTomatoes = useMemo(() => {
    let c = 0;
    for (const o of okrs) for (const kr of o.keyResults) for (const t of kr.tasks) for (const tm of t.tomatoes) {
      if (tm.completed && tm.completedAt && new Date(tm.completedAt).toISOString().slice(0, 10) === todayKey) c++;
    }
    return c;
  }, [okrs, todayKey]);

  // ── Timer effects ──
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
    setTimerActive(false);
    setTimerDone(true);
    activeCtx.current = null;
    setTimeout(() => setTimerDone(false), 2000);
  }, [secondsLeft, timerActive]);

  // ── Auto-select ──
  useEffect(() => {
    if (filteredOKRs.length > 0 && !filteredOKRs.find(o => o.id === selectedId)) setSelectedId(filteredOKRs[0].id);
  }, [filteredOKRs, selectedId]);

  // ── Actions ──
  const quickAdd = useCallback(() => {
    if (!quickInput.trim()) return;
    const o: OKR = { id: genId(), objective: quickInput.trim(), status: 'not_started', period: periodKey, keyResults: [], reviews: [], createdAt: Date.now() };
    setOkrs(prev => [...prev, o]); setSelectedId(o.id); setQuickInput('');
  }, [quickInput, periodKey]);

  const cycleStatus = useCallback((id: string) => {
    setOkrs(prev => prev.map(o => { if (o.id !== id) return o; const i = STATUS_CYCLE.indexOf(o.status); return { ...o, status: STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] }; }));
  }, []);

  const deleteOKR = useCallback((id: string) => { setOkrs(prev => prev.filter(o => o.id !== id)); if (selectedId === id) setSelectedId(null); }, [selectedId]);

  const saveObjective = useCallback((id: string) => {
    if (!editOText.trim()) { setEditingO(null); return; }
    setOkrs(prev => prev.map(o => o.id === id ? { ...o, objective: editOText.trim() } : o)); setEditingO(null);
  }, [editOText]);

  const addKR = useCallback((okrId: string) => {
    if (!newKRDesc.trim()) return;
    const target = Number(newKRTarget) || 100;
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : {
      ...o, keyResults: [...o.keyResults, { id: genId(), description: newKRDesc.trim(), targetValue: target, currentValue: 0, tasks: [] }],
    }));
    setNewKRDesc(''); setNewKRTarget('');
  }, [newKRDesc, newKRTarget]);

  const removeKR = useCallback((okrId: string, krId: string) => {
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : { ...o, keyResults: o.keyResults.filter(kr => kr.id !== krId) }));
  }, []);

  const saveKRValue = useCallback((okrId: string, krId: string) => {
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : {
      ...o, keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, currentValue: editKRVal } : kr),
    }));
    setEditingKR(null);
  }, [editKRVal]);

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
    const okr = okrs.find(o => o.id === okrId);
    const kr = okr?.keyResults.find(k => k.id === krId);
    const task = kr?.tasks.find(t => t.id === taskId);
    const tomato = task?.tomatoes.find(tm => tm.id === tomatoId);
    if (!okr || !kr || !task || !tomato || tomato.completed) return;
    activeCtx.current = { okrId, krId, taskId, tomatoId };
    setTimerLabels([okr.objective, kr.description, task.title, tomato.title]);
    setSecondsLeft(25 * 60); setTimerActive(true); setTimerPaused(false);
  }, [okrs]);

  const addReview = useCallback((okrId: string) => {
    if (!reviewText.trim()) return;
    setOkrs(prev => prev.map(o => o.id !== okrId ? o : {
      ...o, reviews: [...o.reviews, { id: genId(), date: new Date().toISOString().slice(0, 10), content: reviewText.trim() }],
    }));
    setReviewText('');
  }, [reviewText]);

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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: s.bg }}>
      <div className="flex flex-1 min-h-0">
        {/* ══ LEFT ══ */}
        <div className="w-[480px] flex-shrink-0 flex flex-col border-r" style={{ borderColor: s.divider, backgroundColor: s.panelBg }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 h-14 flex-shrink-0"
               style={{ background: `linear-gradient(135deg, ${skin.sidebarFrom}, ${skin.sidebarTo})` }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">🗺</span>
              <h1 className="text-white font-bold text-lg">人生旅途</h1>
              <span className="text-white/50 text-xs ml-1">OKR</span>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors text-xl">×</button>
          </div>

          {/* Period + Quick Add */}
          <div className="flex-shrink-0 px-5 pt-4 pb-3 space-y-3">
            <div className="flex items-center gap-2">
              {(['annual', 'Q1', 'Q2', 'Q3', 'Q4'] as PeriodType[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)} className="px-3 py-1 rounded-lg text-sm font-medium transition-all"
                        style={{ backgroundColor: period === p ? swatch : s.cardBg, color: period === p ? '#fff' : s.text2, border: period === p ? 'none' : `1px solid ${s.divider}` }}>
                  {p === 'annual' ? '年度' : `Q${p.slice(1)}`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="text" value={quickInput} onChange={e => setQuickInput(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && quickAdd()} placeholder="输入目标，回车创建"
                     className="flex-1 rounded-lg px-3 py-2 outline-none text-sm"
                     style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
              <button onClick={quickAdd} disabled={!quickInput.trim()} className="px-3 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-40"
                      style={{ backgroundColor: swatch }}>+</button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold" style={{ color: swatch }}>{stats.avgProgress}%</span>
              {pb(stats.avgProgress, 4, swatch)}
              <span className="text-[11px] whitespace-nowrap" style={{ color: s.textMuted }}>
                🟢{stats.completed} 🔵{stats.inProgress} ⚪{stats.total - stats.completed - stats.inProgress}
              </span>
            </div>
          </div>

          {/* OKR List */}
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1.5">
            {filteredOKRs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12" style={{ color: s.textMuted }}>
                <span className="text-3xl mb-2">🎯</span><p className="text-sm">输入目标开始吧</p>
              </div>
            ) : filteredOKRs.map(okr => {
              const progress = calcOKRProgress(okr);
              const color = statusColor(okr.status, swatch);
              const isActive = selectedId === okr.id;
              return (
                <button key={okr.id} onClick={() => setSelectedId(okr.id)} className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
                        style={{ backgroundColor: isActive ? s.cardHover : 'transparent', borderLeft: `3px solid ${isActive ? color : 'transparent'}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" onClick={e => { e.stopPropagation(); cycleStatus(okr.id); }} style={{ color, cursor: 'pointer' }}>
                      {STATUS_DISPLAY[okr.status].icon}
                    </span>
                    <span className="flex-1 text-sm truncate" style={{ color: s.text1 }}>{okr.objective}</span>
                    <span className="text-xs font-bold" style={{ color }}>{progress}%</span>
                  </div>
                  {progress > 0 && <div className="mt-1 ml-5">{pb(progress, 2, color)}</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ RIGHT: Detail ══ */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: s.bg }}>
          {!selectedOKR ? (
            <div className="flex-1 flex flex-col items-center justify-center" style={{ color: s.textMuted }}>
              <span className="text-5xl mb-3">🎯</span>
              <p className="text-base" style={{ color: s.text2 }}>选择左侧目标查看详情</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex-shrink-0 px-8 py-3 border-b" style={{ borderColor: s.divider, backgroundColor: s.panelBg }}>
                <div className="flex items-center gap-3">
                  <button onClick={() => cycleStatus(selectedOKR.id)} className="text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                          style={{ backgroundColor: statusColor(selectedOKR.status, swatch) + '18', color: statusColor(selectedOKR.status, swatch) }}>
                    {STATUS_DISPLAY[selectedOKR.status].icon} {STATUS_DISPLAY[selectedOKR.status].label}
                  </button>
                  {editingO === selectedOKR.id ? (
                    <input autoFocus value={editOText} onChange={e => setEditOText(e.target.value)}
                           onBlur={() => saveObjective(selectedOKR.id)}
                           onKeyDown={e => { if (e.key === 'Enter') saveObjective(selectedOKR.id); if (e.key === 'Escape') setEditingO(null); }}
                           className="flex-1 text-lg font-bold outline-none rounded-lg px-2 py-0.5"
                           style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                  ) : (
                    <h2 className="flex-1 text-lg font-bold truncate cursor-pointer hover:opacity-80" style={{ color: s.text1 }}
                        onClick={() => { setEditingO(selectedOKR.id); setEditOText(selectedOKR.objective); }}>{selectedOKR.objective}</h2>
                  )}
                  <span className="text-2xl font-bold" style={{ color: statusColor(selectedOKR.status, swatch) }}>{calcOKRProgress(selectedOKR)}%</span>
                  <button onClick={() => deleteOKR(selectedOKR.id)} className="text-lg opacity-30 hover:opacity-80 transition-opacity" style={{ color: s.textMuted }}>×</button>
                </div>
                <div className="text-xs mt-0.5" style={{ color: s.textMuted }}>{periodLabel}</div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-8 py-4 space-y-5">
                {selectedOKR.keyResults.map((kr, krIdx) => {
                  const krPct = kr.targetValue > 0 ? Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100) : 0;
                  const krColor = krPct >= 100 ? '#22c55e' : swatch;
                  const tmStats = krTomatoStats(kr);
                  return (
                    <div key={kr.id} className="group">
                      {/* KR Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold" style={{ color: krColor }}>KR{krIdx + 1}</span>
                        <span className="flex-1 text-sm font-medium" style={{ color: s.text1 }}>{kr.description}</span>
                        {editingKR === kr.id ? (
                          <input autoFocus type="number" value={editKRVal}
                                 onChange={e => setEditKRVal(Number(e.target.value))}
                                 onBlur={() => saveKRValue(selectedOKR.id, kr.id)}
                                 onKeyDown={e => { if (e.key === 'Enter') saveKRValue(selectedOKR.id, kr.id); if (e.key === 'Escape') setEditingKR(null); }}
                                 className="w-16 text-right rounded px-1.5 py-0.5 text-sm font-bold outline-none"
                                 style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                        ) : (
                          <button onClick={() => { setEditingKR(kr.id); setEditKRVal(kr.currentValue); }}
                                  className="text-sm font-bold hover:opacity-70" style={{ color: krColor }}>
                            {kr.currentValue}/{kr.targetValue}
                          </button>
                        )}
                        <span className="text-xs font-bold" style={{ color: krColor }}>{krPct}%</span>
                        {tmStats.total > 0 && <span className="text-[11px]" style={{ color: s.textMuted }}>🍅{tmStats.done}/{tmStats.total}</span>}
                        <button onClick={() => removeKR(selectedOKR.id, kr.id)}
                                className="text-xs opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity" style={{ color: s.textMuted }}>×</button>
                      </div>
                      {pb(krPct, 4, krColor)}

                      {/* Tasks */}
                      <div className="ml-4 mt-2 space-y-2">
                        {kr.tasks.map(task => {
                          const taskDone = task.tomatoes.filter(tm => tm.completed).length;
                          return (
                            <div key={task.id} className="rounded-lg px-3 py-2 group/task" style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px]" style={{ color: s.textMuted }}>📋</span>
                                <span className="flex-1 text-sm" style={{ color: s.text1 }}>{task.title}</span>
                                <span className="text-[11px]" style={{ color: s.textMuted }}>🍅{taskDone}/{task.estimatedTomatoes}</span>
                                <button onClick={() => removeTask(selectedOKR.id, kr.id, task.id)}
                                        className="text-xs opacity-0 group-hover/task:opacity-40 hover:!opacity-100 transition-opacity" style={{ color: s.textMuted }}>×</button>
                              </div>
                              {/* Tomato items */}
                              <div className="ml-2 space-y-1">
                                {task.tomatoes.map(tm => (
                                  <div key={tm.id} className="flex items-center gap-2 py-0.5 group/tm">
                                    <span className="text-xs" style={{ color: tm.completed ? '#22c55e' : s.textMuted }}>{tm.completed ? '☑' : '☐'}</span>
                                    <span className={`flex-1 text-sm ${tm.completed ? 'line-through' : ''}`} style={{ color: tm.completed ? s.textMuted : s.text2 }}>{tm.title}</span>
                                    {!tm.completed && (
                                      <button onClick={() => startTimer(selectedOKR.id, kr.id, task.id, tm.id, [selectedOKR.objective, kr.description, task.title, tm.title])}
                                              className="text-[11px] px-2 py-0.5 rounded font-medium opacity-0 group-hover/tm:opacity-100 transition-opacity"
                                              style={{ backgroundColor: swatch + '18', color: swatch }}>🍅</button>
                                    )}
                                    <button onClick={() => removeTomato(selectedOKR.id, kr.id, task.id, tm.id)}
                                            className="text-[11px] opacity-0 group-hover/tm:opacity-40 hover:!opacity-100 transition-opacity" style={{ color: s.textMuted }}>×</button>
                                  </div>
                                ))}
                                {/* Add tomato */}
                                {newTomatoTask === task.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <input autoFocus value={newTomatoTitle} onChange={e => setNewTomatoTitle(e.target.value)}
                                           onKeyDown={e => { if (e.key === 'Enter') addTomato(selectedOKR.id, kr.id, task.id); if (e.key === 'Escape') setNewTomatoTask(null); }}
                                           placeholder="番茄内容" className="flex-1 rounded px-2 py-0.5 text-sm outline-none"
                                           style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                                    <button onClick={() => addTomato(selectedOKR.id, kr.id, task.id)} className="text-sm font-bold" style={{ color: swatch }}>+</button>
                                  </div>
                                ) : (
                                  <button onClick={() => { setNewTomatoTask(task.id); setNewTomatoTitle(''); }}
                                          className="text-[11px] hover:underline" style={{ color: s.textMuted }}>+ 番茄</button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Add task */}
                        {newTaskKR === kr.id ? (
                          <div className="flex items-center gap-1.5">
                            <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                                   onKeyDown={e => { if (e.key === 'Enter') addTask(selectedOKR.id, kr.id); if (e.key === 'Escape') setNewTaskKR(null); }}
                                   placeholder="任务名" className="flex-1 rounded px-2 py-1 text-sm outline-none"
                                   style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                            <input value={newTaskEst} onChange={e => setNewTaskEst(e.target.value)}
                                   placeholder="🍅数" className="w-14 rounded px-2 py-1 text-sm outline-none text-center"
                                   style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                            <button onClick={() => addTask(selectedOKR.id, kr.id)} className="text-sm font-bold" style={{ color: swatch }}>+</button>
                          </div>
                        ) : (
                          <button onClick={() => { setNewTaskKR(kr.id); setNewTaskTitle(''); setNewTaskEst('1'); }}
                                  className="text-xs hover:underline" style={{ color: s.textMuted }}>+ 任务</button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add KR */}
                <div className="flex items-center gap-2">
                  <input value={newKRDesc} onChange={e => setNewKRDesc(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && addKR(selectedOKR.id)}
                         placeholder="+ 关键结果" className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                         style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                  <input value={newKRTarget} onChange={e => setNewKRTarget(e.target.value)}
                         placeholder="目标值" className="w-20 rounded-lg px-2 py-1.5 text-sm outline-none text-center"
                         style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                  <button onClick={() => addKR(selectedOKR.id)} disabled={!newKRDesc.trim()}
                          className="text-sm font-bold disabled:opacity-30" style={{ color: swatch }}>+</button>
                </div>

                {/* Reviews */}
                {selectedOKR.reviews.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium mb-2" style={{ color: s.textMuted }}>复盘</h4>
                    <div className="space-y-1">
                      {selectedOKR.reviews.map(r => (
                        <div key={r.id} className="text-sm px-3 py-1.5 rounded-lg" style={{ backgroundColor: s.cardBg }}>
                          <span className="text-[11px]" style={{ color: s.textMuted }}>{r.date}</span>
                          <span className="ml-2" style={{ color: s.text2 }}>{r.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input type="text" value={reviewText} onChange={e => setReviewText(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && addReview(selectedOKR.id)}
                         placeholder="复盘..." className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                         style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                  <button onClick={() => addReview(selectedOKR.id)} disabled={!reviewText.trim()}
                          className="text-sm font-bold disabled:opacity-30" style={{ color: swatch }}>↵</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ Bottom Status Bar ══ */}
      <div className="flex-shrink-0 flex items-center gap-6 px-8 py-2 border-t text-sm" style={{ backgroundColor: s.panelBg, borderColor: s.divider }}>
        <span style={{ color: s.text2 }}>今日：<b style={{ color: swatch }}>{todayTomatoes}</b>/{dailyTarget} 🍅</span>
        <button onClick={() => setDailyTarget(prev => Math.max(1, prev - 1))} className="text-xs px-1.5 rounded" style={{ color: s.textMuted, backgroundColor: s.cardBg }}>−</button>
        <button onClick={() => setDailyTarget(prev => prev + 1)} className="text-xs px-1.5 rounded" style={{ color: s.textMuted, backgroundColor: s.cardBg }}>+</button>
        {interruptions > 0 && <span style={{ color: '#f97316' }}>中断 {interruptions}</span>}
        <div className="flex-1" />
        {timerActive && (
          <button onClick={() => setTimerPaused(!timerPaused)} className="text-xs px-3 py-1 rounded-lg font-medium"
                  style={{ backgroundColor: timerPaused ? swatch : s.cardBg, color: timerPaused ? '#fff' : s.text2 }}>
            {timerPaused ? '▶ 继续' : '⏸ 暂停'} {fmtTime(secondsLeft)}
          </button>
        )}
      </div>

      {/* ══ Timer Modal ══ */}
      {timerActive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl p-8 text-center min-w-[340px]" style={{ backgroundColor: s.panelBg, border: `2px solid ${swatch}` }}>
            {/* Context breadcrumb */}
            <div className="text-xs mb-4 max-w-[300px] truncate" style={{ color: s.textMuted }}>
              {timerLabels.join(' → ')}
            </div>
            {/* Timer display */}
            <div className="text-6xl font-bold mb-2 tabular-nums" style={{ color: timerPaused ? s.textMuted : s.text1 }}>
              {fmtTime(secondsLeft)}
            </div>
            {/* Progress bar */}
            <div className="mx-auto w-48 mb-4">{pb(Math.round(((25 * 60 - secondsLeft) / (25 * 60)) * 100), 6, swatch)}</div>
            {/* Buttons */}
            <div className="flex gap-3 justify-center">
              <button onClick={() => setTimerPaused(!timerPaused)}
                      className="px-5 py-2 rounded-xl text-white font-medium"
                      style={{ backgroundColor: timerPaused ? swatch : '#f59e0b' }}>
                {timerPaused ? '▶ 继续' : '⏸ 暂停'}
              </button>
              <button onClick={() => {
                setTimerActive(false); setTimerPaused(false); activeCtx.current = null; setSecondsLeft(25 * 60);
                setInterruptions(prev => prev + 1);
              }} className="px-5 py-2 rounded-xl text-white font-medium" style={{ backgroundColor: '#ef4444' }}>
                放弃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Timer Done Flash ══ */}
      {timerDone && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
          <div className="text-4xl font-bold" style={{ color: '#22c55e' }}>🍅 完成!</div>
        </div>
      )}
    </div>
  );
}
