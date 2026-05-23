'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SKINS } from '@/lib/skins';

interface LifeCalendarProps {
  birthYear: number;
  setBirthYear: (year: number) => void;
  onClose: () => void;
  skinKey?: string;
}

// ── OKR Data Model ──

type OKRStatus = 'not_started' | 'in_progress' | 'completed' | 'postponed' | 'abandoned';

interface KeyResult {
  id: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
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
  startDate: string;
  endDate: string;
  keyResults: KeyResult[];
  reviews: OKRReview[];
  createdAt: number;
}

type PeriodType = 'annual' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

const STATUS_MAP: Record<OKRStatus, { label: string; icon: string }> = {
  not_started: { label: '未开始', icon: '⚪' },
  in_progress: { label: '进行中', icon: '🔵' },
  completed: { label: '已完成', icon: '🟢' },
  postponed: { label: '延期', icon: '🟠' },
  abandoned: { label: '已放弃', icon: '⚫' },
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
    case 'postponed': return '#f97316';
    case 'abandoned': return '#6b7280';
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOKR, setEditingOKR] = useState<OKR | null>(null);
  const [addingReview, setAddingReview] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [mounted, setMounted] = useState(false);

  // Form
  const [formO, setFormO] = useState('');
  const [formKRs, setFormKRs] = useState<KeyResult[]>([
    { id: genId(), description: '', targetValue: 0, currentValue: 0, unit: '' },
  ]);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formPeriod, setFormPeriod] = useState<PeriodType>(getCurrentQuarter());

  const periodKey = period === 'annual' ? `${year}` : `${year}-${period}`;
  const periodLabel = period === 'annual' ? `${year}年度` : `${year} Q${period.slice(1)}`;

  useEffect(() => {
    const saved = localStorage.getItem('okr-data');
    if (saved) {
      try { setOkrs(JSON.parse(saved)); } catch { /* ignore */ }
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
    const notStarted = filteredOKRs.filter(o => o.status === 'not_started').length;
    const avgProgress = total > 0
      ? Math.round(filteredOKRs.reduce((s, o) => s + calcOKRProgress(o), 0) / total)
      : 0;
    return { total, completed, inProgress, notStarted, avgProgress };
  }, [filteredOKRs]);

  // ── CRUD ──

  const resetForm = useCallback(() => {
    setFormO('');
    setFormKRs([{ id: genId(), description: '', targetValue: 0, currentValue: 0, unit: '' }]);
    setFormStartDate('');
    setFormEndDate('');
    setFormPeriod(period);
    setEditingOKR(null);
  }, [period]);

  const openAddModal = useCallback(() => {
    resetForm();
    setShowAddModal(true);
  }, [resetForm]);

  const openEditModal = useCallback((okr: OKR) => {
    setFormO(okr.objective);
    setFormKRs(okr.keyResults.length > 0 ? okr.keyResults : [{ id: genId(), description: '', targetValue: 0, currentValue: 0, unit: '' }]);
    setFormStartDate(okr.startDate);
    setFormEndDate(okr.endDate);
    setFormPeriod(okr.period.includes('-Q') ? ('Q' + okr.period.split('-Q')[1]) as PeriodType : 'annual');
    setEditingOKR(okr);
    setShowAddModal(true);
  }, []);

  const saveOKR = useCallback(() => {
    if (!formO.trim()) return;
    const pk = formPeriod === 'annual' ? `${year}` : `${year}-${formPeriod}`;
    const newOKR: OKR = {
      id: editingOKR?.id || genId(),
      objective: formO.trim(),
      status: editingOKR?.status || 'not_started',
      period: pk,
      startDate: formStartDate,
      endDate: formEndDate,
      keyResults: formKRs.filter(kr => kr.description.trim()),
      reviews: editingOKR?.reviews || [],
      createdAt: editingOKR?.createdAt || Date.now(),
    };
    if (editingOKR) {
      setOkrs(prev => prev.map(o => o.id === editingOKR.id ? newOKR : o));
    } else {
      setOkrs(prev => [...prev, newOKR]);
      setSelectedId(newOKR.id);
    }
    setShowAddModal(false);
    resetForm();
  }, [formO, formKRs, formStartDate, formEndDate, formPeriod, editingOKR, year, resetForm]);

  const deleteOKR = useCallback((id: string) => {
    setOkrs(prev => prev.filter(o => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const updateStatus = useCallback((id: string, status: OKRStatus) => {
    setOkrs(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  }, []);

  const updateKRValue = useCallback((okrId: string, krId: string, value: number) => {
    setOkrs(prev => prev.map(o => {
      if (o.id !== okrId) return o;
      return { ...o, keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, currentValue: value } : kr) };
    }));
  }, []);

  const addReview = useCallback((okrId: string) => {
    if (!reviewText.trim()) return;
    const review: OKRReview = { id: genId(), date: new Date().toISOString().slice(0, 10), content: reviewText.trim() };
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, reviews: [...o.reviews, review] } : o));
    setReviewText('');
    setAddingReview(false);
  }, [reviewText]);

  // Auto-select first OKR when period changes
  useEffect(() => {
    if (filteredOKRs.length > 0 && !filteredOKRs.find(o => o.id === selectedId)) {
      setSelectedId(filteredOKRs[0].id);
    }
  }, [filteredOKRs, selectedId]);

  if (!mounted) return null;

  const progressBar = (pct: number, h: number = 6, color?: string) => (
    <div className="w-full rounded-full" style={{ height: h, backgroundColor: 'rgba(0,0,0,0.08)' }}>
      <div className="rounded-full transition-all duration-500" style={{
        width: `${Math.min(pct, 100)}%`, height: '100%',
        backgroundColor: color || (pct >= 100 ? '#22c55e' : pct >= 60 ? swatch : pct >= 30 ? '#f97316' : '#94a3b8'),
      }} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: '#0f0f1a' }}>
      {/* ════════ LEFT PANEL ════════ */}
      <div className="w-[480px] flex-shrink-0 flex flex-col border-r" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 flex-shrink-0" style={{ backgroundColor: swatch }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🗺</span>
            <h1 className="text-white font-bold text-lg">人生旅途</h1>
            <span className="text-white/50 text-xs ml-1">OKR</span>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors text-xl">×</button>
        </div>

        {/* Period Selector */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            {(['annual', 'Q1', 'Q2', 'Q3', 'Q4'] as PeriodType[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                      style={{
                        backgroundColor: period === p ? swatch : 'rgba(255,255,255,0.06)',
                        color: period === p ? '#ffffff' : 'rgba(255,255,255,0.5)',
                      }}>
                {p === 'annual' ? '年度' : `Q${p.slice(1)}`}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={openAddModal}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: swatch }}>
              + 新增
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 py-2">
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold" style={{ color: swatch }}>{stats.avgProgress}%</span>
              <span className="text-[11px] text-gray-500">完成率</span>
            </div>
            <div className="flex-1">{progressBar(stats.avgProgress, 5, swatch)}</div>
            <div className="flex gap-3 text-[11px] text-gray-500">
              <span>🟢{stats.completed}</span>
              <span>🔵{stats.inProgress}</span>
              <span>⚪{stats.notStarted}</span>
            </div>
          </div>
        </div>

        {/* OKR List */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          {filteredOKRs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <span className="text-4xl mb-3">🎯</span>
              <p className="text-sm mb-1">当前周期暂无 OKR</p>
              <p className="text-xs mb-4 text-gray-600">点击「新增」创建第一个目标</p>
              <button onClick={openAddModal}
                      className="px-5 py-2 rounded-xl text-white text-sm font-bold"
                      style={{ backgroundColor: swatch }}>
                + 创建 OKR
              </button>
            </div>
          ) : (
            filteredOKRs.map(okr => {
              const progress = calcOKRProgress(okr);
              const sc = STATUS_MAP[okr.status];
              const color = statusColor(okr.status, swatch);
              const isSelected = selectedId === okr.id;
              return (
                <button key={okr.id}
                        onClick={() => setSelectedId(okr.id)}
                        className="w-full text-left rounded-xl px-4 py-3 transition-all"
                        style={{
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                          borderLeft: `3px solid ${isSelected ? color : 'transparent'}`,
                        }}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px]">{sc.icon}</span>
                        <span className="text-[11px]" style={{ color }}>{sc.label}</span>
                      </div>
                      <p className="text-white text-sm font-medium leading-snug truncate">{okr.objective}</p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-base font-bold" style={{ color }}>{progress}%</span>
                    </div>
                  </div>
                  {progressBar(progress, 3, color)}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-600">
                    <span>{okr.keyResults.length}个KR</span>
                    {okr.reviews.length > 0 && <span>{okr.reviews.length}条复盘</span>}
                  </div>
                </button>
              );
            })
          )}

          {/* Dashboard mini chart */}
          {filteredOKRs.length > 1 && (
            <div className="rounded-xl p-4 mt-2" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <h4 className="text-gray-400 text-xs font-medium mb-2">📊 周期总览</h4>
              <div className="flex items-end gap-1.5" style={{ height: 50 }}>
                {filteredOKRs.map((okr, idx) => {
                  const pct = calcOKRProgress(okr);
                  const color = statusColor(okr.status, swatch);
                  return (
                    <div key={okr.id} className="flex flex-col items-center flex-1 gap-0.5" title={okr.objective}>
                      <span className="text-[9px] text-gray-500">{pct}%</span>
                      <div className="w-full rounded-t transition-all duration-500"
                           style={{ height: `${Math.max(pct, 6)}%`, backgroundColor: color, opacity: 0.7, minHeight: 3 }} />
                      <span className="text-[8px] text-gray-600">O{idx + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════ RIGHT PANEL: Detail ════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedOKR ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <span className="text-5xl mb-4">🎯</span>
            <p className="text-lg font-medium mb-2">选择或创建一个 OKR</p>
            <p className="text-sm text-gray-600">在左侧列表中选择目标查看详情</p>
          </div>
        ) : (
          <>
            {/* Detail Header */}
            <div className="flex-shrink-0 px-8 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{ backgroundColor: statusColor(selectedOKR.status, swatch) + '20', color: statusColor(selectedOKR.status, swatch) }}>
                      {STATUS_MAP[selectedOKR.status].icon} {STATUS_MAP[selectedOKR.status].label}
                    </span>
                    <span className="text-xs text-gray-500">{periodLabel}</span>
                    {selectedOKR.startDate && (
                      <span className="text-xs text-gray-600">{selectedOKR.startDate} ~ {selectedOKR.endDate}</span>
                    )}
                  </div>
                  <h2 className="text-white font-bold text-xl leading-snug">{selectedOKR.objective}</h2>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-3xl font-bold" style={{ color: statusColor(selectedOKR.status, swatch) }}>
                    {calcOKRProgress(selectedOKR)}%
                  </span>
                  <div className="w-28">{progressBar(calcOKRProgress(selectedOKR), 6, statusColor(selectedOKR.status, swatch))}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-3">
                <select value={selectedOKR.status}
                        onChange={e => updateStatus(selectedOKR.id, e.target.value as OKRStatus)}
                        className="text-xs rounded-lg px-3 py-1.5 outline-none cursor-pointer"
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {Object.entries(STATUS_MAP).map(([k, v]) => (
                    <option key={k} value={k} style={{ backgroundColor: '#1a1a2e' }}>{v.icon} {v.label}</option>
                  ))}
                </select>
                <button onClick={() => openEditModal(selectedOKR)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:text-white"
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#999' }}>
                  ✏️ 编辑
                </button>
                <button onClick={() => setAddingReview(!addingReview)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:text-white"
                        style={{ backgroundColor: addingReview ? swatch + '30' : 'rgba(255,255,255,0.06)', color: addingReview ? '#fff' : '#999' }}>
                  📝 复盘
                </button>
                <div className="flex-1" />
                <button onClick={() => { if (confirm('确认删除此 OKR？')) deleteOKR(selectedOKR.id); }}
                        className="text-xs px-3 py-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                  🗑 删除
                </button>
              </div>
            </div>

            {/* Detail Body */}
            <div className="flex-1 overflow-y-auto px-8 py-5 space-y-4">
              {/* Key Results */}
              <div>
                <h3 className="text-gray-400 text-sm font-medium mb-3">📊 关键结果 (Key Results)</h3>
                <div className="space-y-3">
                  {selectedOKR.keyResults.map((kr, idx) => {
                    const krPct = kr.targetValue > 0 ? Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100) : 0;
                    const krColor = krPct >= 100 ? '#22c55e' : swatch;
                    return (
                      <div key={kr.id} className="rounded-xl px-5 py-3.5"
                           style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.05)` }}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold mr-2" style={{ color: krColor }}>KR{idx + 1}</span>
                            <span className="text-white text-sm">{kr.description}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <input type="number"
                                   value={kr.currentValue}
                                   onChange={e => updateKRValue(selectedOKR.id, kr.id, Number(e.target.value))}
                                   className="w-16 text-right rounded-lg px-2 py-1 text-white font-bold text-sm outline-none"
                                   style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                            <span className="text-gray-500 text-sm">/</span>
                            <span className="text-gray-300 text-sm font-medium">{kr.targetValue}</span>
                            {kr.unit && <span className="text-gray-500 text-xs">{kr.unit}</span>}
                            <span className="text-xs font-bold ml-1" style={{ color: krColor }}>{krPct}%</span>
                          </div>
                        </div>
                        {progressBar(krPct, 5, krColor)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Review */}
              {addingReview && (
                <div className="rounded-xl px-5 py-4"
                     style={{ backgroundColor: swatch + '10', border: `1px solid ${swatch}25` }}>
                  <h4 className="text-sm font-medium mb-2" style={{ color: swatch }}>📝 添加复盘</h4>
                  <textarea
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    placeholder="记录阻碍、经验、调整计划..."
                    className="w-full bg-transparent text-gray-300 text-sm outline-none resize-none min-h-[80px] placeholder-gray-600"
                  />
                  <div className="flex justify-end gap-2 mt-1">
                    <button onClick={() => { setAddingReview(false); setReviewText(''); }}
                            className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg">取消</button>
                    <button onClick={() => addReview(selectedOKR.id)}
                            className="text-xs text-white px-4 py-1.5 rounded-lg font-medium"
                            style={{ backgroundColor: swatch }}>保存复盘</button>
                  </div>
                </div>
              )}

              {/* Reviews */}
              {selectedOKR.reviews.length > 0 && (
                <div>
                  <h3 className="text-gray-400 text-sm font-medium mb-3">📋 复盘记录 ({selectedOKR.reviews.length})</h3>
                  <div className="space-y-2">
                    {selectedOKR.reviews.map(r => (
                      <div key={r.id} className="rounded-xl px-4 py-3"
                           style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                        <span className="text-gray-600 text-xs">{r.date}</span>
                        <p className="text-gray-400 text-sm mt-1 leading-relaxed">{r.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ════════ Add/Edit Modal ════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center"
             style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
             onClick={e => { if (e.target === e.currentTarget) { setShowAddModal(false); resetForm(); } }}>
          <div className="rounded-2xl w-[560px] max-h-[80vh] overflow-y-auto"
               style={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <h3 className="text-white font-bold text-lg">{editingOKR ? '编辑 OKR' : '新增 OKR'}</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }}
                      className="text-gray-500 hover:text-white text-xl transition-colors">×</button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Objective */}
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">🎯 目标 (Objective)</label>
                <input type="text" value={formO} onChange={e => setFormO(e.target.value)}
                       placeholder="一句话定性描述，例：打造稳定个人现金流"
                       className="w-full text-white rounded-xl px-4 py-2.5 outline-none text-sm placeholder-gray-600"
                       style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>

              {/* Key Results */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400 text-sm font-medium">📊 关键结果 (Key Results)</label>
                  <button onClick={() => setFormKRs(prev => [...prev, { id: genId(), description: '', targetValue: 0, currentValue: 0, unit: '' }])}
                          className="text-xs px-2 py-0.5 rounded transition-colors"
                          style={{ color: swatch }}
                          disabled={formKRs.length >= 4}>+ 添加 KR</button>
                </div>
                <div className="space-y-2">
                  {formKRs.map((kr, idx) => (
                    <div key={kr.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold w-6" style={{ color: swatch }}>KR{idx + 1}</span>
                      <input type="text" value={kr.description}
                             onChange={e => setFormKRs(prev => prev.map((k, i) => i === idx ? { ...k, description: e.target.value } : k))}
                             placeholder="描述"
                             className="flex-1 text-white rounded-lg px-3 py-1.5 outline-none text-sm placeholder-gray-600"
                             style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <input type="number" value={kr.targetValue || ''}
                             onChange={e => setFormKRs(prev => prev.map((k, i) => i === idx ? { ...k, targetValue: Number(e.target.value) } : k))}
                             placeholder="目标值"
                             className="w-20 text-white rounded-lg px-2 py-1.5 outline-none text-sm text-center"
                             style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <input type="text" value={kr.unit}
                             onChange={e => setFormKRs(prev => prev.map((k, i) => i === idx ? { ...k, unit: e.target.value } : k))}
                             placeholder="单位"
                             className="w-14 text-white rounded-lg px-2 py-1.5 outline-none text-sm text-center"
                             style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                      {formKRs.length > 1 && (
                        <button onClick={() => setFormKRs(prev => prev.filter((_, i) => i !== idx))}
                                className="text-gray-600 hover:text-red-400 text-sm transition-colors">×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Period & Dates */}
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">📅 周期与时间</label>
                <div className="flex items-center gap-3">
                  <select value={formPeriod} onChange={e => setFormPeriod(e.target.value as PeriodType)}
                          className="text-white rounded-lg px-3 py-1.5 outline-none text-sm cursor-pointer"
                          style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {(['annual', 'Q1', 'Q2', 'Q3', 'Q4'] as PeriodType[]).map(p => (
                      <option key={p} value={p} style={{ backgroundColor: '#1a1a2e' }}>
                        {p === 'annual' ? `${year}年度` : `${year} Q${p.slice(1)}`}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)}
                         className="text-white rounded-lg px-3 py-1.5 outline-none text-sm"
                         style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <span className="text-gray-600">~</span>
                  <input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)}
                         className="text-white rounded-lg px-3 py-1.5 outline-none text-sm"
                         style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowAddModal(false); resetForm(); }}
                        className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-300 text-sm">取消</button>
                <button onClick={saveOKR} disabled={!formO.trim()}
                        className="px-6 py-2 rounded-xl text-white font-bold text-sm disabled:opacity-40"
                        style={{ backgroundColor: swatch }}>
                  {editingOKR ? '保存修改' : '创建 OKR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
