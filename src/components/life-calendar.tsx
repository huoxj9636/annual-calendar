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

// ── Fixed 3-layer OKR data model ──
// O (Objective) → KR (Key Result) → Task
interface OKRObjective {
  id: string;
  title: string;
  period: string; // e.g. "2026" or "2026-Q1"
  children: OKRKeyResult[];
  createdAt: number;
}

interface OKRKeyResult {
  id: string;
  title: string;
  targetValue: number;
  children: OKRTask[];
  createdAt: number;
}

interface OKRTask {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
}

type PeriodType = 'annual' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Progress calculations (auto) ──
function krProgress(kr: OKRKeyResult): number {
  if (kr.children.length === 0) return 0;
  return kr.children.filter(t => t.done).length / kr.children.length;
}

function oProgress(o: OKRObjective): number {
  if (o.children.length === 0) return 0;
  return o.children.reduce((s, kr) => s + krProgress(kr), 0) / o.children.length;
}

// ── Immutably update helpers ──
function updateO(goals: OKRObjective[], oid: string, fn: (o: OKRObjective) => OKRObjective): OKRObjective[] {
  return goals.map(o => o.id === oid ? fn(o) : o);
}

function updateKR(o: OKRObjective, krid: string, fn: (kr: OKRKeyResult) => OKRKeyResult): OKRObjective {
  return { ...o, children: o.children.map(kr => kr.id === krid ? fn(kr) : kr) };
}

function updateKRInGoals(goals: OKRObjective[], oid: string, krid: string, fn: (kr: OKRKeyResult) => OKRKeyResult): OKRObjective[] {
  return updateO(goals, oid, o => updateKR(o, krid, fn));
}

// ── Migration from old GoalNode format ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateGoals(raw: any[]): OKRObjective[] {
  return raw.map((o: any) => ({
    id: o.id || genId(),
    title: o.objective || o.title || '',
    period: o.period || '',
    createdAt: o.createdAt || Date.now(),
    children: (o.keyResults || o.children || []).map((kr: any) => ({
      id: kr.id || genId(),
      title: kr.description || kr.title || '',
      targetValue: kr.targetValue || (kr.children || kr.tasks || []).length || 1,
      createdAt: kr.createdAt || Date.now(),
      children: (kr.tasks || kr.children || []).map((t: any) => ({
        id: t.id || genId(),
        title: t.title || '',
        done: t.status === 'completed' || !!t.completed || false,
        createdAt: t.createdAt || Date.now(),
      })),
    })),
  }));
}

// ── Voice Recognition Hook ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SRInstance = any;
type VoicePhase = 'idle' | 'listening' | 'recognized' | 'polishing' | 'done';

function useVoiceRecognition(onResult: (text: string) => void, context?: string) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [rawText, setRawText] = useState('');
  const [polishedText, setPolishedText] = useState('');
  const recRef = useRef<SRInstance>(null);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.continuous = false;
    rec.interimResults = true;
    setRawText('');
    setPolishedText('');
    setPhase('listening');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = async (e: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const display = final || interim;
      if (display) setRawText(display);
      if (final) {
        setPhase('recognized');
        setPhase('polishing');
        try {
          const res = await fetch('/api/polish-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: final, context }),
          });
          const data = await res.json();
          setPolishedText(data.result || final);
          onResult(data.result || final);
        } catch {
          setPolishedText(final);
          onResult(final);
        }
        setPhase('done');
        setTimeout(() => setPhase('idle'), 1200);
      }
    };
    rec.onerror = () => { setPhase('idle'); };
    rec.onend = () => { /* phase managed by onresult */ };
    recRef.current = rec;
    rec.start();
  }, [onResult, context]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setPhase('idle');
  }, []);

  return { phase, rawText, polishedText, start, stop };
}

// ── OKR Templates ──
interface OKRTemplate {
  name: string;
  desc: string;
  objectives: { title: string; krs: { title: string; target?: string }[] }[];
}

const OKR_TEMPLATES: OKRTemplate[] = [
  {
    name: '职场进阶',
    desc: '适合想要在职业上突破的职场人',
    objectives: [
      { title: '提升专业影响力', krs: [
        { title: '完成2个高质量项目交付', target: '2个' },
        { title: '在行业论坛发表3篇专业文章', target: '3篇' },
        { title: '获得1次晋升或加薪', target: '1次' },
      ]},
      { title: '构建核心技能体系', krs: [
        { title: '掌握1项新专业技能并取得认证', target: '1项' },
        { title: '每月完成1本专业书籍阅读', target: '12本' },
      ]},
    ],
  },
  {
    name: '创业启动',
    desc: '适合从0到1启动创业项目',
    objectives: [
      { title: '验证商业模式', krs: [
        { title: '完成50次用户深度访谈', target: '50次' },
        { title: '获得首批10个付费客户', target: '10个' },
        { title: 'MVP上线并收集100条用户反馈', target: '100条' },
      ]},
      { title: '搭建基础团队', krs: [
        { title: '招聘2名核心成员', target: '2人' },
        { title: '建立周例会和OKR复盘机制', target: '1套' },
      ]},
    ],
  },
  {
    name: '销售突破',
    desc: '适合需要业绩突破的销售人员',
    objectives: [
      { title: '达成年度销售目标', krs: [
        { title: '每月新增5家意向客户', target: '5家/月' },
        { title: '客户签约率达到30%', target: '30%' },
        { title: '老客户复购率达到40%', target: '40%' },
      ]},
      { title: '打造高效销售体系', krs: [
        { title: '建立标准化客户跟进流程', target: '1套' },
        { title: '完成2次客户上门演示', target: '2次' },
      ]},
    ],
  },
  {
    name: '个人成长',
    desc: '适合全面提升自我的人生规划',
    objectives: [
      { title: '优化身心健康', krs: [
        { title: '每周运动3次以上', target: '3次/周' },
        { title: '每日6:30前起床', target: '300天' },
        { title: '完成1次半程马拉松', target: '1次' },
      ]},
      { title: '持续学习成长', krs: [
        { title: '每月读2本书', target: '24本' },
        { title: '学习1项新技能并实践', target: '1项' },
      ]},
      { title: '经营重要关系', krs: [
        { title: '每周与家人深度交流1次', target: '1次/周' },
        { title: '每月组织1次朋友聚会', target: '1次/月' },
      ]},
    ],
  },
  {
    name: '技术深耕',
    desc: '适合技术人员突破技术瓶颈',
    objectives: [
      { title: '技术深度突破', krs: [
        { title: '完成1个开源项目并获50颗星', target: '50星' },
        { title: '在技术大会做1次分享', target: '1次' },
        { title: '精通1个新技术栈', target: '1个' },
      ]},
      { title: '技术影响力建设', krs: [
        { title: '发布12篇高质量技术博客', target: '12篇' },
        { title: '参与2个开源项目贡献', target: '2个' },
      ]},
    ],
  },
  {
    name: '自由职业',
    desc: '适合转向自由职业或副业变现',
    objectives: [
      { title: '建立稳定收入来源', krs: [
        { title: '获得5个长期合作客户', target: '5个' },
        { title: '月收入达到目标金额', target: '目标金额' },
      ]},
      { title: '打造个人品牌', krs: [
        { title: '社交媒体粉丝增长到5000', target: '5000' },
        { title: '发布1个付费课程或产品', target: '1个' },
      ]},
    ],
  },
];

// ── Component ──
export default function LifeCalendar({ birthYear, setBirthYear, onClose, skinKey }: LifeCalendarProps) {
  const skin = SKINS.find(s => s.key === skinKey) || SKINS[0];
  const swatch = skin.swatch || '#6558c1';
  const currentYear = new Date().getFullYear();

  const [goals, setGoals] = useState<OKRObjective[]>([]);
  const [period, setPeriod] = useState<PeriodType>(() => { const m = new Date().getMonth(); if (m < 3) return 'Q1'; if (m < 6) return 'Q2'; if (m < 9) return 'Q3'; return 'Q4'; });
  const [mounted, setMounted] = useState(false);
  const [selectedOId, setSelectedOId] = useState<string | null>(null);

  // Inline inputs
  const [newOTitle, setNewOTitle] = useState('');
  const [newKRTitle, setNewKRTitle] = useState('');
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const getTaskInput = (krid: string) => taskInputs[krid] || '';
  const setTaskInput = (krid: string, val: string) => setTaskInputs(prev => ({ ...prev, [krid]: val }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editingTargetValue, setEditingTargetValue] = useState<string | null>(null);
  const [expandedKRs, setExpandedKRs] = useState<Set<string>>(new Set());
  const toggleKRExpand = (krid: string) => setExpandedKRs(prev => { const n = new Set(prev); n.has(krid) ? n.delete(krid) : n.add(krid); return n; });

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'O' | 'KR' | 'Task'; name: string; onConfirm: () => void } | null>(null);
  const [aiDecompose, setAiDecompose] = useState<{ loading: boolean; objectiveTitle: string; result: { keyResults: { title: string; targetValue: number; tasks: string[] }[] } | null; objectiveId: string }>({ loading: false, objectiveTitle: '', result: null, objectiveId: '' });

  const year = new Date().getFullYear();
  const periodKey = period === 'annual' ? `${year}` : `${year}-${period}`;

  // Load
  useEffect(() => {
    const saved = localStorage.getItem('okr-data');
    if (saved) { try { setGoals(migrateGoals(JSON.parse(saved))); } catch { /* ignore */ } }
    setMounted(true);
  }, []);

  // Apply template
  const applyTemplate = (tpl: OKRTemplate) => {
    const uid = () => Math.random().toString(36).slice(2, 10);
    const newGoals: OKRObjective[] = tpl.objectives.map(o => ({
      id: uid(),
      title: o.title,
      period: period,
      createdAt: Date.now(),
      children: o.krs.map(kr => ({
        id: uid(),
        title: kr.title,
        targetValue: 0,
        createdAt: Date.now(),
        children: [],
      })),
    }));
    setGoals(prev => [...prev, ...newGoals]);
  };

  // Save
  useEffect(() => { if (mounted) localStorage.setItem('okr-data', JSON.stringify(goals)); }, [goals, mounted]);

  // Voice for top input
  const voiceTop = useVoiceRecognition((text) => { setNewOTitle(text); });

  // Template panel
  const [showTemplates, setShowTemplates] = useState(false);

  // Voice for KR input
  const selectedO = useMemo(() => goals.find(o => o.id === selectedOId) || null, [goals, selectedOId]);
  const voiceKR = useVoiceRecognition((text) => { setNewKRTitle(text); }, selectedO?.title);

  // Voice for Task input — activeKRId tracks which KR's input is active
  const [activeKRId, setActiveKRId] = useState<string | null>(null);
  const voiceTask = useVoiceRecognition((text) => { if (activeKRId) setTaskInput(activeKRId, text); });

  // Filter goals by current period
  const filteredGoals = useMemo(() => goals.filter(o => o.period === periodKey || !o.period), [goals, periodKey]);

  // Global stats
  const globalStats = useMemo(() => {
    let totalO = filteredGoals.length;
    let totalKR = 0, totalTask = 0, doneTask = 0;
    for (const o of filteredGoals) {
      totalKR += o.children.length;
      for (const kr of o.children) {
        totalTask += kr.children.length;
        doneTask += kr.children.filter(t => t.done).length;
      }
    }
    const avg = totalO > 0 ? Math.round(filteredGoals.reduce((s, o) => s + oProgress(o), 0) / totalO * 100) : 0;
    return { totalO, totalKR, totalTask, doneTask, avg };
  }, [filteredGoals]);

  // ── Actions ──
  const addObjective = useCallback(() => {
    if (!newOTitle.trim()) return;
    const o: OKRObjective = { id: genId(), title: newOTitle.trim(), period: periodKey, children: [], createdAt: Date.now() };
    setGoals(prev => [...prev, o]);
    setNewOTitle('');
    setSelectedOId(o.id);
  }, [newOTitle, periodKey]);

  const addKR = useCallback((oid: string) => {
    if (!newKRTitle.trim()) return;
    const kr: OKRKeyResult = { id: genId(), title: newKRTitle.trim(), targetValue: 1, children: [], createdAt: Date.now() };
    setGoals(prev => updateO(prev, oid, o => ({ ...o, children: [...o.children, kr] })));
    setNewKRTitle('');
    setExpandedKRs(prev => new Set(prev).add(kr.id));
  }, [newKRTitle]);

  const addTask = useCallback((oid: string, krid: string) => {
    const title = (taskInputs[krid] || '').trim();
    if (!title) return;
    const t: OKRTask = { id: genId(), title, done: false, createdAt: Date.now() };
    setGoals(prev => updateKRInGoals(prev, oid, krid, kr => ({ ...kr, children: [...kr.children, t] })));
    setTaskInputs(prev => { const next = { ...prev }; delete next[krid]; return next; });
  }, [taskInputs]);

  const toggleTask = useCallback((oid: string, krid: string, tid: string) => {
    setGoals(prev => updateKRInGoals(prev, oid, krid, kr => ({
      ...kr, children: kr.children.map(t => t.id === tid ? { ...t, done: !t.done } : t),
    })));
  }, []);

  const deleteObjective = useCallback((oid: string, name: string) => {
    setConfirmDelete({ type: 'O', name, onConfirm: () => {
      setGoals(prev => prev.filter(o => o.id !== oid));
      setSelectedOId(prev => prev === oid ? null : prev);
      setConfirmDelete(null);
    }});
  }, []);

  // AI decompose objective into KRs + Tasks
  const decomposeOKR = useCallback(async (oid: string) => {
    const obj = goals.find(o => o.id === oid);
    if (!obj) return;
    setAiDecompose({ loading: true, objectiveTitle: obj.title, result: null, objectiveId: oid });
    try {
      const res = await fetch('/api/ai-decompose-okr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: obj.title, period: obj.period, age: birthYear ? new Date().getFullYear() - birthYear : undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiDecompose(prev => ({ ...prev, loading: false, result: data }));
    } catch {
      setAiDecompose(prev => ({ ...prev, loading: false }));
    }
  }, [goals, birthYear]);

  // Apply AI decomposed result
  const applyDecompose = useCallback(() => {
    if (!aiDecompose.result || !aiDecompose.objectiveId) return;
    const newKRs: OKRKeyResult[] = aiDecompose.result.keyResults.map(kr => ({
      id: crypto.randomUUID(),
      title: kr.title,
      targetValue: kr.targetValue,
      createdAt: Date.now(),
      children: kr.tasks.map(t => ({
        id: crypto.randomUUID(),
        title: t,
        done: false,
        createdAt: Date.now(),
      })),
    }));
    setGoals(prev => updateO(prev, aiDecompose.objectiveId, o => ({
      ...o, children: [...o.children, ...newKRs],
    })));
    setAiDecompose({ loading: false, objectiveTitle: '', result: null, objectiveId: '' });
  }, [aiDecompose]);

  const deleteKR = useCallback((oid: string, krid: string, name: string) => {
    setConfirmDelete({ type: 'KR', name, onConfirm: () => {
      setGoals(prev => updateO(prev, oid, o => ({ ...o, children: o.children.filter(kr => kr.id !== krid) })));
      setConfirmDelete(null);
    }});
  }, []);

  const deleteTask = useCallback((oid: string, krid: string, tid: string, name: string) => {
    setConfirmDelete({ type: 'Task', name, onConfirm: () => {
      setGoals(prev => updateKRInGoals(prev, oid, krid, kr => ({ ...kr, children: kr.children.filter(t => t.id !== tid) })));
      setConfirmDelete(null);
    }});
  }, []);

  const saveTitle = useCallback((id: string) => {
    if (!editText.trim()) { setEditingId(null); return; }
    setGoals(prev => prev.map(o => {
      if (o.id === id) return { ...o, title: editText.trim() };
      return { ...o, children: o.children.map(kr => {
        if (kr.id === id) return { ...kr, title: editText.trim() };
        return { ...kr, children: kr.children.map(t => t.id === id ? { ...t, title: editText.trim() } : t) };
      })};
    }));
    setEditingId(null);
  }, [editText]);

  const saveTargetValue = useCallback((oid: string, krid: string) => {
    if (!editingTargetValue) return;
    const v = Number(editingTargetValue);
    if (isNaN(v) || v < 1) { setEditingTargetValue(null); return; }
    setGoals(prev => updateKRInGoals(prev, oid, krid, kr => ({ ...kr, targetValue: v })));
    setEditingTargetValue(null);
  }, [editingTargetValue]);

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

  // Get the currently active voice (for modal)
  const activeVoice = voiceTop.phase !== 'idle' ? voiceTop
    : voiceKR.phase !== 'idle' ? voiceKR
    : voiceTask.phase !== 'idle' ? voiceTask
    : null;

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: s.bg }}>

      {/* ══════════ LEFT PANEL ══════════ */}
      <div className="w-[480px] flex-shrink-0 flex flex-col border-r" style={{ backgroundColor: s.panelBg, borderColor: s.divider }}>

        {/* Header banner */}
        <div className="flex-shrink-0 px-5 pb-5 relative overflow-hidden" style={{ paddingTop: '1.2rem', ...(skin.headerBgImage ? { backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(135deg, ${skin.headerFrom} 0%, ${skin.headerTo} 100%)` }) }}>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${skin.sidebarFrom}cc, ${skin.sidebarTo}bb)` }} />
          <ParticleEffect color={skin.swatch} count={30} />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-wide text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>人生旅途</h2>
                <div className="flex items-center gap-2 mt-2 text-xs text-white/70">
                  <span>出生年份</span>
                  <input type="number" value={birthYear} onChange={e => setBirthYear(Number(e.target.value))}
                    className="w-16 px-1.5 py-0.5 rounded text-center text-xs border focus:outline-none bg-white/20 text-white border-white/20" />
                  <span className="text-white/40">|</span>
                  <span>当前 {currentYear - birthYear} 岁</span>
                  <button onClick={() => setShowTemplates(true)}
                    className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white/80 hover:bg-white/30 hover:text-white transition-colors border border-white/10">
                    模板
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 rounded-full overflow-hidden bg-white/15">
                    <div className="h-full rounded-full transition-all bg-white/40" style={{ width: `${Math.min(((currentYear - birthYear) / 80) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-white/60">{currentYear - birthYear}/80</span>
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

        {/* Period selector row */}
        <div className="flex-shrink-0 px-5 py-2 flex items-center gap-2 border-b" style={{ borderColor: s.divider, backgroundColor: s.cardBg }}>
          {(['annual', 'Q1', 'Q2', 'Q3', 'Q4'] as PeriodType[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{ backgroundColor: period === p ? swatch : s.panelBg, color: period === p ? '#fff' : s.text2, border: `1px solid ${period === p ? swatch : s.divider}` }}>
              {p === 'annual' ? '年度' : p}
            </button>
          ))}
        </div>

        {/* Add objective inline */}
        <div className="flex-shrink-0 px-5 py-2 flex items-center gap-2 border-b" style={{ borderColor: s.divider }}>
          <input type="text" value={newOTitle} onChange={e => setNewOTitle(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && addObjective()}
                 placeholder="输入目标，回车创建" className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                 style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
          <button onClick={voiceTop.phase !== 'idle' ? undefined : voiceTop.start}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  style={{ backgroundColor: voiceTop.phase === 'listening' ? '#ef4444' : voiceTop.phase !== 'idle' ? swatch : s.cardBg, border: `1px solid ${s.divider}`, color: voiceTop.phase !== 'idle' ? '#fff' : s.textMuted }}
                  disabled={voiceTop.phase !== 'idle'}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <button onClick={addObjective} disabled={!newOTitle.trim()} className="px-3 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-40"
                  style={{ backgroundColor: swatch }}>+ 目标</button>
        </div>

        {/* Objective list (flat, top-level only) */}
        <div className="flex-1 overflow-y-auto">
          {filteredGoals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: s.textMuted }}>
              <span className="text-4xl mb-2">🎯</span>
              <p className="text-sm">输入目标开始吧</p>
            </div>
          ) : filteredGoals.map((o, oi) => {
            const pct = Math.round(oProgress(o) * 100);
            const isSelected = selectedOId === o.id;
            return (
              <div key={o.id} onClick={() => setSelectedOId(o.id)}
                className="py-2.5 cursor-pointer transition-all border-l-[3px] flex items-center gap-2"
                style={{ paddingLeft: 16, paddingRight: 16, backgroundColor: isSelected ? s.cardHover : 'transparent', borderLeftColor: isSelected ? swatch : 'transparent' }}>
                <span className="flex-1 text-sm truncate" style={{ color: s.text1 }}><span style={{ color: swatch, fontWeight: 600 }}>O{oi + 1}：</span>{o.title}</span>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: pct > 0 ? swatch : s.textMuted }}>{pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Bottom stats */}
        <div className="flex-shrink-0 px-5 py-3 border-t flex items-center gap-4 text-xs" style={{ borderColor: s.divider, backgroundColor: s.panelBg }}>
          <span style={{ color: s.textMuted }}>目标 <b style={{ color: s.text1 }}>{globalStats.totalO}</b></span>
          <span style={{ color: s.textMuted }}>KR <b style={{ color: s.text1 }}>{globalStats.totalKR}</b></span>
          <span style={{ color: s.textMuted }}>已完成 <b style={{ color: '#22c55e' }}>{globalStats.doneTask}</b></span>
          <span style={{ color: s.textMuted }}>完成率 <b style={{ color: globalStats.avg > 0 ? swatch : s.textMuted }}>{globalStats.avg}%</b></span>
        </div>
      </div>

      {/* ══════════ RIGHT PANEL: DETAIL ══════════ */}
      <div className="flex-1 overflow-y-auto">
        {!selectedO ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: s.textMuted }}>
            <span className="text-5xl mb-3">👈</span>
            <p>选择左侧目标查看详情</p>
          </div>
        ) : (() => {
          const o = selectedO;
          const oPct = Math.round(oProgress(o) * 100);
          return (
            <div className="p-6 space-y-5">

              {/* ── O Header ── */}
              <div>
                <div className="flex items-center gap-3">
                  {editingId === o.id ? (
                    <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                           onBlur={() => saveTitle(o.id)}
                           onKeyDown={e => { if (e.key === 'Enter') saveTitle(o.id); if (e.key === 'Escape') setEditingId(null); }}
                           className="flex-1 text-lg font-bold outline-none rounded-lg px-2 py-1"
                           style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                  ) : (
                    <h2 className="flex-1 text-lg font-bold cursor-pointer hover:opacity-80" style={{ color: s.text1 }}
                        onClick={() => { setEditingId(o.id); setEditText(o.title); }}>
                      <span style={{ color: swatch }}>O{goals.findIndex(g => g.id === o.id) + 1}：</span>{o.title}
                    </h2>
                  )}
                  <span className="text-2xl font-bold flex-shrink-0" style={{ color: oPct > 0 ? swatch : s.textMuted }}>{oPct}%</span>
                  <button onClick={() => decomposeOKR(o.id)} disabled={aiDecompose.loading}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium flex-shrink-0 transition-all hover:opacity-80"
                          style={{ backgroundColor: `${swatch}18`, color: swatch, border: `1px solid ${swatch}40` }}>
                    {aiDecompose.loading && aiDecompose.objectiveId === o.id ? 'AI拆解中...' : 'AI 拆解'}
                  </button>
                  <button onClick={() => deleteObjective(o.id, o.title)}
                          className="text-xs px-2 py-1 rounded hover:opacity-70" style={{ color: '#ef4444' }}>删除</button>
                </div>
                <div className="mt-1 text-xs" style={{ color: s.textMuted }}>{o.children.length} 个关键结果</div>
              </div>

              {/* ── Add KR inline ── */}
              <div className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${s.divider}` }}>
                <span className="text-sm font-bold flex-shrink-0" style={{ color: swatch }}>+ KR</span>
                <input type="text" value={newKRTitle} onChange={e => setNewKRTitle(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && addKR(o.id)}
                       placeholder="添加关键结果..." className="flex-1 text-sm outline-none bg-transparent"
                       style={{ color: s.text1 }} />
                <button onClick={voiceKR.phase !== 'idle' ? undefined : voiceKR.start}
                        className="w-7 h-7 flex items-center justify-center rounded transition-all flex-shrink-0"
                        style={{ color: voiceKR.phase !== 'idle' ? swatch : s.textMuted }}
                        disabled={voiceKR.phase !== 'idle'}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
                {newKRTitle.trim() && (
                  <button onClick={() => addKR(o.id)} className="text-xs font-bold flex-shrink-0" style={{ color: swatch }}>添加</button>
                )}
              </div>

              {/* ── KR List ── */}
              {o.children.map((kr, kri) => {
                const krPct = Math.round(krProgress(kr) * 100);
                const isExpanded = expandedKRs.has(kr.id);
                const doneTasks = kr.children.filter(t => t.done).length;
                return (
                  <div key={kr.id} className="rounded-xl" style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                    {/* KR header */}
                    <div className="flex items-center gap-2 px-4 py-3 cursor-pointer"
                         onClick={() => toggleKRExpand(kr.id)}>
                      <span className="text-[10px] flex-shrink-0 transition-transform duration-200" style={{ color: s.textMuted, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                      {editingId === kr.id ? (
                        <input autoFocus value={editText} onClick={e => e.stopPropagation()} onChange={e => setEditText(e.target.value)}
                               onBlur={() => saveTitle(kr.id)}
                               onKeyDown={e => { if (e.key === 'Enter') saveTitle(kr.id); if (e.key === 'Escape') setEditingId(null); }}
                               className="flex-1 text-sm font-medium outline-none rounded px-1.5 py-0.5"
                               style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                      ) : (
                        <span className="flex-1 text-sm font-medium truncate" style={{ color: s.text1 }}
                              onClick={e => { e.stopPropagation(); setEditingId(kr.id); setEditText(kr.title); }}>
                          <span style={{ color: swatch, fontWeight: 600 }}>KR{kri + 1}：</span>{kr.title}
                        </span>
                      )}
                      {/* Target value */}
                      {editingTargetValue === kr.id ? (
                        <input autoFocus type="number" min={1} value={editingTargetValue}
                               onClick={e => e.stopPropagation()}
                               onChange={e => setEditingTargetValue(e.target.value)}
                               onBlur={() => saveTargetValue(o.id, kr.id)}
                               onKeyDown={e => { if (e.key === 'Enter') saveTargetValue(o.id, kr.id); if (e.key === 'Escape') setEditingTargetValue(null); }}
                               className="w-10 text-center text-xs outline-none rounded px-1 py-0.5"
                               style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                      ) : (
                        <span className="text-[10px] flex-shrink-0 cursor-pointer" style={{ color: s.textMuted }}
                              onClick={e => { e.stopPropagation(); setEditingTargetValue(kr.id); setEditingTargetValue(String(kr.targetValue)); }}>
                          目标{kr.targetValue}
                        </span>
                      )}
                      <span className="text-[10px] flex-shrink-0" style={{ color: s.textMuted }}>{doneTasks}/{kr.children.length}</span>
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: krPct > 0 ? swatch : s.textMuted }}>{krPct}%</span>
                      <button onClick={e => { e.stopPropagation(); deleteKR(o.id, kr.id, kr.title); }}
                              className="text-[10px] opacity-0 hover:!opacity-100 flex-shrink-0 transition-opacity" style={{ color: '#ef4444' }}>✕</button>
                    </div>

                    {/* KR progress bar */}
                    <div className="px-4 pb-2">
                      {pb(krPct, 4)}
                    </div>

                    {/* Expanded: Tasks */}
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-1">
                        {/* Task list */}
                        {kr.children.map(t => (
                          <div key={t.id} className="flex items-center gap-2 py-1 group"
                               style={{ borderBottom: `1px dashed ${s.divider}` }}>
                            <button onClick={() => toggleTask(o.id, kr.id, t.id)}
                                    className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                                    style={{ border: `1.5px solid ${t.done ? '#22c55e' : s.textMuted}`, backgroundColor: t.done ? '#22c55e' : 'transparent' }}>
                              {t.done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </button>
                            {editingId === t.id ? (
                              <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                                     onBlur={() => saveTitle(t.id)}
                                     onKeyDown={e => { if (e.key === 'Enter') saveTitle(t.id); if (e.key === 'Escape') setEditingId(null); }}
                                     className="flex-1 text-xs outline-none rounded px-1.5 py-0.5"
                                     style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                            ) : (
                              <span className={`flex-1 text-xs ${t.done ? 'line-through' : ''}`} style={{ color: t.done ? s.textMuted : s.text2 }}
                                    onClick={() => { setEditingId(t.id); setEditText(t.title); }}>{t.title}</span>
                            )}
                            <button onClick={() => deleteTask(o.id, kr.id, t.id, t.title)}
                                    className="text-[10px] opacity-0 group-hover:opacity-60 hover:!opacity-100 flex-shrink-0 transition-opacity" style={{ color: '#ef4444' }}>✕</button>
                          </div>
                        ))}

                        {/* Add task inline */}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] flex-shrink-0" style={{ color: swatch }}>+ 任务</span>
                          <input type="text" value={getTaskInput(kr.id)} onChange={e => setTaskInput(kr.id, e.target.value)}
                                 onFocus={() => setActiveKRId(kr.id)}
                                 onKeyDown={e => e.key === 'Enter' && addTask(o.id, kr.id)}
                                 placeholder="添加任务..." className="flex-1 text-xs outline-none bg-transparent"
                                 style={{ color: s.text1 }} />
                          <button onClick={voiceTask.phase !== 'idle' ? undefined : () => { setActiveKRId(kr.id); voiceTask.start(); }}
                                  className="flex-shrink-0 text-xs transition-colors"
                                  style={{ color: voiceTask.phase !== 'idle' ? swatch : s.textMuted }}
                                  disabled={voiceTask.phase !== 'idle'}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              <line x1="12" y1="19" x2="12" y2="23" />
                              <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                          </button>
                          {getTaskInput(kr.id).trim() && (
                            <button onClick={() => addTask(o.id, kr.id)} className="text-[10px] font-bold flex-shrink-0" style={{ color: swatch }}>添加</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          );
        })()}
      </div>

      {/* ══════════ Voice recognition modal ══════════ */}
      {activeVoice && (() => {
        const v = activeVoice;
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="rounded-2xl p-6 w-[360px] shadow-2xl" style={{ backgroundColor: s.panelBg }}>
              {/* Listening */}
              {v.phase === 'listening' && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 h-12 mb-4">
                    {[0,1,2,3,4,5,6,7,8].map(i => (
                      <div key={i} className="w-1.5 rounded-full animate-pulse" style={{
                        backgroundColor: '#ef4444',
                        height: `${16 + Math.random() * 24}px`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.6s',
                      }} />
                    ))}
                  </div>
                  <div className="text-sm font-medium mb-2" style={{ color: s.text1 }}>正在聆听...</div>
                  <div className="text-xs" style={{ color: s.textMuted }}>请说出您的目标</div>
                  {v.rawText && (
                    <div className="mt-4 rounded-lg px-3 py-2 text-sm text-left" style={{ backgroundColor: s.cardBg, color: s.text2 }}>
                      {v.rawText}<span className="animate-pulse">|</span>
                    </div>
                  )}
                  <button onClick={v.stop} className="mt-4 px-4 py-1.5 rounded-lg text-xs" style={{ backgroundColor: s.cardBg, color: s.text2, border: `1px solid ${s.divider}` }}>取消</button>
                </div>
              )}
              {/* Polishing */}
              {(v.phase === 'recognized' || v.phase === 'polishing') && (
                <div>
                  <div className="text-xs mb-2" style={{ color: s.textMuted }}>语音识别结果</div>
                  <div className="rounded-lg px-3 py-2 text-sm mb-4" style={{ backgroundColor: s.cardBg, color: s.text2 }}>
                    {v.rawText}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1" style={{ backgroundColor: s.divider }} />
                    <span className="text-xs animate-pulse" style={{ color: swatch }}>AI 润色中...</span>
                    <div className="h-px flex-1" style={{ backgroundColor: s.divider }} />
                  </div>
                  <div className="rounded-lg px-3 py-2 text-sm min-h-[40px]" style={{ backgroundColor: s.cardBg, border: `1px dashed ${swatch}`, color: s.textMuted }}>
                    {v.polishedText || '...'}
                  </div>
                </div>
              )}
              {/* Done */}
              {v.phase === 'done' && (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#10b981' }}>
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-xs mb-1" style={{ color: s.textMuted }}>原文</div>
                  <div className="rounded-lg px-3 py-1.5 text-sm mb-2 line-through" style={{ backgroundColor: s.cardBg, color: s.textMuted }}>
                    {v.rawText}
                  </div>
                  <div className="text-xs mb-1" style={{ color: swatch }}>润色结果</div>
                  <div className="rounded-lg px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${swatch}` }}>
                    {v.polishedText}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ══════════ OKR TEMPLATE PANEL ══════════ */}
      {showTemplates && (
        <div className="fixed inset-0 z-[60] flex" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="m-auto w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col" style={{ backgroundColor: s.panelBg }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: s.divider }}>
              <h3 className="text-lg font-bold" style={{ color: s.text1 }}>OKR 模板库</h3>
              <button onClick={() => setShowTemplates(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:opacity-80" style={{ backgroundColor: s.cardBg, color: s.text2 }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Templates */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {OKR_TEMPLATES.map((tpl, ti) => (
                <div key={ti} className="rounded-xl p-4" style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-bold" style={{ color: s.text1 }}>{tpl.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: s.textMuted }}>{tpl.desc}</div>
                    </div>
                    <button onClick={() => { applyTemplate(tpl); setShowTemplates(false); }}
                      className="px-3 py-1 rounded-lg text-xs font-medium shrink-0 ml-3" style={{ backgroundColor: swatch, color: '#fff' }}>
                      应用
                    </button>
                  </div>
                  <div className="space-y-1.5 mt-3">
                    {tpl.objectives.map((o, oi) => (
                      <div key={oi} className="text-xs" style={{ color: s.text2 }}>
                        <span className="font-medium" style={{ color: swatch }}>O{oi + 1}</span>：{o.title}
                        {o.krs.map((kr, ki) => (
                          <div key={ki} className="ml-4" style={{ color: s.textMuted }}>
                            <span style={{ color: swatch }}>KR{ki + 1}</span>：{kr.title}{kr.target ? `（目标：${kr.target}）` : ''}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Delete confirmation ══════════ */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-[340px] shadow-2xl" style={{ backgroundColor: s.panelBg }}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#fef2f2' }}>
                <svg className="w-6 h-6" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="text-base font-bold mb-1" style={{ color: s.text1 }}>确认删除？</div>
              <div className="text-sm" style={{ color: s.textMuted }}>
                {confirmDelete.type === 'O' && '将删除目标及其所有KR和任务'}
                {confirmDelete.type === 'KR' && '将删除该关键结果及其所有任务'}
                {confirmDelete.type === 'Task' && '将删除该任务'}
              </div>
              <div className="mt-2 text-sm font-medium truncate px-4" style={{ color: s.text1 }}>
                「{confirmDelete.name}」
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: s.cardBg, color: s.text2 }}>
                取消
              </button>
              <button onClick={confirmDelete.onConfirm}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#ef4444' }}>
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ AI Decompose Modal ══════════ */}
      {(aiDecompose.loading || aiDecompose.result) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col" style={{ backgroundColor: s.panelBg }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: s.divider }}>
              <div>
                <h3 className="text-lg font-bold" style={{ color: s.text1 }}>AI 拆解目标</h3>
                <div className="text-xs mt-0.5 truncate max-w-[400px]" style={{ color: s.textMuted }}>
                  {aiDecompose.objectiveTitle}
                </div>
              </div>
              <button onClick={() => setAiDecompose({ loading: false, objectiveTitle: '', result: null, objectiveId: '' })}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:opacity-80" style={{ backgroundColor: s.cardBg, color: s.text2 }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {aiDecompose.loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${swatch}40`, borderTopColor: swatch }} />
                </div>
                <div className="text-base font-medium" style={{ color: s.text1 }}>AI 正在拆解目标...</div>
                <div className="text-xs mt-1" style={{ color: s.textMuted }}>生成关键结果和可执行任务</div>
              </div>
            ) : aiDecompose.result ? (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {aiDecompose.result.keyResults.map((kr, ki) => (
                    <div key={ki} className="rounded-xl p-4" style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold shrink-0 mt-0.5" style={{ color: swatch }}>KR{ki + 1}</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium" style={{ color: s.text1 }}>{kr.title}</div>
                          <div className="text-xs mt-0.5" style={{ color: s.textMuted }}>目标值：{kr.targetValue}</div>
                          {kr.tasks.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {kr.tasks.map((t, ti) => (
                                <div key={ti} className="text-xs flex items-center gap-1.5" style={{ color: s.text2 }}>
                                  <span style={{ color: s.textMuted }}>•</span>{t}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: s.divider }}>
                  <button onClick={() => setAiDecompose({ loading: false, objectiveTitle: '', result: null, objectiveId: '' })}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: s.cardBg, color: s.text2 }}>
                    取消
                  </button>
                  <button onClick={applyDecompose}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: swatch }}>
                    确认添加
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
