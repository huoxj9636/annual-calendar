'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SkinTheme } from '@/lib/skins';

// ─── Types ───
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
  title: string;
  status: OKRStatus;
  cycle: string;
  keyResults: KeyResult[];
  reviews: OKRReview[];
  createdAt: number;
}

interface EpitaphRef {
  type: string;
  epitaph: string;
  summary: string;
}

// ─── Constants ───
const STATUS_CFG: Record<OKRStatus, { icon: string; label: string }> = {
  active: { icon: '🔵', label: '进行中' },
  completed: { icon: '🟢', label: '已完成' },
  abandoned: { icon: '⚫', label: '已放弃' },
  delayed: { icon: '🟠', label: '已延期' },
};

const EPITAPH_REFS: EpitaphRef[] = [
  { type: '实干成就', epitaph: '他用一生建造了不朽的工程', summary: '专注实业，创造可见成果' },
  { type: '实干成就', epitaph: '她让荒漠变成了绿洲', summary: '实干改变世界' },
  { type: '学术探索', epitaph: '他的思想照亮了后人的路', summary: '追求真理，传播知识' },
  { type: '学术探索', epitaph: '她用一生解答了人类未知的难题', summary: '探索未知，拓展认知' },
  { type: '家庭温暖', epitaph: '她的爱让每个家人都成为更好的人', summary: '以爱为中心，温暖身边人' },
  { type: '家庭温暖', epitaph: '他是家人永远的港湾', summary: '守护家庭，传承温暖' },
  { type: '自由行者', epitaph: '他走过的每一步都是自由的证明', summary: '活出自我，不受束缚' },
  { type: '自由行者', epitaph: '她用一生证明了人生可以不一样', summary: '勇敢做自己' },
  { type: '商业创造', epitaph: '他创造了改变千万人的产品', summary: '商业创新，服务大众' },
  { type: '商业创造', epitaph: '她从零开始建立了一个帝国', summary: '创业精神，永不放弃' },
  { type: '碌碌无为', epitaph: '他来了，他活着，他走了——无人记得', summary: '随波逐流，未曾思考' },
  { type: '碌碌无为', epitaph: '她一生都在等待，等到最后也没开始', summary: '拖延犹豫，从未行动' },
];

const ANIM_STEPS = [
  '你出生了',
  '你上了学，和其他人一样',
  '你毕业了，找了一份差不多的工作',
  '你开始为生存奔波',
  '你被生活推着走，来不及思考',
  '你到了中年，开始迷茫',
  '你回首过去，充满遗憾',
  '你的墓碑上没有字',
  '如果这是你的结局，你甘心吗？',
];

const TOMATO_MINUTES = 25;

// ─── Helpers ───
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function okrProgress(okr: OKR): number {
  if (!okr.keyResults.length) return 0;
  const krAvg = okr.keyResults.reduce((a: number, kr: KeyResult) => {
    const allTm = kr.tasks.reduce((a2: number, t: Task) => a2 + t.tomatoes.length, 0);
    const doneTm = kr.tasks.reduce((a2: number, t: Task) => a2 + t.tomatoes.filter(tm => tm.completed).length, 0);
    return a + (allTm ? doneTm / allTm : 0);
  }, 0);
  return Math.round((krAvg / okr.keyResults.length) * 100);
}

function okrTomatoStats(okr: OKR) {
  let total = 0;
  let done = 0;
  let est = 0;
  okr.keyResults.forEach((kr: KeyResult) => {
    kr.tasks.forEach((t: Task) => {
      est += t.estimatedTomatoes;
      total += t.tomatoes.length;
      done += t.tomatoes.filter((tm: TomatoItem) => tm.completed).length;
    });
  });
  return { total, done, est };
}

// ─── Component ───
export default function LifeCalendar({ skin, onClose }: { skin: SkinTheme; onClose: () => void }) {
  const c = skin; // shorthand for colors

  // State
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [cycle, setCycle] = useState('2026');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [showEpitaph, setShowEpitaph] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [epitaphTab, setEpitaphTab] = useState<'ref' | 'write' | 'derive'>('ref');
  const [epitaphData, setEpitaphData] = useState({ oneLiner: '', career: '', character: '', relation: '', works: ['', '', ''] });
  const [epitaphFilter, setEpitaphFilter] = useState('全部');
  const [dimensions, setDimensions] = useState<Record<string, string>>({});
  const [newKr, setNewKr] = useState('');
  const [newTask, setNewTask] = useState<{ krId: string; title: string; est: number } | null>(null);
  const [newTm, setNewTm] = useState<{ taskId: string; title: string } | null>(null);
  const [animStep, setAnimStep] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [timerSec, setTimerSec] = useState(TOMATO_MINUTES * 60);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerCtx, setTimerCtx] = useState<{ okrTitle: string; krDesc: string; taskTitle: string; tmTitle: string } | null>(null);
  const [timerNote, setTimerNote] = useState('');
  const [editingKr, setEditingKr] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [dailyGoal, setDailyGoal] = useState(8);
  const [dailyDone, setDailyDone] = useState(0);
  const [interruptions, setInterruptions] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived
  const cycleOkrs = okrs.filter((o: OKR) => o.cycle === cycle);
  const selectedOkr = cycleOkrs.find((o: OKR) => o.id === selectedId) || null;
  const totalEst = cycleOkrs.reduce((a: number, o: OKR) => a + okrTomatoStats(o).est, 0);
  const totalDone = cycleOkrs.reduce((a: number, o: OKR) => a + okrTomatoStats(o).done, 0);
  const globalPct = totalEst ? Math.round((totalDone / totalEst) * 100) : 0;

  // Mount
  useEffect(() => { setMounted(true); }, []);

  // Load data
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem('okr-data');
      if (raw) setOkrs(JSON.parse(raw) as OKR[]);
      const ea = localStorage.getItem('okr-epitaph');
      if (ea) setEpitaphData(JSON.parse(ea));
      const dim = localStorage.getItem('okr-dimensions');
      if (dim) setDimensions(JSON.parse(dim));
      const seen = localStorage.getItem('okr-anim-seen');
      if (!seen) setShowAnimation(true);
      const dg = localStorage.getItem('okr-daily-goal');
      if (dg) setDailyGoal(parseInt(dg));
      const dd = localStorage.getItem('okr-daily-done-' + new Date().toDateString());
      if (dd) setDailyDone(parseInt(dd));
    } catch { /* ignore */ }
  }, [mounted]);

  // Save OKRs
  useEffect(() => {
    if (!mounted || !okrs.length) return;
    localStorage.setItem('okr-data', JSON.stringify(okrs));
  }, [okrs, mounted]);

  // Save epitaph
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('okr-epitaph', JSON.stringify(epitaphData));
  }, [epitaphData, mounted]);

  // Animation
  useEffect(() => {
    if (!showAnimation) return;
    if (animStep >= ANIM_STEPS.length) return;
    const t = setTimeout(() => setAnimStep(s => s + 1), 2200);
    return () => clearTimeout(t);
  }, [showAnimation, animStep]);

  // Timer
  useEffect(() => {
    if (!timerOn || timerPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimerSec(s => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimerOn(false);
          // Auto-complete tomato
          if (timerCtx) {
            setOkrs(prev => prev.map((o: OKR) => {
              if (o.id !== selectedId) return o;
              return { ...o, keyResults: o.keyResults.map((kr: KeyResult) => ({
                ...kr, tasks: kr.tasks.map((t: Task) => ({
                  ...t, tomatoes: t.tomatoes.map((tm: TomatoItem) =>
                    tm.title === timerCtx.tmTitle ? { ...tm, completed: true, completedAt: Date.now() } : tm
                  )
                }))
              }))};
            }));
            setDailyDone(d => d + 1);
          }
          try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH+Jj4+FfHJ1gIeNkI6KfXR0gIiOkI2JfXV0gIiOkI2JfXV0gIiOkI2JfXV1gIiOkI2JfXV1gA==').play(); } catch { /* */ }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerOn, timerPaused, timerCtx, selectedId]);

  // Save daily done
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('okr-daily-done-' + new Date().toDateString(), dailyDone.toString());
  }, [dailyDone, mounted]);

  // ─── Handlers ───
  const addOKR = useCallback(() => {
    if (!newTitle.trim()) return;
    const o: OKR = { id: uid(), title: newTitle.trim(), status: 'active', cycle, keyResults: [], reviews: [], createdAt: Date.now() };
    setOkrs(prev => [...prev, o]);
    setNewTitle('');
    setSelectedId(o.id);
  }, [newTitle, cycle]);

  const cycleStatus = useCallback((id: string) => {
    const order: OKRStatus[] = ['active', 'completed', 'abandoned', 'delayed'];
    setOkrs(prev => prev.map((o: OKR) => o.id === id ? { ...o, status: order[(order.indexOf(o.status) + 1) % 4] } : o));
  }, []);

  const addKR = useCallback((okrId: string) => {
    if (!newKr.trim()) return;
    const kr: KeyResult = { id: uid(), description: newKr.trim(), tasks: [] };
    setOkrs(prev => prev.map((o: OKR) => o.id === okrId ? { ...o, keyResults: [...o.keyResults, kr] } : o));
    setNewKr('');
  }, [newKr]);

  const addTask = useCallback((okrId: string, krId: string) => {
    if (!newTask || !newTask.title.trim()) return;
    const task: Task = { id: uid(), title: newTask.title.trim(), estimatedTomatoes: newTask.est || 1, tomatoes: [] };
    setOkrs(prev => prev.map((o: OKR) => o.id === okrId ? {
      ...o, keyResults: o.keyResults.map((kr: KeyResult) => kr.id === krId ? { ...kr, tasks: [...kr.tasks, task] } : kr)
    } : o));
    setNewTask(null);
  }, [newTask]);

  const addTomato = useCallback((okrId: string, krId: string, taskId: string) => {
    if (!newTm || !newTm.title.trim()) return;
    const tm: TomatoItem = { id: uid(), title: newTm.title.trim(), completed: false };
    setOkrs(prev => prev.map((o: OKR) => o.id === okrId ? {
      ...o, keyResults: o.keyResults.map((kr: KeyResult) => kr.id === krId ? {
        ...kr, tasks: kr.tasks.map((t: Task) => t.id === taskId ? { ...t, tomatoes: [...t.tomatoes, tm] } : t)
      } : kr)
    } : o));
    setNewTm(null);
  }, [newTm]);

  const toggleTomato = useCallback((okrId: string, krId: string, taskId: string, tmId: string) => {
    setOkrs(prev => prev.map((o: OKR) => o.id === okrId ? {
      ...o, keyResults: o.keyResults.map((kr: KeyResult) => kr.id === krId ? {
        ...kr, tasks: kr.tasks.map((t: Task) => t.id === taskId ? {
          ...t, tomatoes: t.tomatoes.map((tm: TomatoItem) => tm.id === tmId ? {
            ...tm, completed: !tm.completed, completedAt: !tm.completed ? Date.now() : undefined
          } : tm)
        } : t)
      } : kr)
    } : o));
  }, []);

  const deleteTomato = useCallback((okrId: string, krId: string, taskId: string, tmId: string) => {
    setOkrs(prev => prev.map((o: OKR) => o.id === okrId ? {
      ...o, keyResults: o.keyResults.map((kr: KeyResult) => kr.id === krId ? {
        ...kr, tasks: kr.tasks.map((t: Task) => t.id === taskId ? {
          ...t, tomatoes: t.tomatoes.filter((tm: TomatoItem) => tm.id !== tmId)
        } : t)
      } : kr)
    } : o));
  }, []);

  const startTomatoTimer = useCallback((okrTitle: string, krDesc: string, taskTitle: string, tmTitle: string) => {
    setTimerCtx({ okrTitle, krDesc, taskTitle, tmTitle });
    setTimerSec(TOMATO_MINUTES * 60);
    setTimerOn(true);
    setTimerPaused(false);
    setTimerNote('');
  }, []);

  const generateFromEpitaph = useCallback(() => {
    const dims: Record<string, string> = {
      '事业价值': epitaphData.career || '打造核心能力，创造不可替代的价值',
      '财富自由': '建立多元收入，实现财务独立',
      '健康精力': '保持精力充沛，支撑长期目标',
      '亲密关系': epitaphData.relation || '建立深度关系，成为可信赖的人',
      '自我成长': epitaphData.character || '持续学习进化，成为更好的自己',
    };
    setDimensions(dims);
    Object.entries(dims).forEach(([title, desc]) => {
      const o: OKR = { id: uid(), title: `O: ${title}`, status: 'active', cycle, keyResults: [{ id: uid(), description: desc, tasks: [] }], reviews: [], createdAt: Date.now() };
      setOkrs(prev => [...prev, o]);
    });
    setEpitaphTab('derive');
  }, [epitaphData, cycle]);

  // ─── Color helpers ───
  const statusColor = (status: OKRStatus) => {
    if (status === 'active') return c.swatch;
    if (status === 'completed') return '#22c55e';
    if (status === 'delayed') return '#f59e0b';
    return '#94a3b8';
  };

  const pb = (pct: number, color?: string) => `${pct}% ${color || c.swatch}`;

  if (!mounted) return null;

  // ─── Render ───
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: c.bodyBg, color: c.textPrimary }}>

      {/* ═══ Animation Overlay ═══ */}
      {showAnimation && (
        <div className="fixed inset-0 z-[60] flex" style={{ background: '#000' }}>
          {/* Left: PPT-style text */}
          <div className="flex-1 flex flex-col justify-center items-center px-12">
            {ANIM_STEPS.map((step, i) => (
              <div key={i} className="mb-4 transition-all duration-700" style={{
                opacity: i < animStep ? 0.3 : i === animStep ? 1 : 0.05,
                fontSize: i === ANIM_STEPS.length - 1 ? '1.5rem' : '1.1rem',
                fontWeight: i === ANIM_STEPS.length - 1 ? 700 : 400,
                color: i === ANIM_STEPS.length - 1 ? '#ef4444' : '#fff',
                transform: i === animStep ? 'scale(1.05)' : 'scale(1)',
              }}>
                {step}
              </div>
            ))}
            {animStep >= ANIM_STEPS.length && (
              <button className="mt-8 px-6 py-3 rounded-lg text-white font-bold" style={{ background: '#ef4444' }} onClick={() => { setShowAnimation(false); localStorage.setItem('okr-anim-seen', '1'); }}>
                我不甘心，我要改变
              </button>
            )}
          </div>
          {/* Right: Ladder + Light */}
          <div className="flex-1 relative">
            {/* Light opening */}
            <div className="absolute top-4 right-12 w-28 h-28 rounded-full" style={{ background: 'radial-gradient(circle, rgba(200,220,255,0.9) 0%, rgba(150,180,220,0.4) 40%, transparent 70%)' }} />
            <div className="absolute top-16 right-16 w-20 h-20 rounded-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 100%)' }}>
              <div className="absolute top-3 left-2 w-8 h-4 rounded-full" style={{ background: 'rgba(255,255,255,0.7)' }} />
              <div className="absolute top-5 right-3 w-6 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
            </div>
            {/* Ladder */}
            <div className="absolute bottom-0 right-24" style={{ width: '3px', height: '85%', background: 'linear-gradient(to top, #3a2a1a 0%, #8B7355 50%, #A0926B 80%, rgba(160,146,107,0.2) 100%)' }} />
            <div className="absolute bottom-0 right-36" style={{ width: '3px', height: '85%', background: 'linear-gradient(to top, #3a2a1a 0%, #8B7355 50%, #A0926B 80%, rgba(160,146,107,0.2) 100%)' }} />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="absolute" style={{
                right: '24px', width: '48px', height: '3px',
                bottom: `${10 + i * 10}%`,
                background: `linear-gradient(to right, rgba(139,115,85,${0.2 + i * 0.1}), rgba(160,146,107,${0.3 + i * 0.08}))`,
              }} />
            ))}
            {/* Light beam */}
            <div className="absolute top-28 right-20" style={{
              width: '120px', height: '60vh',
              background: 'linear-gradient(180deg, rgba(200,220,255,0.12) 0%, transparent 100%)',
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)',
            }} />
          </div>
        </div>
      )}

      {/* ═══ Epitaph Overlay ═══ */}
      {showEpitaph && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowEpitaph(false)}>
          <div className="w-[640px] max-h-[80vh] overflow-y-auto rounded-xl p-6" style={{ background: '#1a1a1a', color: '#e5e5e5' }} onClick={e => e.stopPropagation()}>
            {/* Tabs */}
            <div className="flex gap-3 mb-5">
              {(['ref', 'write', 'derive'] as const).map(tab => (
                <button key={tab} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: epitaphTab === tab ? '#fff' : '#333', color: epitaphTab === tab ? '#000' : '#999' }} onClick={() => setEpitaphTab(tab)}>
                  {tab === 'ref' ? '参考库' : tab === 'write' ? '我的墓志铭' : '终局倒推'}
                </button>
              ))}
            </div>

            {/* Tab: Reference */}
            {epitaphTab === 'ref' && (
              <div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['全部', ...new Set(EPITAPH_REFS.map(r => r.type))].map(t => (
                    <button key={t} className="px-3 py-1 rounded text-xs" style={{ background: epitaphFilter === t ? '#fff' : '#333', color: epitaphFilter === t ? '#000' : '#999' }} onClick={() => setEpitaphFilter(t)}>{t}</button>
                  ))}
                </div>
                <div className="space-y-3">
                  {EPITAPH_REFS.filter(r => epitaphFilter === '全部' || r.type === epitaphFilter).map((r, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: '#262626' }}>
                      <div className="text-xs mb-1" style={{ color: '#888' }}>{r.type}</div>
                      <div className="font-medium mb-1">「{r.epitaph}」</div>
                      <div className="text-sm" style={{ color: '#aaa' }}>{r.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Write */}
            {epitaphTab === 'write' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: '#aaa' }}>我的墓志铭（刻在墓碑上的最终评价）</label>
                  <input className="w-full p-3 rounded-lg text-sm" style={{ background: '#262626', border: '1px solid #444', color: '#fff' }} placeholder="例：成为一个创造价值、内心坚定、留下成果的实干者" value={epitaphData.oneLiner} onChange={e => setEpitaphData({ ...epitaphData, oneLiner: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: '#aaa' }}>事业上别人如何评价我</label>
                  <input className="w-full p-3 rounded-lg text-sm" style={{ background: '#262626', border: '1px solid #444', color: '#fff' }} placeholder="例：他创造了改变行业的产品" value={epitaphData.career} onChange={e => setEpitaphData({ ...epitaphData, career: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: '#aaa' }}>品格上别人如何评价我</label>
                  <input className="w-full p-3 rounded-lg text-sm" style={{ background: '#262626', border: '1px solid #444', color: '#fff' }} placeholder="例：他是一个内心坚定、值得信赖的人" value={epitaphData.character} onChange={e => setEpitaphData({ ...epitaphData, character: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: '#aaa' }}>关系上别人如何评价我</label>
                  <input className="w-full p-3 rounded-lg text-sm" style={{ background: '#262626', border: '1px solid #444', color: '#fff' }} placeholder="例：他是家人永远的港湾" value={epitaphData.relation} onChange={e => setEpitaphData({ ...epitaphData, relation: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: '#aaa' }}>我最想留下的3件作品/成果</label>
                  {epitaphData.works.map((w, i) => (
                    <input key={i} className="w-full p-2 rounded-lg text-sm mb-2" style={{ background: '#262626', border: '1px solid #444', color: '#fff' }} placeholder={`作品${i + 1}`} value={w} onChange={e => { const nw = [...epitaphData.works]; nw[i] = e.target.value; setEpitaphData({ ...epitaphData, works: nw }); }} />
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Derive */}
            {epitaphTab === 'derive' && (
              <div className="space-y-4">
                <button className="w-full p-3 rounded-lg text-sm font-medium" style={{ background: '#2563eb', color: '#fff' }} onClick={generateFromEpitaph}>
                  ⚡ 自动从墓志铭拆解到五大维度并生成OKR
                </button>
                <div className="space-y-2">
                  {Object.entries(dimensions).map(([k, v]) => (
                    <div key={k} className="p-3 rounded-lg" style={{ background: '#262626' }}>
                      <div className="font-medium text-sm">{k}</div>
                      <div className="text-xs mt-1" style={{ color: '#aaa' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {Object.keys(dimensions).length === 0 && (
                  <div className="text-sm text-center py-4" style={{ color: '#666' }}>先撰写墓志铭，再点击上方按钮自动拆解</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Timer Modal ═══ */}
      {timerOn && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="text-center">
            {timerCtx && (
              <div className="text-sm mb-6" style={{ color: '#888' }}>
                {timerCtx.okrTitle} → {timerCtx.krDesc} → {timerCtx.taskTitle} → {timerCtx.tmTitle}
              </div>
            )}
            <div className="text-6xl font-bold mb-4 tabular-nums" style={{ color: timerPaused ? '#666' : '#fff' }}>
              {String(Math.floor(timerSec / 60)).padStart(2, '0')}:{String(timerSec % 60).padStart(2, '0')}
            </div>
            <div className="text-sm mb-6" style={{ color: '#666' }}>
              {timerPaused ? '已暂停' : '专注中'} · {TOMATO_MINUTES}min/🍅
            </div>
            <div className="flex gap-3 justify-center mb-6">
              <button className="px-5 py-2 rounded-lg font-medium" style={{ background: '#f59e0b', color: '#fff' }} onClick={() => setTimerPaused(!timerPaused)}>
                {timerPaused ? '继续' : '暂停'}
              </button>
              <button className="px-5 py-2 rounded-lg font-medium" style={{ background: '#ef4444', color: '#fff' }} onClick={() => { setTimerOn(false); setInterruptions(n => n + 1); }}>
                放弃本次番茄
              </button>
            </div>
            <input className="w-64 p-2 rounded text-sm text-center" style={{ background: '#1a1a1a', border: '1px solid #333', color: '#ccc' }} placeholder="记录卡点或中断原因..." value={timerNote} onChange={e => setTimerNote(e.target.value)} />
          </div>
        </div>
      )}

      {/* ═══ Main Workspace ═══ */}
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ background: c.panelBg, borderBottom: `1px solid ${c.divider}` }}>
        <div className="flex items-center gap-3">
          <select className="px-2 py-1 rounded text-sm" style={{ background: c.cardBg, color: c.textPrimary, border: `1px solid ${c.divider}` }} value={cycle} onChange={e => { setCycle(e.target.value); setSelectedId(null); }}>
            <option value="2026">2026 全年</option>
            <option value="2026-Q1">2026 Q1</option>
            <option value="2026-Q2">2026 Q2</option>
            <option value="2026-Q3">2026 Q3</option>
            <option value="2026-Q4">2026 Q4</option>
          </select>
          <div className="flex gap-4 text-xs" style={{ color: c.textSecondary }}>
            <span>总OKR <b style={{ color: c.swatch }}>{cycleOkrs.length}</b></span>
            <span>预估 <b style={{ color: c.swatch }}>🍅{totalEst}</b></span>
            <span>完成 <b style={{ color: '#22c55e' }}>🍅{totalDone}</b></span>
            <span>进度 <b style={{ color: c.swatch }}>{globalPct}%</b></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded text-xs font-medium" style={{ background: '#000', color: '#fff' }} onClick={() => setShowEpitaph(true)}>终局·墓志铭</button>
          <button className="px-3 py-1 rounded text-xs font-medium" style={{ background: c.swatch, color: '#fff' }} onClick={() => { const o: OKR = { id: uid(), title: '', status: 'active', cycle, keyResults: [], reviews: [], createdAt: Date.now() }; setOkrs(prev => [...prev, o]); setSelectedId(o.id); }}>+ 新增OKR</button>
          <button className="px-2 py-1 rounded text-sm" style={{ color: c.textSecondary }} onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Epitaph Banner */}
      {epitaphData.oneLiner && (
        <div className="px-4 py-2 text-center text-sm font-medium shrink-0" style={{ background: '#000', color: '#fff' }}>
          我的墓志铭：{epitaphData.oneLiner}
        </div>
      )}

      {/* Left-Right Layout */}
      <div className="flex flex-1 min-h-0">
        {/* ─── Left Panel: OKR List ─── */}
        <div className="w-[480px] shrink-0 flex flex-col border-r" style={{ background: c.panelBg, borderColor: c.divider }}>
          {/* Header with gradient */}
          <div className="shrink-0 px-5 pt-5 pb-4" style={{ background: `linear-gradient(135deg, ${c.headerFrom}, ${c.headerTo})` }}>
            <h2 className="text-lg font-bold mb-2" style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>人生旅途</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>以终为始 · OKR + 番茄闭环</p>
          </div>

          {/* New OKR Input */}
          <div className="px-4 py-2 shrink-0" style={{ borderBottom: `1px solid ${c.divider}` }}>
            <input className="w-full p-2 rounded text-sm" style={{ background: c.cardBg, color: c.textPrimary, border: `1px solid ${c.divider}` }} placeholder="+ 输入目标，回车创建" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOKR()} />
          </div>

          {/* OKR List */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {cycleOkrs.length === 0 && (
              <div className="text-center py-8" style={{ color: c.textMuted }}>
                <div className="text-sm mb-2">暂无OKR</div>
                <button className="text-xs underline" style={{ color: c.swatch }} onClick={() => setShowEpitaph(true)}>或从墓志铭生成 →</button>
              </div>
            )}
            {cycleOkrs.map((okr: OKR) => {
              const stats = okrTomatoStats(okr);
              const pct = okrProgress(okr);
              const sc = statusColor(okr.status);
              return (
                <div key={okr.id} className="mb-2 p-3 rounded-lg cursor-pointer" style={{ background: selectedId === okr.id ? c.cardHover : c.cardBg, borderLeft: `3px solid ${sc}` }} onClick={() => setSelectedId(okr.id)}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs">{STATUS_CFG[okr.status].icon}</span>
                    <span className="text-sm font-medium flex-1 truncate">{okr.title || '未命名目标'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: c.progressTrack }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: sc }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: sc }}>{pct}%</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: c.textMuted }}>🍅 {stats.done}/{stats.est} · {stats.done * TOMATO_MINUTES}min</div>
                </div>
              );
            })}
          </div>

          {/* Daily Stats */}
          <div className="px-4 py-2 shrink-0 flex items-center justify-between text-xs" style={{ borderTop: `1px solid ${c.divider}`, color: c.textSecondary }}>
            <span>今日 🍅 {dailyDone}/{dailyGoal}</span>
            <span>中断 {interruptions}</span>
            <div className="flex gap-1">
              <button onClick={() => setDailyGoal(g => Math.max(1, g - 1))}>-</button>
              <button onClick={() => setDailyGoal(g => g + 1)}>+</button>
            </div>
          </div>
        </div>

        {/* ─── Right Panel: OKR Detail ─── */}
        <div className="flex-1 overflow-y-auto" style={{ background: c.bodyBg }}>
          {!selectedOkr ? (
            <div className="flex items-center justify-center h-full" style={{ color: c.textMuted }}>
              <div className="text-center">
                <div className="text-4xl mb-3">🎯</div>
                <div className="text-sm">选择左侧OKR查看详情</div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* O Header */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <button className="text-lg" onClick={() => cycleStatus(selectedOkr.id)} title="点击切换状态">{STATUS_CFG[selectedOkr.status].icon}</button>
                  <h3 className="text-lg font-bold flex-1">{selectedOkr.title || '未命名目标'}</h3>
                  <span className="text-lg font-bold" style={{ color: statusColor(selectedOkr.status) }}>{okrProgress(selectedOkr)}%</span>
                </div>
                <div className="h-2 rounded-full mb-2" style={{ background: c.progressTrack }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${okrProgress(selectedOkr)}%`, background: statusColor(selectedOkr.status) }} />
                </div>
                <div className="text-xs" style={{ color: c.textMuted }}>
                  🍅 {okrTomatoStats(selectedOkr).done}/{okrTomatoStats(selectedOkr).est} ≈ {okrTomatoStats(selectedOkr).done * TOMATO_MINUTES}min
                </div>
              </div>

              {/* KR Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">关键结果 (KR)</span>
                  <div className="flex-1 h-px" style={{ background: c.divider }} />
                </div>

                {selectedOkr.keyResults.map((kr: KeyResult) => {
                  const krDone = kr.tasks.reduce((a: number, t: Task) => a + t.tomatoes.filter((tm: TomatoItem) => tm.completed).length, 0);
                  const krTotal = kr.tasks.reduce((a: number, t: Task) => a + t.tomatoes.length, 0);
                  const krEst = kr.tasks.reduce((a: number, t: Task) => a + t.estimatedTomatoes, 0);
                  const krPct = krTotal ? Math.round((krDone / krTotal) * 100) : 0;

                  return (
                    <div key={kr.id} className="mb-4 p-4 rounded-lg" style={{ background: c.cardBg, borderLeft: `3px solid ${c.swatch}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">KR: {kr.description}</span>
                        <span className="text-xs" style={{ color: c.textMuted }}>进度{krPct}% | 🍅{krDone}/{krEst}</span>
                      </div>

                      {/* Tasks */}
                      {kr.tasks.map((task: Task) => {
                        const taskDone = task.tomatoes.filter((tm: TomatoItem) => tm.completed).length;
                        return (
                          <div key={task.id} className="ml-3 mb-3 p-3 rounded" style={{ background: c.bodyBg }}>
                            <div className="text-sm mb-2">
                              任务: {task.title} | 预估{task.estimatedTomatoes}🍅 | 完成{taskDone}🍅 | {taskDone * TOMATO_MINUTES}min
                            </div>
                            {/* Tomato items */}
                            {task.tomatoes.map((tm: TomatoItem) => (
                              <div key={tm.id} className="flex items-center gap-2 ml-3 py-1 text-sm">
                                <span className="cursor-pointer" onClick={() => toggleTomato(selectedOkr.id, kr.id, task.id, tm.id)}>
                                  {tm.completed ? '☑' : '☐'}
                                </span>
                                <span className={tm.completed ? 'line-through' : ''} style={{ color: tm.completed ? c.textMuted : c.textPrimary }}>{tm.title}</span>
                                <span className="text-xs" style={{ color: c.textMuted }}>25min/🍅</span>
                                {!tm.completed && (
                                  <button className="px-2 py-0.5 rounded text-xs font-medium ml-auto" style={{ background: '#22c55e', color: '#fff' }} onClick={() => startTomatoTimer(selectedOkr.title, kr.description, task.title, tm.title)}>
                                    ▶ 🍅
                                  </button>
                                )}
                                {tm.completed && <span className="text-xs ml-auto" style={{ color: '#22c55e' }}>已完成 {TOMATO_MINUTES}min</span>}
                                <button className="text-xs opacity-40 hover:opacity-100" onClick={() => deleteTomato(selectedOkr.id, kr.id, task.id, tm.id)}>×</button>
                              </div>
                            ))}
                            {/* Add tomato */}
                            {newTm && newTm.taskId === task.id ? (
                              <div className="ml-3 mt-1 flex gap-1">
                                <input className="flex-1 p-1 rounded text-xs" style={{ background: c.cardBg, color: c.textPrimary, border: `1px solid ${c.divider}` }} placeholder="动作名称 (1🍅=25min)" value={newTm.title} onChange={e => setNewTm({ ...newTm, title: e.target.value })} onKeyDown={e => e.key === 'Enter' && addTomato(selectedOkr.id, kr.id, task.id)} autoFocus />
                                <button className="text-xs px-2" style={{ color: c.swatch }} onClick={() => addTomato(selectedOkr.id, kr.id, task.id)}>✓</button>
                                <button className="text-xs px-2" style={{ color: c.textMuted }} onClick={() => setNewTm(null)}>✕</button>
                              </div>
                            ) : (
                              <button className="ml-3 mt-1 text-xs" style={{ color: c.swatch }} onClick={() => setNewTm({ taskId: task.id, title: '' })}>+ 动作(1🍅=25min)</button>
                            )}
                          </div>
                        );
                      })}

                      {/* Add task */}
                      {newTask && newTask.krId === kr.id ? (
                        <div className="ml-3 flex gap-1">
                          <input className="flex-1 p-1 rounded text-xs" style={{ background: c.bodyBg, color: c.textPrimary, border: `1px solid ${c.divider}` }} placeholder="任务名称" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} onKeyDown={e => e.key === 'Enter' && addTask(selectedOkr.id, kr.id)} autoFocus />
                          <input className="w-12 p-1 rounded text-xs text-center" style={{ background: c.bodyBg, color: c.textPrimary, border: `1px solid ${c.divider}` }} placeholder="🍅数" type="number" min={1} value={newTask.est || ''} onChange={e => setNewTask({ ...newTask, est: parseInt(e.target.value) || 1 })} />
                          <button className="text-xs px-2" style={{ color: c.swatch }} onClick={() => addTask(selectedOkr.id, kr.id)}>✓</button>
                          <button className="text-xs px-2" style={{ color: c.textMuted }} onClick={() => setNewTask(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="ml-3 text-xs" style={{ color: c.swatch }} onClick={() => setNewTask({ krId: kr.id, title: '', est: 1 })}>+ 任务(需预估🍅数)</button>
                      )}
                    </div>
                  );
                })}

                {/* Add KR */}
                {editingKr === selectedOkr.id ? (
                  <div className="flex gap-1">
                    <input className="flex-1 p-2 rounded text-sm" style={{ background: c.cardBg, color: c.textPrimary, border: `1px solid ${c.divider}` }} placeholder="关键结果描述" value={newKr} onChange={e => setNewKr(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKR(selectedOkr.id)} autoFocus />
                    <button className="px-3 py-2 rounded text-sm" style={{ background: c.swatch, color: '#fff' }} onClick={() => addKR(selectedOkr.id)}>✓</button>
                    <button className="px-3 py-2 rounded text-sm" style={{ color: c.textMuted }} onClick={() => setEditingKr(null)}>✕</button>
                  </div>
                ) : (
                  <button className="text-sm" style={{ color: c.swatch }} onClick={() => setEditingKr(selectedOkr.id)}>+ 添加关键结果(KR)</button>
                )}
              </div>

              {/* Review Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">复盘记录</span>
                  <div className="flex-1 h-px" style={{ background: c.divider }} />
                </div>
                {selectedOkr.reviews.map((r: OKRReview) => (
                  <div key={r.id} className="mb-2 p-2 rounded text-sm" style={{ background: c.cardBg }}>
                    <span className="text-xs" style={{ color: c.textMuted }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                    <div>{r.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
