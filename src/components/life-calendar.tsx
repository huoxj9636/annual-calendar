'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SKINS, NO_SKIN, DEFAULT_SKIN } from '@/lib/skins';

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
  period: string; // '2026' or '2026-Q1' etc.
  startDate: string;
  endDate: string;
  keyResults: KeyResult[];
  reviews: OKRReview[];
  createdAt: number;
}

type PeriodType = 'annual' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

const STATUS_CONFIG: Record<OKRStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: '未开始', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  in_progress: { label: '进行中', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  completed: { label: '已完成', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  postponed: { label: '延期', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  abandoned: { label: '已放弃', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
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

function getPeriodLabel(period: string): string {
  if (period.includes('-Q')) {
    const parts = period.split('-Q');
    return `${parts[0]}年 Q${parts[1]}`;
  }
  return `${period}年度`;
}

function calcOKRProgress(okr: OKR): number {
  if (okr.keyResults.length === 0) return 0;
  const total = okr.keyResults.reduce((sum, kr) => {
    const pct = kr.targetValue > 0 ? Math.min(kr.currentValue / kr.targetValue, 1) : 0;
    return sum + pct;
  }, 0);
  return Math.round((total / okr.keyResults.length) * 100);
}

export default function LifeCalendar({ onClose, skinKey }: LifeCalendarProps) {
  const skin = SKINS.find(s => s.key === skinKey) || SKINS[0];
  const swatch = skin.swatch || '#6558c1';

  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [period, setPeriod] = useState<PeriodType>(getCurrentQuarter());
  const [year] = useState(getCurrentYear());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOKR, setEditingOKR] = useState<OKR | null>(null);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [addingReview, setAddingReview] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [mounted, setMounted] = useState(false);

  // Form state for add/edit
  const [formO, setFormO] = useState('');
  const [formKRs, setFormKRs] = useState<KeyResult[]>([
    { id: genId(), description: '', targetValue: 0, currentValue: 0, unit: '' },
  ]);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formPeriod, setFormPeriod] = useState<PeriodType>(getCurrentQuarter());

  const periodKey = period === 'annual' ? `${year}` : `${year}-${period}`;

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('okr-data');
    if (saved) {
      try { setOkrs(JSON.parse(saved)); } catch { /* ignore */ }
    }
    setMounted(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('okr-data', JSON.stringify(okrs));
  }, [okrs, mounted]);

  // Filter OKRs by period
  const filteredOKRs = useMemo(() => {
    return okrs.filter(o => o.period === periodKey);
  }, [okrs, periodKey]);

  // Stats
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

  // ── OKR CRUD ──

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
    }
    setShowAddModal(false);
    resetForm();
  }, [formO, formKRs, formStartDate, formEndDate, formPeriod, editingOKR, year, resetForm]);

  const deleteOKR = useCallback((id: string) => {
    setOkrs(prev => prev.filter(o => o.id !== id));
  }, []);

  const updateStatus = useCallback((id: string, status: OKRStatus) => {
    setOkrs(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  }, []);

  const updateKRValue = useCallback((okrId: string, krId: string, value: number) => {
    setOkrs(prev => prev.map(o => {
      if (o.id !== okrId) return o;
      return {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? { ...kr, currentValue: value } : kr
        ),
      };
    }));
  }, []);

  const addReview = useCallback((okrId: string) => {
    if (!reviewText.trim()) return;
    const review: OKRReview = { id: genId(), date: new Date().toISOString().slice(0, 10), content: reviewText.trim() };
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, reviews: [...o.reviews, review] } : o));
    setReviewText('');
    setAddingReview(null);
  }, [reviewText]);

  const archiveOKR = useCallback((id: string) => {
    setOkrs(prev => prev.map(o => o.id === id ? { ...o, status: 'completed' as OKRStatus } : o));
  }, []);

  // ── Render helpers ──

  const renderStatCard = (label: string, value: number | string, color: string) => (
    <div className="rounded-xl px-3 py-2 flex flex-col items-center min-w-[70px]"
         style={{ backgroundColor: color + '18' }}>
      <span className="text-xl font-bold" style={{ color }}>{value}</span>
      <span className="text-[11px] text-gray-500 mt-0.5">{label}</span>
    </div>
  );

  const renderProgressBar = (pct: number, height = 6, color?: string) => (
    <div className="w-full rounded-full" style={{ height, backgroundColor: 'rgba(0,0,0,0.08)' }}>
      <div className="rounded-full transition-all duration-500"
           style={{
             width: `${Math.min(pct, 100)}%`,
             height: '100%',
             backgroundColor: color || (pct >= 100 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 30 ? '#f97316' : '#94a3b8'),
           }} />
    </div>
  );

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#0f0f1a' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 h-14 flex-shrink-0"
           style={{ backgroundColor: swatch }}>
        <div className="flex items-center gap-3">
          <span className="text-lg">🗺</span>
          <h1 className="text-white font-bold text-lg">人生旅途</h1>
          <span className="text-white/60 text-sm">OKR 目标管理</span>
        </div>
        <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors text-xl">
          ×
        </button>
      </div>

      {/* ── Period Selector + Stats ── */}
      <div className="flex-shrink-0 px-6 py-4" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
        {/* Period tabs */}
        <div className="flex items-center gap-2 mb-4">
          {(['annual', 'Q1', 'Q2', 'Q3', 'Q4'] as PeriodType[]).map(p => (
            <button key={p}
                    onClick={() => setPeriod(p)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: period === p ? swatch : 'rgba(255,255,255,0.06)',
                      color: period === p ? '#ffffff' : 'rgba(255,255,255,0.5)',
                    }}>
              {p === 'annual' ? `${year}年度` : `Q${p.slice(1)}`}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={openAddModal}
                  className="px-4 py-1.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: swatch }}>
            + 新增 OKR
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3">
          {renderStatCard('总目标', stats.total, '#94a3b8')}
          {renderStatCard('已完成', stats.completed, '#22c55e')}
          {renderStatCard('进行中', stats.inProgress, '#3b82f6')}
          {renderStatCard('未开始', stats.notStarted, '#94a3b8')}
          <div className="flex-1" />
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-white">{stats.avgProgress}%</span>
            <span className="text-[11px] text-gray-500">整体完成率</span>
          </div>
          <div className="w-32">
            {renderProgressBar(stats.avgProgress, 8, swatch)}
          </div>
        </div>
      </div>

      {/* ── OKR Card List ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {filteredOKRs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <span className="text-5xl mb-4">🎯</span>
            <p className="text-lg font-medium mb-2">当前周期暂无 OKR</p>
            <p className="text-sm mb-6">点击上方「新增 OKR」开始设定目标</p>
            <button onClick={openAddModal}
                    className="px-6 py-2.5 rounded-xl text-white font-bold transition-all hover:opacity-90"
                    style={{ backgroundColor: swatch }}>
              + 创建第一个 OKR
            </button>
          </div>
        ) : (
          filteredOKRs.map(okr => {
            const progress = calcOKRProgress(okr);
            const sc = STATUS_CONFIG[okr.status];
            return (
              <div key={okr.id}
                   className="rounded-2xl overflow-hidden transition-all"
                   style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.06)` }}>
                {/* O header */}
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded"
                              style={{ backgroundColor: sc.bg, color: sc.color }}>
                          {sc.label}
                        </span>
                        <span className="text-[11px] text-gray-500">{getPeriodLabel(okr.period)}</span>
                      </div>
                      <h3 className="text-white font-bold text-base leading-snug">{okr.objective}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xl font-bold" style={{ color: progress >= 100 ? '#22c55e' : swatch }}>
                        {progress}%
                      </span>
                      {renderProgressBar(progress, 4, progress >= 100 ? '#22c55e' : swatch)}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-2">
                    <select value={okr.status}
                            onChange={e => updateStatus(okr.id, e.target.value as OKRStatus)}
                            className="text-[11px] rounded px-2 py-0.5 bg-white/5 text-gray-400 border border-white/10 outline-none cursor-pointer">
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k} style={{ backgroundColor: '#1a1a2e' }}>{v.label}</option>
                      ))}
                    </select>
                    <button onClick={() => openEditModal(okr)}
                            className="text-[11px] text-gray-500 hover:text-white transition-colors">
                      编辑
                    </button>
                    <button onClick={() => archiveOKR(okr.id)}
                            className="text-[11px] text-gray-500 hover:text-green-400 transition-colors">
                      归档
                    </button>
                    <button onClick={() => { if (confirm('确认删除此 OKR？')) deleteOKR(okr.id); }}
                            className="text-[11px] text-gray-500 hover:text-red-400 transition-colors">
                      删除
                    </button>
                    <button onClick={() => setAddingReview(addingReview === okr.id ? null : okr.id)}
                            className="text-[11px] text-gray-500 hover:text-blue-400 transition-colors">
                      复盘
                    </button>
                    {okr.reviews.length > 0 && (
                      <button onClick={() => setExpandedReview(expandedReview === okr.id ? null : okr.id)}
                              className="text-[11px] text-gray-500 hover:text-white transition-colors">
                        复盘记录({okr.reviews.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* KR list */}
                {okr.keyResults.length > 0 && (
                  <div className="px-5 pb-4 space-y-2">
                    {okr.keyResults.map((kr, idx) => {
                      const krPct = kr.targetValue > 0 ? Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100) : 0;
                      return (
                        <div key={kr.id} className="rounded-xl px-4 py-2.5"
                             style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm text-gray-300">
                              <span className="font-bold text-gray-500 mr-1">KR{idx + 1}</span>
                              {kr.description}
                            </span>
                            <div className="flex items-center gap-1 text-sm">
                              <input type="number"
                                     value={kr.currentValue}
                                     onChange={e => updateKRValue(okr.id, kr.id, Number(e.target.value))}
                                     className="w-14 text-right rounded px-1.5 py-0.5 text-white font-bold bg-white/5 border border-white/10 outline-none text-sm focus:border-blue-500/50"
                              />
                              <span className="text-gray-500">/</span>
                              <span className="text-gray-400">{kr.targetValue}</span>
                              {kr.unit && <span className="text-gray-500 text-xs ml-0.5">{kr.unit}</span>}
                            </div>
                          </div>
                          {renderProgressBar(krPct, 5, krPct >= 100 ? '#22c55e' : swatch)}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add review */}
                {addingReview === okr.id && (
                  <div className="px-5 pb-4">
                    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <textarea
                        value={reviewText}
                        onChange={e => setReviewText(e.target.value)}
                        placeholder="记录复盘内容：阻碍、经验、调整计划..."
                        className="w-full bg-transparent text-gray-300 text-sm outline-none resize-none min-h-[60px] placeholder-gray-600"
                      />
                      <div className="flex justify-end gap-2 mt-1">
                        <button onClick={() => { setAddingReview(null); setReviewText(''); }}
                                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1">取消</button>
                        <button onClick={() => addReview(okr.id)}
                                className="text-xs text-white px-3 py-1 rounded-lg font-medium"
                                style={{ backgroundColor: swatch }}>保存复盘</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reviews */}
                {expandedReview === okr.id && okr.reviews.length > 0 && (
                  <div className="px-5 pb-4 space-y-2">
                    {okr.reviews.map(r => (
                      <div key={r.id} className="rounded-lg px-3 py-2 text-sm"
                           style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <span className="text-gray-600 text-xs">{r.date}</span>
                        <p className="text-gray-400 mt-0.5">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* ── Dashboard ── */}
        {filteredOKRs.length > 0 && (
          <div className="rounded-2xl p-5 mt-2"
               style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h4 className="text-white font-bold text-sm mb-3">📊 周期总览</h4>
            <div className="flex items-end gap-2" style={{ height: 80 }}>
              {filteredOKRs.map(okr => {
                const pct = calcOKRProgress(okr);
                return (
                  <div key={okr.id} className="flex flex-col items-center flex-1 gap-1" title={okr.objective}>
                    <span className="text-[10px] text-gray-500">{pct}%</span>
                    <div className="w-full rounded-t-md transition-all duration-500"
                         style={{
                           height: `${Math.max(pct, 4)}%`,
                           backgroundColor: pct >= 100 ? '#22c55e' : swatch,
                           opacity: 0.8,
                           minHeight: 4,
                         }} />
                    <span className="text-[9px] text-gray-600 truncate w-full text-center">
                      O{filteredOKRs.indexOf(okr) + 1}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-500">
              <span>🟢 已完成 {stats.completed}</span>
              <span>🔵 进行中 {stats.inProgress}</span>
              <span>⚪ 未开始 {stats.notStarted}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Add/Edit OKR Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center"
             style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
             onClick={e => { if (e.target === e.currentTarget) { setShowAddModal(false); resetForm(); } }}>
          <div className="rounded-2xl w-[560px] max-h-[80vh] overflow-y-auto"
               style={{ backgroundColor: '#1a1a2e', border: `1px solid rgba(255,255,255,0.08)` }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-white font-bold text-lg">
                {editingOKR ? '编辑 OKR' : '新增 OKR'}
              </h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }}
                      className="text-gray-500 hover:text-white text-xl transition-colors">×</button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Step 1: Objective */}
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">
                  🎯 目标 (Objective)
                </label>
                <input type="text"
                       value={formO}
                       onChange={e => setFormO(e.target.value)}
                       placeholder="一句话定性描述，例：打造稳定个人现金流"
                       className="w-full bg-white/5 text-white rounded-xl px-4 py-2.5 outline-none border border-white/10 focus:border-blue-500/50 text-sm placeholder-gray-600" />
              </div>

              {/* Step 2: Key Results */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400 text-sm font-medium">
                    📊 关键结果 (Key Results)
                  </label>
                  <button
                    onClick={() => setFormKRs(prev => [...prev, { id: genId(), description: '', targetValue: 0, currentValue: 0, unit: '' }])}
                    className="text-xs px-2 py-0.5 rounded text-blue-400 hover:text-blue-300 transition-colors"
                    disabled={formKRs.length >= 4}>
                    + 添加 KR
                  </button>
                </div>
                <div className="space-y-2">
                  {formKRs.map((kr, idx) => (
                    <div key={kr.id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 font-bold w-6">KR{idx + 1}</span>
                      <input type="text"
                             value={kr.description}
                             onChange={e => setFormKRs(prev => prev.map((k, i) => i === idx ? { ...k, description: e.target.value } : k))}
                             placeholder="描述"
                             className="flex-1 bg-white/5 text-white rounded-lg px-3 py-1.5 outline-none border border-white/10 focus:border-blue-500/50 text-sm placeholder-gray-600" />
                      <input type="number"
                             value={kr.targetValue || ''}
                             onChange={e => setFormKRs(prev => prev.map((k, i) => i === idx ? { ...k, targetValue: Number(e.target.value) } : k))}
                             placeholder="目标值"
                             className="w-20 bg-white/5 text-white rounded-lg px-2 py-1.5 outline-none border border-white/10 focus:border-blue-500/50 text-sm text-center" />
                      <input type="text"
                             value={kr.unit}
                             onChange={e => setFormKRs(prev => prev.map((k, i) => i === idx ? { ...k, unit: e.target.value } : k))}
                             placeholder="单位"
                             className="w-16 bg-white/5 text-white rounded-lg px-2 py-1.5 outline-none border border-white/10 focus:border-blue-500/50 text-sm text-center" />
                      {formKRs.length > 1 && (
                        <button onClick={() => setFormKRs(prev => prev.filter((_, i) => i !== idx))}
                                className="text-gray-600 hover:text-red-400 text-sm transition-colors">×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3: Period & Dates */}
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">
                  📅 周期与时间
                </label>
                <div className="flex items-center gap-3">
                  <select value={formPeriod}
                          onChange={e => setFormPeriod(e.target.value as PeriodType)}
                          className="bg-white/5 text-white rounded-lg px-3 py-1.5 outline-none border border-white/10 text-sm cursor-pointer">
                    {(['annual', 'Q1', 'Q2', 'Q3', 'Q4'] as PeriodType[]).map(p => (
                      <option key={p} value={p} style={{ backgroundColor: '#1a1a2e' }}>
                        {p === 'annual' ? `${year}年度` : `${year} Q${p.slice(1)}`}
                      </option>
                    ))}
                  </select>
                  <input type="date"
                         value={formStartDate}
                         onChange={e => setFormStartDate(e.target.value)}
                         className="bg-white/5 text-white rounded-lg px-3 py-1.5 outline-none border border-white/10 text-sm" />
                  <span className="text-gray-600">~</span>
                  <input type="date"
                         value={formEndDate}
                         onChange={e => setFormEndDate(e.target.value)}
                         className="bg-white/5 text-white rounded-lg px-3 py-1.5 outline-none border border-white/10 text-sm" />
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowAddModal(false); resetForm(); }}
                        className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-300 text-sm transition-colors">
                  取消
                </button>
                <button onClick={saveOKR}
                        disabled={!formO.trim()}
                        className="px-6 py-2 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-40"
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
