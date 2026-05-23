'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SKINS } from '@/lib/skins';

interface LifeCalendarProps {
  birthYear: number;
  setBirthYear: (year: number) => void;
  onClose: () => void;
  skinKey?: string;
}

type OKRStatus = 'not_started' | 'in_progress' | 'completed';

interface KeyResult {
  id: string;
  description: string;
  targetValue: number;
  currentValue: number;
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

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getCurrentQuarter(): PeriodType {
  const m = new Date().getMonth();
  if (m < 3) return 'Q1';
  if (m < 6) return 'Q2';
  if (m < 9) return 'Q3';
  return 'Q4';
}

function calcOKRProgress(okr: OKR): number {
  if (okr.keyResults.length === 0) return 0;
  const total = okr.keyResults.reduce((sum, kr) => {
    const pct = kr.targetValue > 0 ? Math.min(kr.currentValue / kr.targetValue, 1) : 0;
    return sum + pct;
  }, 0);
  return Math.round((total / okr.keyResults.length) * 100);
}

function statusColor(status: OKRStatus, swatch: string): string {
  switch (status) {
    case 'completed': return '#22c55e';
    case 'in_progress': return swatch;
    default: return '#94a3b8';
  }
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
  const [editingO, setEditingO] = useState<string | null>(null);
  const [editOText, setEditOText] = useState('');
  const [newKRDesc, setNewKRDesc] = useState('');
  const [newKRTarget, setNewKRTarget] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [editingKR, setEditingKR] = useState<string | null>(null);
  const [editKRValue, setEditKRValue] = useState(0);

  const periodKey = period === 'annual' ? `${year}` : `${year}-${period}`;
  const periodLabel = period === 'annual' ? `${year}年度` : `${year} Q${period.slice(1)}`;

  useEffect(() => {
    const saved = localStorage.getItem('okr-data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate old data: remove unit, trim status
        const migrated = parsed.map((o: OKR & { keyResults?: KeyResult[] & { unit?: string }[]; status?: string }) => ({
          ...o,
          status: STATUS_CYCLE.includes(o.status as OKRStatus) ? o.status : 'not_started',
          keyResults: (o.keyResults || []).map((kr: KeyResult & { unit?: string }) => ({
            id: kr.id, description: kr.description, targetValue: kr.targetValue, currentValue: kr.currentValue,
          })),
        }));
        setOkrs(migrated);
      } catch { /* ignore */ }
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('okr-data', JSON.stringify(okrs));
  }, [okrs, mounted]);

  const filteredOKRs = useMemo(() => okrs.filter(o => o.period === periodKey), [okrs, periodKey]);
  const selectedOKR = useMemo(() => okrs.find(o => o.id === selectedId) || null, [okrs, selectedId]);

  const stats = useMemo(() => {
    const total = filteredOKRs.length;
    const completed = filteredOKRs.filter(o => o.status === 'completed').length;
    const inProgress = filteredOKRs.filter(o => o.status === 'in_progress').length;
    const avgProgress = total > 0 ? Math.round(filteredOKRs.reduce((s, o) => s + calcOKRProgress(o), 0) / total) : 0;
    return { total, completed, inProgress, avgProgress };
  }, [filteredOKRs]);

  // ── Actions ──

  const quickAdd = useCallback(() => {
    if (!quickInput.trim()) return;
    const newOKR: OKR = {
      id: genId(), objective: quickInput.trim(), status: 'not_started',
      period: periodKey, keyResults: [], reviews: [], createdAt: Date.now(),
    };
    setOkrs(prev => [...prev, newOKR]);
    setSelectedId(newOKR.id);
    setQuickInput('');
  }, [quickInput, periodKey]);

  const cycleStatus = useCallback((id: string) => {
    setOkrs(prev => prev.map(o => {
      if (o.id !== id) return o;
      const idx = STATUS_CYCLE.indexOf(o.status);
      return { ...o, status: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] };
    }));
  }, []);

  const deleteOKR = useCallback((id: string) => {
    setOkrs(prev => prev.filter(o => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const addKR = useCallback((okrId: string) => {
    if (!newKRDesc.trim()) return;
    const target = Number(newKRTarget) || 100;
    setOkrs(prev => prev.map(o => o.id === okrId ? {
      ...o, keyResults: [...o.keyResults, { id: genId(), description: newKRDesc.trim(), targetValue: target, currentValue: 0 }],
    } : o));
    setNewKRDesc('');
    setNewKRTarget('');
  }, [newKRDesc, newKRTarget]);

  const removeKR = useCallback((okrId: string, krId: string) => {
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, keyResults: o.keyResults.filter(kr => kr.id !== krId) } : o));
  }, []);

  const updateKRCurrent = useCallback((okrId: string, krId: string, value: number) => {
    setOkrs(prev => prev.map(o => o.id === okrId ? {
      ...o, keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, currentValue: value } : kr),
    } : o));
    setEditingKR(null);
  }, []);

  const saveObjective = useCallback((id: string) => {
    if (!editOText.trim()) { setEditingO(null); return; }
    setOkrs(prev => prev.map(o => o.id === id ? { ...o, objective: editOText.trim() } : o));
    setEditingO(null);
  }, [editOText]);

  const addReview = useCallback((okrId: string) => {
    if (!reviewText.trim()) return;
    setOkrs(prev => prev.map(o => o.id === okrId ? {
      ...o, reviews: [...o.reviews, { id: genId(), date: new Date().toISOString().slice(0, 10), content: reviewText.trim() }],
    } : o));
    setReviewText('');
  }, [reviewText]);

  useEffect(() => {
    if (filteredOKRs.length > 0 && !filteredOKRs.find(o => o.id === selectedId)) {
      setSelectedId(filteredOKRs[0].id);
    }
  }, [filteredOKRs, selectedId]);

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
          <button onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors text-xl">×</button>
        </div>

        {/* Period + Quick Add */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3 space-y-3">
          {/* Period tabs */}
          <div className="flex items-center gap-2">
            {(['annual', 'Q1', 'Q2', 'Q3', 'Q4'] as PeriodType[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                      className="px-3 py-1 rounded-lg text-sm font-medium transition-all"
                      style={{
                        backgroundColor: period === p ? swatch : s.cardBg,
                        color: period === p ? '#fff' : s.text2,
                        border: period === p ? 'none' : `1px solid ${s.divider}`,
                      }}>
                {p === 'annual' ? '年度' : `Q${p.slice(1)}`}
              </button>
            ))}
          </div>

          {/* Quick add input */}
          <div className="flex items-center gap-2">
            <input type="text" value={quickInput} onChange={e => setQuickInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && quickAdd()}
                   placeholder="输入目标，回车创建"
                   className="flex-1 rounded-lg px-3 py-2 outline-none text-sm"
                   style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
            <button onClick={quickAdd} disabled={!quickInput.trim()}
                    className="px-3 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-40"
                    style={{ backgroundColor: swatch }}>+</button>
          </div>

          {/* Stats */}
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
              <span className="text-3xl mb-2">🎯</span>
              <p className="text-sm">输入目标开始吧</p>
            </div>
          ) : (
            filteredOKRs.map(okr => {
              const progress = calcOKRProgress(okr);
              const color = statusColor(okr.status, swatch);
              const isActive = selectedId === okr.id;
              return (
                <button key={okr.id} onClick={() => setSelectedId(okr.id)}
                        className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
                        style={{
                          backgroundColor: isActive ? s.cardHover : 'transparent',
                          borderLeft: `3px solid ${isActive ? color : 'transparent'}`,
                        }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" onClick={e => { e.stopPropagation(); cycleStatus(okr.id); }}
                          style={{ color, cursor: 'pointer' }}>
                      {STATUS_DISPLAY[okr.status].icon}
                    </span>
                    <span className="flex-1 text-sm truncate" style={{ color: s.text1 }}>{okr.objective}</span>
                    <span className="text-xs font-bold" style={{ color }}>{progress}%</span>
                  </div>
                  {progress > 0 && <div className="mt-1 ml-5">{pb(progress, 2, color)}</div>}
                </button>
              );
            })
          )}
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
            {/* Detail Header */}
            <div className="flex-shrink-0 px-8 py-4 border-b" style={{ borderColor: s.divider, backgroundColor: s.panelBg }}>
              <div className="flex items-center gap-3">
                {/* Status click-to-cycle */}
                <button onClick={() => cycleStatus(selectedOKR.id)}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                        style={{ backgroundColor: statusColor(selectedOKR.status, swatch) + '18', color: statusColor(selectedOKR.status, swatch) }}>
                  {STATUS_DISPLAY[selectedOKR.status].icon} {STATUS_DISPLAY[selectedOKR.status].label}
                </button>

                {/* Objective: click to edit */}
                {editingO === selectedOKR.id ? (
                  <input autoFocus value={editOText} onChange={e => setEditOText(e.target.value)}
                         onBlur={() => saveObjective(selectedOKR.id)}
                         onKeyDown={e => { if (e.key === 'Enter') saveObjective(selectedOKR.id); if (e.key === 'Escape') setEditingO(null); }}
                         className="flex-1 text-xl font-bold outline-none rounded-lg px-2 py-0.5"
                         style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                ) : (
                  <h2 className="flex-1 text-xl font-bold truncate cursor-pointer hover:opacity-80"
                      style={{ color: s.text1 }}
                      onClick={() => { setEditingO(selectedOKR.id); setEditOText(selectedOKR.objective); }}>
                    {selectedOKR.objective}
                  </h2>
                )}

                {/* Progress */}
                <span className="text-2xl font-bold" style={{ color: statusColor(selectedOKR.status, swatch) }}>
                  {calcOKRProgress(selectedOKR)}%
                </span>

                {/* Delete */}
                <button onClick={() => deleteOKR(selectedOKR.id)}
                        className="text-lg opacity-30 hover:opacity-80 transition-opacity" style={{ color: s.textMuted }}>×</button>
              </div>
              <div className="text-xs mt-1" style={{ color: s.textMuted }}>{periodLabel}</div>
            </div>

            {/* Detail Body */}
            <div className="flex-1 overflow-y-auto px-8 py-5 space-y-5">
              {/* Key Results */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium" style={{ color: s.text2 }}>关键结果</h3>
                </div>

                <div className="space-y-2">
                  {selectedOKR.keyResults.map((kr, idx) => {
                    const krPct = kr.targetValue > 0 ? Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100) : 0;
                    const krColor = krPct >= 100 ? '#22c55e' : swatch;
                    return (
                      <div key={kr.id} className="rounded-lg px-4 py-3 group"
                           style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold" style={{ color: krColor }}>KR{idx + 1}</span>
                          <span className="flex-1 text-sm" style={{ color: s.text1 }}>{kr.description}</span>
                          {/* Progress value: click to edit */}
                          {editingKR === kr.id ? (
                            <input autoFocus type="number" value={editKRValue}
                                   onChange={e => setEditKRValue(Number(e.target.value))}
                                   onBlur={() => updateKRCurrent(selectedOKR.id, kr.id, editKRValue)}
                                   onKeyDown={e => { if (e.key === 'Enter') updateKRCurrent(selectedOKR.id, kr.id, editKRValue); if (e.key === 'Escape') setEditingKR(null); }}
                                   className="w-16 text-right rounded px-1.5 py-0.5 text-sm font-bold outline-none"
                                   style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                          ) : (
                            <button onClick={() => { setEditingKR(kr.id); setEditKRValue(kr.currentValue); }}
                                    className="text-sm font-bold hover:opacity-70"
                                    style={{ color: krColor }}>
                              {kr.currentValue}/{kr.targetValue}
                            </button>
                          )}
                          <span className="text-xs font-bold" style={{ color: krColor }}>{krPct}%</span>
                          {/* Delete KR */}
                          <button onClick={() => removeKR(selectedOKR.id, kr.id)}
                                  className="text-xs opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                                  style={{ color: s.textMuted }}>×</button>
                        </div>
                        {pb(krPct, 4, krColor)}
                      </div>
                    );
                  })}
                </div>

                {/* Add KR inline */}
                <div className="flex items-center gap-2 mt-2">
                  <input type="text" value={newKRDesc} onChange={e => setNewKRDesc(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && addKR(selectedOKR.id)}
                         placeholder="+ 添加关键结果"
                         className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                         style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                  <input type="number" value={newKRTarget} onChange={e => setNewKRTarget(e.target.value)}
                         placeholder="目标值"
                         className="w-20 rounded-lg px-2 py-1.5 text-sm outline-none text-center"
                         style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                  <button onClick={() => addKR(selectedOKR.id)} disabled={!newKRDesc.trim()}
                          className="text-sm font-bold disabled:opacity-30" style={{ color: swatch }}>+</button>
                </div>
              </div>

              {/* Reviews */}
              <div>
                <h3 className="text-sm font-medium mb-3" style={{ color: s.text2 }}>复盘记录</h3>
                {selectedOKR.reviews.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {selectedOKR.reviews.map(r => (
                      <div key={r.id} className="text-sm px-3 py-2 rounded-lg"
                           style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                        <span className="text-[11px]" style={{ color: s.textMuted }}>{r.date}</span>
                        <p style={{ color: s.text2 }}>{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input type="text" value={reviewText} onChange={e => setReviewText(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && addReview(selectedOKR.id)}
                         placeholder="记录复盘..."
                         className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                         style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                  <button onClick={() => addReview(selectedOKR.id)} disabled={!reviewText.trim()}
                          className="text-sm font-bold disabled:opacity-30" style={{ color: swatch }}>↵</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
