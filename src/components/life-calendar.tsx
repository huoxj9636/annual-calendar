'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SkinTheme } from '@/lib/skins';

// ═══════════════ Types ═══════════════
type OKRStatus = 'active' | 'completed' | 'abandoned' | 'delayed';

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
  content: string;
  createdAt: number;
}

interface OKR {
  id: string;
  objective: string;
  status: OKRStatus;
  keyResults: KeyResult[];
  reviews: OKRReview[];
  createdAt: number;
}

interface EpitaphData {
  oneLiner: string;
  evaluation: { career: string; character: string; relationship: string };
  works: [string, string, string];
  dimensions: Record<string, string>;
}

// ═══════════════ Constants ═══════════════
const STORAGE_KEY = 'okr-data';
const EPITAPH_KEY = 'epitaph-data';
const ANIM_SEEN_KEY = 'epitaph-anim-seen';

const STATUS_CFG: Record<OKRStatus, { label: string; color: string }> = {
  active: { label: '进行中', color: '#3b82f6' },
  completed: { label: '已完成', color: '#22c55e' },
  abandoned: { label: '已放弃', color: '#9ca3af' },
  delayed: { label: '已延期', color: '#f59e0b' },
};

const CYCLES = ['年度', 'Q1', 'Q2', 'Q3', 'Q4'] as const;

const EPITAPH_REFS: { type: string; epitaph: string; summary: string }[] = [
  { type: '实干成就', epitaph: '他建造了不倒的大厦', summary: '一生致力于创造持久价值，用实干证明了自己的存在' },
  { type: '实干成就', epitaph: '她让荒漠变成了绿洲', summary: '从无到有，用双手改变现实' },
  { type: '学术探索', epitaph: '他追问了世界的本源', summary: '为真理执着一生，留下了深邃的思想遗产' },
  { type: '学术探索', epitaph: '她照亮了未知的领域', summary: '在知识的边界上开疆拓土' },
  { type: '家庭温暖', epitaph: '他让每个家人都感到安心', summary: '平凡却伟大，用温暖撑起了一片天' },
  { type: '家庭温暖', epitaph: '她的餐桌永远为你留着位置', summary: '用最朴素的爱，编织了最坚实的纽带' },
  { type: '自由行者', epitaph: '他走过的路比任何人都要远', summary: '不羁的灵魂，用脚步丈量了世界的宽度' },
  { type: '自由行者', epitaph: '她活在每一刻的热爱里', summary: '拒绝平庸，活出了自己定义的人生' },
  { type: '商业创造', epitaph: '他改变了千万人的生活方式', summary: '从洞察到行动，创造商业价值也创造社会价值' },
  { type: '商业创造', epitaph: '她证明了商业可以既有利润又有温度', summary: '在利益与理想之间找到了平衡' },
  { type: '碌碌无为', epitaph: '这里躺着一个从未真正活过的人', summary: '一生随波逐流，从未为自己做出过选择' },
  { type: '碌碌无为', epitaph: '他总是说明天开始', summary: '永远在等待，却从未出发' },
];

const DIMENSIONS = ['事业价值', '财富自由', '健康精力', '亲密关系', '自我成长'];

const ANIM_STEPS = [
  { text: '你出生了，世界没有问你愿不愿意', delay: 0 },
  { text: '上学，因为大家都上学', delay: 3000 },
  { text: '毕业，找了份还算稳定的工作', delay: 6000 },
  { text: '每天为生存奔波，却说不清为了什么', delay: 9000 },
  { text: '被生活推着走，来不及停下来想一想', delay: 12000 },
  { text: '中年了，一切好像都定了，又好像什么都没定', delay: 15000 },
  { text: '回首来路，满是不甘和遗憾', delay: 18000 },
  { text: '最后，墓碑上什么也没写', delay: 21000 },
  { text: '如果这是你的结局——你甘心吗？', delay: 24000 },
];

// ═══════════════ Utils ═══════════════
const uid = () => Math.random().toString(36).slice(2, 9);

function loadOKRs(cycle: string): OKR[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(`${STORAGE_KEY}-${cycle}`) || '[]') as OKR[]; }
  catch { return []; }
}
function saveOKRs(cycle: string, data: OKR[]) {
  localStorage.setItem(`${STORAGE_KEY}-${cycle}`, JSON.stringify(data));
}
function loadEpitaph(): EpitaphData | null {
  if (typeof window === 'undefined') return null;
  try { const d = localStorage.getItem(EPITAPH_KEY); return d ? JSON.parse(d) : null; }
  catch { return null; }
}
function saveEpitaph(d: EpitaphData) { localStorage.setItem(EPITAPH_KEY, JSON.stringify(d)); }

function tomatoStatsFor(okr: OKR) {
  let total = 0, done = 0;
  for (const kr of okr.keyResults) {
    for (const t of kr.tasks) {
      total += t.estimatedTomatoes;
      done += t.tomatoes.filter((tm: TomatoItem) => tm.completed).length;
    }
  }
  return { total, done, pct: total > 0 ? Math.round(done / total * 100) : 0 };
}

function cycleOkrs(cycle: string): OKR[] {
  return (loadOKRs(cycle) as OKR[]).map((o) => ({
    ...o,
    status: (o.status || 'active') as OKRStatus,
    keyResults: Array.isArray(o.keyResults) ? o.keyResults.map((kr) => ({
      ...kr,
      tasks: Array.isArray(kr.tasks) ? kr.tasks.map((t) => ({
        ...t,
        estimatedTomatoes: Number(t.estimatedTomatoes || 1),
        tomatoes: Array.isArray(t.tomatoes) ? t.tomatoes.map((tm) => ({
          ...tm,
          completed: Boolean(tm.completed),
        })) : [],
      })) : [],
    })) : [],
    reviews: Array.isArray(o.reviews) ? o.reviews : [],
  }));
}

// ═══════════════ Component ═══════════════
export default function LifeCalendar({ skin, onClose }: { skin: SkinTheme; onClose: () => void }) {
  // Alias skin properties for convenient access in JSX
  const c = {
    bodyBg: skin.bodyBg, panelBg: skin.panelBg, cardBg: skin.cardBg, cardHover: skin.cardHover,
    text1: skin.textPrimary, text2: skin.textSecondary, text3: skin.textMuted,
    divider: skin.divider, progressTrack: skin.progressTrack, progressFill: skin.progressFill,
    swatch: skin.swatch, headerFrom: skin.headerFrom, headerTo: skin.headerTo,
  };
  const swatch = skin.swatch;
  const [mounted, setMounted] = useState(false);
  const [cycle, setCycle] = useState<string>('年度');
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [epitaph, setEpitaph] = useState<EpitaphData | null>(null);
  const [showEpitaphOverlay, setShowEpitaphOverlay] = useState(false);
  const [showAnim, setShowAnim] = useState(false);
  const [animStep, setAnimStep] = useState(-1);
  const [newOkr, setNewOkr] = useState('');
  const [expandedKR, setExpandedKR] = useState<Set<string>>(new Set());
  const [expandedTask, setExpandedTask] = useState<Set<string>>(new Set());
  const [epitaphTab, setEpitaphTab] = useState<'refs' | 'write' | 'deduce'>('write');
  const [epitaphFilter, setEpitaphFilter] = useState('all');
  const [editingOkr, setEditingOkr] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingKr, setEditingKr] = useState<string | null>(null);
  const [editKrDesc, setEditKrDesc] = useState('');
  const [newKr, setNewKr] = useState<Record<string, string>>({});
  const [newTask, setNewTask] = useState<Record<string, string>>({});
  const [newTomato, setNewTomato] = useState<Record<string, string>>({});
  const [taskEst, setTaskEst] = useState<Record<string, string>>({});
  const [reviewText, setReviewText] = useState<Record<string, string>>({});
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerCtx, setTimerCtx] = useState<{ okrId: string; krId: string; taskId: string; tomatoId: string; labels: string[] } | null>(null);
  const [timerNote, setTimerNote] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dailyTarget, setDailyTarget] = useState(8);
  const [dailyDone, setDailyDone] = useState(0);
  const [dailyInterrupts, setDailyInterrupts] = useState(0);
  const [epitaphForm, setEpitaphForm] = useState<EpitaphData>({
    oneLiner: '', evaluation: { career: '', character: '', relationship: '' },
    works: ['', '', ''], dimensions: {},
  });

  // Mount
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    setOkrs(cycleOkrs(cycle));
    setEpitaph(loadEpitaph());
    const seen = localStorage.getItem(ANIM_SEEN_KEY);
    if (!seen) { setShowAnim(true); setAnimStep(0); }
    const dt = localStorage.getItem('tomato-daily-target');
    if (dt) setDailyTarget(Number(dt));
  }, [mounted]);
  useEffect(() => {
    if (!mounted) return;
    setOkrs(cycleOkrs(cycle));
  }, [cycle, mounted]);
  useEffect(() => {
    if (!mounted || okrs.length === 0) return;
    saveOKRs(cycle, okrs);
  }, [okrs, cycle, mounted]);
  useEffect(() => {
    if (mounted) localStorage.setItem('tomato-daily-target', String(dailyTarget));
  }, [dailyTarget, mounted]);

  // Animation
  useEffect(() => {
    if (animStep < 0 || animStep >= ANIM_STEPS.length) return;
    const t = setTimeout(() => setAnimStep(animStep + 1), 3000);
    return () => clearTimeout(t);
  }, [animStep]);

  // Timer
  useEffect(() => {
    if (!timerActive || timerPaused) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimerActive(false);
          // Mark tomato complete
          if (timerCtx) {
            setOkrs(prev => prev.map(o => {
              if (o.id !== timerCtx.okrId) return o;
              return { ...o, keyResults: o.keyResults.map(kr => {
                if (kr.id !== timerCtx.krId) return kr;
                return { ...kr, tasks: kr.tasks.map(t => {
                  if (t.id !== timerCtx.taskId) return t;
                  return { ...t, tomatoes: t.tomatoes.map(tm => {
                    if (tm.id !== timerCtx.tomatoId) return tm;
                    return { ...tm, completed: true, completedAt: Date.now() };
                  })};
                })};
              })};
            }));
            setDailyDone(d => d + 1);
          }
          try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH+Jj4+FfHJ1fIeNkI6GfXR1fYiOkI2Fe3J0fIiOkI2Fe3J0fA==').play(); } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, timerPaused, timerCtx]);

  // ═══════ Actions ═══════
  const addOKR = useCallback(() => {
    if (!newOkr.trim()) return;
    setOkrs(prev => [...prev, { id: uid(), objective: newOkr.trim(), status: 'active', keyResults: [], reviews: [], createdAt: Date.now() }]);
    setNewOkr('');
  }, [newOkr]);

  const cycleStatus = useCallback((okrId: string) => {
    const order: OKRStatus[] = ['active', 'completed', 'abandoned', 'delayed'];
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, status: order[(order.indexOf(o.status) + 1) % 4] } : o));
  }, []);

  const deleteOKR = useCallback((okrId: string) => {
    setOkrs(prev => prev.filter(o => o.id !== okrId));
  }, []);

  const saveEditTitle = useCallback((okrId: string) => {
    if (!editTitle.trim()) return;
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, objective: editTitle.trim() } : o));
    setEditingOkr(null);
  }, [editTitle]);

  const addKR = useCallback((okrId: string) => {
    const desc = newKr[okrId]?.trim();
    if (!desc) return;
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, keyResults: [...o.keyResults, { id: uid(), description: desc, tasks: [] }] } : o));
    setNewKr(prev => ({ ...prev, [okrId]: '' }));
  }, [newKr]);

  const saveEditKr = useCallback((krId: string, okrId: string) => {
    if (!editKrDesc.trim()) return;
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, description: editKrDesc.trim() } : kr) } : o));
    setEditingKr(null);
  }, [editKrDesc]);

  const addTask = useCallback((okrId: string, krId: string) => {
    const title = newTask[krId]?.trim();
    if (!title) return;
    const est = Number(taskEst[krId] || 1);
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, tasks: [...kr.tasks, { id: uid(), title, estimatedTomatoes: est, tomatoes: [] }] } : kr) } : o));
    setNewTask(prev => ({ ...prev, [krId]: '' }));
    setTaskEst(prev => ({ ...prev, [krId]: '' }));
  }, [newTask, taskEst]);

  const addTomato = useCallback((okrId: string, krId: string, taskId: string) => {
    const title = newTomato[taskId]?.trim();
    if (!title) return;
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, tasks: kr.tasks.map(t => t.id === taskId ? { ...t, tomatoes: [...t.tomatoes, { id: uid(), title, completed: false }] } : t) } : kr) } : o));
    setNewTomato(prev => ({ ...prev, [taskId]: '' }));
  }, [newTomato]);

  const startTomato = useCallback((okr: OKR, kr: KeyResult, task: Task, tm: TomatoItem) => {
    setTimerCtx({ okrId: okr.id, krId: kr.id, taskId: task.id, tomatoId: tm.id, labels: [okr.objective, kr.description, task.title, tm.title] });
    setTimerSeconds(25 * 60);
    setTimerPaused(false);
    setTimerActive(true);
    setTimerNote('');
  }, []);

  const toggleTomato = useCallback((okrId: string, krId: string, taskId: string, tomatoId: string) => {
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, tasks: kr.tasks.map(t => t.id === taskId ? { ...t, tomatoes: t.tomatoes.map(tm => tm.id === tomatoId ? { ...tm, completed: !tm.completed, completedAt: tm.completed ? undefined : Date.now() } : tm) } : t) } : kr) } : o));
  }, []);

  const deleteTomato = useCallback((okrId: string, krId: string, taskId: string, tomatoId: string) => {
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, tasks: kr.tasks.map(t => t.id === taskId ? { ...t, tomatoes: t.tomatoes.filter(tm => tm.id !== tomatoId) } : t) } : kr) } : o));
  }, []);

  const addReview = useCallback((okrId: string) => {
    const text = reviewText[okrId]?.trim();
    if (!text) return;
    setOkrs(prev => prev.map(o => o.id === okrId ? { ...o, reviews: [...o.reviews, { id: uid(), content: text, createdAt: Date.now() }] } : o));
    setReviewText(prev => ({ ...prev, [okrId]: '' }));
  }, [reviewText]);

  const toggleKR = (id: string) => setExpandedKR(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTask = (id: string) => setExpandedTask(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Generate OKRs from epitaph dimensions
  const generateFromEpitaph = useCallback(() => {
    if (!epitaph) return;
    const newOkrs: OKR[] = DIMENSIONS.filter(d => epitaph.dimensions[d]?.trim()).map(d => ({
      id: uid(), objective: epitaph.dimensions[d], status: 'active' as OKRStatus, keyResults: [], reviews: [], createdAt: Date.now(),
    }));
    setOkrs(prev => [...prev, ...newOkrs]);
    setShowEpitaphOverlay(false);
  }, [epitaph]);

  // Save epitaph
  const saveEpitaphForm = useCallback(() => {
    saveEpitaph(epitaphForm);
    setEpitaph(epitaphForm);
    setShowEpitaphOverlay(false);
  }, [epitaphForm]);

  // Global stats
  const globalStats = okrs.reduce((acc: { totalOkrs: number; totalEst: number; totalDone: number }, o: OKR) => {
    const ts = tomatoStatsFor(o);
    return { totalOkrs: acc.totalOkrs + 1, totalEst: acc.totalEst + ts.total, totalDone: acc.totalDone + ts.done };
  }, { totalOkrs: 0, totalEst: 0, totalDone: 0 });
  const globalPct = globalStats.totalEst > 0 ? Math.round(globalStats.totalDone / globalStats.totalEst * 100) : 0;

  if (!mounted) return null;

  // ═══════════════ Render ═══════════════
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: c.bodyBg }}>
      {/* ═══ Life Animation Overlay ═══ */}
      {showAnim && animStep < ANIM_STEPS.length && (
        <div className="fixed inset-0 z-[60] flex" style={{ background: '#000' }}>
          {/* Left: Text */}
          <div className="w-1/2 flex flex-col justify-center items-end pr-12">
            {ANIM_STEPS.slice(0, animStep + 1).map((step, i) => (
              <div key={i} className="mb-6 max-w-md text-right transition-opacity duration-1000"
                style={{ opacity: i < animStep ? 0.3 : 1, color: i === ANIM_STEPS.length - 1 && animStep === ANIM_STEPS.length - 1 ? '#ef4444' : '#fff', fontSize: i === animStep ? '1.25rem' : '1rem', fontWeight: i === animStep ? 600 : 400 }}>
                {step.text}
              </div>
            ))}
          </div>
          {/* Right: Ladder & light */}
          <div className="w-1/2 relative">
            {/* Light hole */}
            <div className="absolute top-8 right-12 w-24 h-24 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(135,206,235,0.8) 0%, rgba(135,206,235,0.3) 40%, transparent 70%)' }} />
            {/* Ladder */}
            <div className="absolute top-28 right-[5.5rem] w-8" style={{ height: '70vh' }}>
              <div className="absolute inset-0" style={{ borderLeft: '3px solid rgba(139,119,101,0.6)', borderRight: '3px solid rgba(139,119,101,0.6)' }} />
              {[...Array(14)].map((_, i) => (
                <div key={i} className="absolute w-full" style={{ top: `${i * 7 + 3}%`, height: 2, background: `rgba(139,119,101,${0.7 - i * 0.04})` }} />
              ))}
            </div>
            {/* Light beam */}
            <div className="absolute top-32 right-16 w-32 opacity-20"
              style={{ height: '60vh', background: 'linear-gradient(to bottom, rgba(135,206,235,0.3), transparent)' }} />
          </div>
          {/* Skip button */}
          <button onClick={() => { setShowAnim(false); localStorage.setItem(ANIM_SEEN_KEY, '1'); }}
            className="absolute bottom-8 right-8 text-white/40 hover:text-white/70 text-sm">跳过 →</button>
          {/* Final CTA */}
          {animStep >= ANIM_STEPS.length && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.9)' }}>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-6">如果这是你的结局——你甘心吗？</div>
                <button onClick={() => { setShowAnim(false); localStorage.setItem(ANIM_SEEN_KEY, '1'); setShowEpitaphOverlay(true); }}
                  className="px-8 py-3 rounded-lg text-white font-semibold" style={{ background: '#ef4444' }}>
                  我不甘心，我要改变
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Epitaph Overlay ═══ */}
      {showEpitaphOverlay && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.95)' }}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-8" style={{ background: '#111', color: '#e5e5e5' }}>
            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-white/10 pb-3">
              {(['refs', 'write', 'deduce'] as const).map(tab => (
                <button key={tab} onClick={() => setEpitaphTab(tab)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: epitaphTab === tab ? '#fff' : 'transparent', color: epitaphTab === tab ? '#000' : '#999' }}>
                  {tab === 'refs' ? '参考库' : tab === 'write' ? '我的墓志铭' : '终局倒推'}
                </button>
              ))}
              <div className="flex-1" />
              <button onClick={() => setShowEpitaphOverlay(false)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>

            {/* Refs Tab */}
            {epitaphTab === 'refs' && (
              <div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['all', ...new Set(EPITAPH_REFS.map(r => r.type))].map(type => (
                    <button key={type} onClick={() => setEpitaphFilter(type)}
                      className="px-3 py-1 rounded-full text-xs"
                      style={{ background: epitaphFilter === type ? '#fff' : '#333', color: epitaphFilter === type ? '#000' : '#aaa' }}>
                      {type === 'all' ? '全部' : type}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  {EPITAPH_REFS.filter(r => epitaphFilter === 'all' || r.type === epitaphFilter).map((r, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ background: '#1a1a1a', borderLeft: '3px solid #555' }}>
                      <div className="text-xs mb-1" style={{ color: '#888' }}>{r.type}</div>
                      <div className="font-semibold mb-1" style={{ color: '#e5e5e5' }}>&ldquo;{r.epitaph}&rdquo;</div>
                      <div className="text-sm" style={{ color: '#999' }}>{r.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Write Tab */}
            {epitaphTab === 'write' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ccc' }}>我的墓志铭一句话</label>
                  <input value={epitaphForm.oneLiner} onChange={e => setEpitaphForm(prev => ({ ...prev, oneLiner: e.target.value }))}
                    placeholder="例如：成为一个创造价值、内心坚定、留下成果的实干者"
                    className="w-full px-4 py-3 rounded-lg text-white placeholder:text-white/30 outline-none"
                    style={{ background: '#1a1a1a', border: '1px solid #333' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ccc' }}>别人如何评价我</label>
                  {(['career', 'character', 'relationship'] as const).map((key, i) => (
                    <input key={key} value={epitaphForm.evaluation[key]} onChange={e => setEpitaphForm(prev => ({ ...prev, evaluation: { ...prev.evaluation, [key]: e.target.value } }))}
                      placeholder={['事业：他创造了不可替代的价值', '品格：他是一个言出必行的人', '关系：他让身边的人都变得更好'][i]}
                      className="w-full px-4 py-2 rounded-lg text-white placeholder:text-white/20 outline-none mb-2 text-sm"
                      style={{ background: '#1a1a1a', border: '1px solid #333' }} />
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ccc' }}>最想留下的 3 件作品/成果</label>
                  {([0, 1, 2] as const).map(i => (
                    <input key={i} value={epitaphForm.works[i]} onChange={e => setEpitaphForm(prev => ({ ...prev, works: prev.works.map((w, j) => j === i ? e.target.value : w) as [string, string, string] }))}
                      placeholder={`${i + 1}. `}
                      className="w-full px-4 py-2 rounded-lg text-white placeholder:text-white/20 outline-none mb-2 text-sm"
                      style={{ background: '#1a1a1a', border: '1px solid #333' }} />
                  ))}
                </div>
                <button onClick={saveEpitaphForm} className="w-full py-3 rounded-lg font-semibold text-black" style={{ background: '#fff' }}>
                  保存墓志铭
                </button>
              </div>
            )}

            {/* Deduce Tab */}
            {epitaphTab === 'deduce' && (
              <div className="space-y-4">
                <div className="text-sm" style={{ color: '#888' }}>从墓志铭拆解人生维度，反向生成OKR</div>
                <button onClick={() => {
                  if (!epitaph) return;
                  const works = epitaph.works.filter(w => w.trim());
                  setEpitaphForm(prev => ({
                    ...prev,
                    dimensions: DIMENSIONS.reduce((acc: Record<string, string>, d: string, i: number) => {
                      acc[d] = works[i] || epitaph.oneLiner;
                      return acc;
                    }, {}),
                  }));
                }} className="px-4 py-2 rounded-lg text-sm" style={{ background: '#333', color: '#fff' }}>
                  ⚡ 自动从墓志铭拆解到五大维度
                </button>
                {DIMENSIONS.map(d => (
                  <div key={d}>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#888' }}>{d}</label>
                    <input value={epitaphForm.dimensions[d] || ''} onChange={e => setEpitaphForm(prev => ({ ...prev, dimensions: { ...prev.dimensions, [d]: e.target.value } }))}
                      placeholder={`${d}的目标…`}
                      className="w-full px-3 py-2 rounded-lg text-white text-sm placeholder:text-white/20 outline-none"
                      style={{ background: '#1a1a1a', border: '1px solid #333' }} />
                  </div>
                ))}
                <button onClick={generateFromEpitaph} className="w-full py-3 rounded-lg font-semibold text-black" style={{ background: '#22c55e' }}>
                  生成 OKR →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Timer Modal ═══ */}
      {timerActive && timerCtx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="text-center">
            <div className="text-xs mb-4 max-w-[300px] truncate mx-auto" style={{ color: '#888' }}>
              {timerCtx.labels.join(' → ')}
            </div>
            <div className="text-6xl font-bold mb-2 tabular-nums" style={{ color: timerPaused ? '#666' : '#fff' }}>
              {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
            </div>
            <div className="text-sm mb-6" style={{ color: '#888' }}>{timerPaused ? '已暂停' : '专注中'}</div>
            <div className="flex gap-3 justify-center mb-6">
              <button onClick={() => setTimerPaused(p => !p)}
                className="px-6 py-2 rounded-lg font-medium" style={{ background: '#f59e0b', color: '#fff' }}>
                {timerPaused ? '继续' : '暂停'}
              </button>
              <button onClick={() => { setTimerActive(false); setDailyInterrupts(d => d + 1); }}
                className="px-6 py-2 rounded-lg font-medium" style={{ background: '#ef4444', color: '#fff' }}>
                放弃本次番茄
              </button>
            </div>
            <input value={timerNote} onChange={e => setTimerNote(e.target.value)}
              placeholder="记录本次番茄的卡点…"
              className="w-64 px-3 py-2 rounded-lg text-sm text-white placeholder:text-white/30 outline-none mx-auto block"
              style={{ background: '#222', border: '1px solid #444' }} />
          </div>
        </div>
      )}

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 py-3 shrink-0 flex-wrap" style={{ background: c.panelBg, borderBottom: `1px solid ${c.divider}` }}>
          <select value={cycle} onChange={e => setCycle(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none" style={{ background: c.cardBg, color: c.text1, border: `1px solid ${c.divider}` }}>
            {CYCLES.map(c => <option key={c} value={c}>{new Date().getFullYear()} {c}</option>)}
          </select>
          <div className="flex gap-4 text-xs" style={{ color: c.text2 }}>
            <span>总OKR <b style={{ color: swatch }}>{globalStats.totalOkrs}</b></span>
            <span>总预估 🍅 <b style={{ color: swatch }}>{globalStats.totalEst}</b></span>
            <span>已完成 🍅 <b style={{ color: swatch }}>{globalStats.totalDone}</b></span>
            <span>整体进度 <b style={{ color: swatch }}>{globalPct}%</b></span>
          </div>
          <div className="flex-1" />
          <button onClick={() => setShowEpitaphOverlay(true)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium" style={{ background: '#111', color: '#e5e5e5' }}>
            终局·墓志铭
          </button>
          <button onClick={addOKR} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: swatch }}>
            + 新增OKR
          </button>
          <button onClick={onClose} className="ml-2 text-lg" style={{ color: c.text2 }}>✕</button>
        </div>

        {/* Epitaph banner */}
        {epitaph?.oneLiner && (
          <div className="px-6 py-2 text-sm" style={{ background: '#000', color: '#e5e5e5' }}>
            我的墓志铭：<span className="font-semibold" style={{ color: '#fff' }}>{epitaph.oneLiner}</span>
          </div>
        )}

        {/* New OKR inline input */}
        <div className="px-6 py-2 shrink-0" style={{ background: c.bodyBg }}>
          <div className="flex gap-2">
            <input value={newOkr} onChange={e => setNewOkr(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addOKR()}
              placeholder="输入目标，回车创建…"
              className="flex-1 px-4 py-2 rounded-lg text-sm outline-none"
              style={{ background: c.cardBg, color: c.text1, border: `1px solid ${c.divider}` }} />
          </div>
        </div>

        {/* OKR Card List */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4" style={{ background: c.bodyBg }}>
          {okrs.length === 0 && (
            <div className="text-center py-16" style={{ color: c.text3 }}>
              <div className="text-lg mb-2">还没有目标</div>
              <div className="text-sm">输入目标回车创建，或从<span className="cursor-pointer underline" style={{ color: swatch }} onClick={() => setShowEpitaphOverlay(true)}>墓志铭生成</span></div>
            </div>
          )}

          {okrs.map(okr => {
            const stats = tomatoStatsFor(okr);
            const scfg = STATUS_CFG[okr.status];
            return (
              <div key={okr.id} className="rounded-xl overflow-hidden" style={{ background: c.cardBg, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {/* O Header */}
                <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${c.divider}` }}>
                  <button onClick={() => cycleStatus(okr.id)} className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ background: scfg.color + '20', color: scfg.color }}>
                    {scfg.label}
                  </button>
                  <div className="flex-1 min-w-0">
                    {editingOkr === okr.id ? (
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEditTitle(okr.id)}
                        onBlur={() => saveEditTitle(okr.id)}
                        className="w-full px-2 py-0.5 rounded text-sm outline-none"
                        style={{ background: c.bodyBg, color: c.text1 }} autoFocus />
                    ) : (
                      <span className="font-semibold text-sm cursor-pointer" style={{ color: c.text1 }}
                        onClick={() => { setEditingOkr(okr.id); setEditTitle(okr.objective); }}>
                        O: {okr.objective}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold shrink-0" style={{ color: swatch }}>{stats.pct}%</span>
                  <span className="text-xs shrink-0" style={{ color: c.text3 }}>🍅{stats.done}/{stats.total}</span>
                  <button onClick={() => deleteOKR(okr.id)} className="text-xs px-2 shrink-0" style={{ color: c.text3 }}>🗑</button>
                </div>

                {/* KR List */}
                <div className="px-5 py-3 space-y-3">
                  {okr.keyResults.map((kr, krIdx) => {
                    const krTotal = kr.tasks.reduce((a: number, t: Task) => a + t.estimatedTomatoes, 0);
                    const krDone = kr.tasks.reduce((a: number, t: Task) => a + t.tomatoes.filter((tm: TomatoItem) => tm.completed).length, 0);
                    const krPct = krTotal > 0 ? Math.round(krDone / krTotal * 100) : 0;
                    const isKROpen = expandedKR.has(kr.id);
                    return (
                      <div key={kr.id} className="border-l-3 pl-3" style={{ borderLeftColor: c.text3 }}>
                        {/* KR Header */}
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleKR(kr.id)}>
                          <span className="text-xs" style={{ color: c.text3 }}>{isKROpen ? '▾' : '▸'}</span>
                          {editingKr === kr.id ? (
                            <input value={editKrDesc} onChange={e => setEditKrDesc(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEditKr(kr.id, okr.id); }}
                              onBlur={() => saveEditKr(kr.id, okr.id)}
                              className="flex-1 px-2 py-0.5 rounded text-xs outline-none"
                              style={{ background: c.bodyBg, color: c.text1 }} autoFocus onClick={e => e.stopPropagation()} />
                          ) : (
                            <span className="text-xs font-medium flex-1" style={{ color: c.text2 }}
                              onClick={e => { e.stopPropagation(); setEditingKr(kr.id); setEditKrDesc(kr.description); }}>
                              KR{krIdx + 1}: {kr.description}
                            </span>
                          )}
                          <span className="text-xs shrink-0" style={{ color: c.text3 }}>
                            进度{krPct}% | 总🍅{krTotal} / 已完成{krDone}
                          </span>
                        </div>

                        {/* KR Progress bar */}
                        <div className="mt-1 h-1 rounded-full" style={{ background: c.progressTrack }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${krPct}%`, background: swatch }} />
                        </div>

                        {/* Tasks */}
                        {isKROpen && (
                          <div className="mt-2 space-y-2 ml-4">
                            {kr.tasks.map(task => {
                              const taskDone = task.tomatoes.filter((tm: TomatoItem) => tm.completed).length;
                              const isTaskOpen = expandedTask.has(task.id);
                              return (
                                <div key={task.id} className="border-l-2 pl-3" style={{ borderLeftColor: c.divider }}>
                                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleTask(task.id)}>
                                    <span className="text-xs" style={{ color: c.text3 }}>{isTaskOpen ? '▾' : '▸'}</span>
                                    <span className="text-xs" style={{ color: c.text2 }}>
                                      任务: {task.title} | 预估{task.estimatedTomatoes}🍅 | 已完成{taskDone}🍅
                                    </span>
                                  </div>
                                  {isTaskOpen && (
                                    <div className="mt-1 space-y-1 ml-4">
                                      {task.tomatoes.map((tm: TomatoItem) => (
                                        <div key={tm.id} className="flex items-center gap-2 py-1 px-2 rounded text-xs"
                                          style={{ background: tm.completed ? c.cardHover : 'transparent' }}>
                                          <button onClick={() => toggleTomato(okr.id, kr.id, task.id, tm.id)}
                                            className="shrink-0" style={{ color: tm.completed ? '#22c55e' : c.text3 }}>
                                            {tm.completed ? '☑' : '☐'}
                                          </button>
                                          <span className="flex-1" style={{ color: tm.completed ? c.text3 : c.text2, textDecoration: tm.completed ? 'line-through' : 'none' }}>
                                            {tm.title} <span style={{ color: c.text3 }}>· 25min/🍅</span>
                                          </span>
                                          {!tm.completed ? (
                                            <button onClick={() => startTomato(okr, kr, task, tm)}
                                              className="px-2 py-0.5 rounded text-xs font-medium shrink-0"
                                              style={{ background: '#22c55e', color: '#fff' }}>
                                              ▶ 🍅
                                            </button>
                                          ) : (
                                            <span className="text-xs shrink-0" style={{ color: '#22c55e' }}>已完成 25min</span>
                                          )}
                                          <button onClick={() => deleteTomato(okr.id, kr.id, task.id, tm.id)}
                                            className="text-xs shrink-0 opacity-40 hover:opacity-100" style={{ color: c.text3 }}>×</button>
                                        </div>
                                      ))}
                                      {/* Add tomato inline */}
                                      <div className="flex gap-1 mt-1">
                                        <input value={newTomato[task.id] || ''} onChange={e => setNewTomato(prev => ({ ...prev, [task.id]: e.target.value }))}
                                          onKeyDown={e => { if (e.key === 'Enter') addTomato(okr.id, kr.id, task.id); }}
                                          placeholder="+ 动作(1🍅=25min)"
                                          className="flex-1 px-2 py-1 rounded text-xs outline-none"
                                          style={{ background: c.bodyBg, color: c.text1, border: `1px solid ${c.divider}` }} />
                                        <button onClick={() => addTomato(okr.id, kr.id, task.id)}
                                          className="px-2 py-1 rounded text-xs" style={{ background: swatch + '20', color: swatch }}>+</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {/* Add task inline */}
                            <div className="flex gap-1 mt-1">
                              <input value={newTask[kr.id] || ''} onChange={e => setNewTask(prev => ({ ...prev, [kr.id]: e.target.value }))}
                                placeholder="+ 任务名称"
                                className="flex-1 px-2 py-1 rounded text-xs outline-none"
                                style={{ background: c.bodyBg, color: c.text1, border: `1px solid ${c.divider}` }} />
                              <input value={taskEst[kr.id] || ''} onChange={e => setTaskEst(prev => ({ ...prev, [kr.id]: e.target.value }))}
                                placeholder="🍅数"
                                className="w-14 px-2 py-1 rounded text-xs outline-none"
                                style={{ background: c.bodyBg, color: c.text1, border: `1px solid ${c.divider}` }} />
                              <button onClick={() => addTask(okr.id, kr.id)}
                                className="px-2 py-1 rounded text-xs" style={{ background: swatch + '20', color: swatch }}>+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add KR inline */}
                  <div className="flex gap-1">
                    <input value={newKr[okr.id] || ''} onChange={e => setNewKr(prev => ({ ...prev, [okr.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addKR(okr.id); }}
                      placeholder="+ 关键结果(KR)"
                      className="flex-1 px-2 py-1 rounded text-xs outline-none"
                      style={{ background: c.bodyBg, color: c.text1, border: `1px solid ${c.divider}` }} />
                    <button onClick={() => addKR(okr.id)}
                      className="px-2 py-1 rounded text-xs" style={{ background: swatch + '20', color: swatch }}>+</button>
                  </div>
                </div>

                {/* Reviews */}
                {okr.reviews.length > 0 && (
                  <div className="px-5 py-2" style={{ borderTop: `1px solid ${c.divider}` }}>
                    <div className="text-xs font-medium mb-1" style={{ color: c.text3 }}>复盘</div>
                    {okr.reviews.map(r => (
                      <div key={r.id} className="text-xs mb-1" style={{ color: c.text2 }}>· {r.content}</div>
                    ))}
                  </div>
                )}
                <div className="px-5 pb-3 flex gap-2">
                  <input value={reviewText[okr.id] || ''} onChange={e => setReviewText(prev => ({ ...prev, [okr.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addReview(okr.id); }}
                    placeholder="+ 复盘记录…"
                    className="flex-1 px-3 py-1.5 rounded text-xs outline-none"
                    style={{ background: c.bodyBg, color: c.text1, border: `1px solid ${c.divider}` }} />
                  <button onClick={() => addReview(okr.id)}
                    className="px-3 py-1.5 rounded text-xs" style={{ background: swatch + '20', color: swatch }}>记</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom daily bar */}
        <div className="flex items-center gap-4 px-6 py-2 text-xs shrink-0"
          style={{ background: c.panelBg, borderTop: `1px solid ${c.divider}`, color: c.text2 }}>
          <span>今日已完成：<b style={{ color: swatch }}>{dailyDone} 🍅</b></span>
          <span>今日计划：
            <button onClick={() => setDailyTarget(d => Math.max(1, d - 1))} style={{ color: c.text3 }}>-</button>
            <b style={{ color: swatch }}> {dailyTarget} </b>
            <button onClick={() => setDailyTarget(d => d + 1)} style={{ color: c.text3 }}>+</button> 🍅
          </span>
          <span>中断次数：<b style={{ color: '#f59e0b' }}>{dailyInterrupts}</b></span>
          {timerActive && (
            <span className="ml-auto font-mono" style={{ color: swatch }}>
              🍅 {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
              {timerPaused && '(暂停)'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
