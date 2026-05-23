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

// ── OKR Data types ──
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

// ── Epitaph Data types ──
interface EpitaphData {
  oneLiner: string;          // 墓志铭一句话
  evaluation: { career: string; character: string; relationship: string }; // 别人如何评价
  threeWorks: [string, string, string]; // 三件作品/成果
  updatedAt: number;
}

interface EpitaphRef {
  type: string;
  epitaph: string;
  summary: string;
}

// ── Constants ──
const STATUS_CYCLE: OKRStatus[] = ['not_started', 'in_progress', 'completed'];
const STATUS_CFG: Record<OKRStatus, { label: string; icon: string }> = {
  not_started: { label: '未开始', icon: '⚪' },
  in_progress: { label: '进行中', icon: '🔵' },
  completed: { label: '已完成', icon: '🟢' },
};

const EPITAPH_REFS: EpitaphRef[] = [
  { type: '实干成就', epitaph: '「她用双手铸就了不可磨灭的事业」', summary: '一生扎根实业，从零到一，用行动证明价值，留下实实在在的成果。' },
  { type: '实干成就', epitaph: '「他让荒地变沃土，让不可能变日常」', summary: '实干家的人生信条：问题来了就解决，路堵了就开路。' },
  { type: '学术探索', epitaph: '「他为人类知识边界推进了一厘米」', summary: '在未知的黑暗中举着火把，那一小步却照亮了后来者的路。' },
  { type: '学术探索', epitaph: '「她一生追问为什么，直到答案开花」', summary: '学术的孤独只有自己知道，但成果属于全人类。' },
  { type: '家庭温暖', epitaph: '「他的家，是所有人最想回去的地方」', summary: '没做过惊天动地的事，但把身边每个人都照顾得很好。' },
  { type: '家庭温暖', epitaph: '「她把一生过成了最温暖的诗」', summary: '以温柔为力量，用陪伴书写了最动人的篇章。' },
  { type: '自由行者', epitaph: '「他从未被定义，也从未停止行走」', summary: '不按剧本活，每一步都是自己的选择，每一程都是风景。' },
  { type: '自由行者', epitaph: '「她活成了别人只敢想的样子」', summary: '自由的代价是孤独，但自由的回报是无悔。' },
  { type: '商业创造', epitaph: '「他创造了价值，也改变了规则」', summary: '商业的本质不是赚钱，是创造别人需要的东西。' },
  { type: '商业创造', epitaph: '「她让一万个人有了更好的生活」', summary: '商业的最高境界：自己成功的同时，让世界更好了一点。' },
  { type: '碌碌无为', epitaph: '「他来过，但没人记得他做过什么」', summary: '警示：随波逐流的一生，连遗憾都平淡无味。' },
  { type: '碌碌无为', epitaph: '「她总说明天开始，直到没有明天」', summary: '警示：拖延不是性格，是对生命的浪费。' },
];

const LIFE_DIMENSIONS = ['事业价值', '财富自由', '健康精力', '亲密关系', '自我成长'] as const;

// Life animation script
const LIFE_SCRIPT = [
  { text: '出生', sub: '一声啼哭，来到这个世界' },
  { text: '上学', sub: '随大流，按部就班' },
  { text: '毕业', sub: '不知道自己要什么，先找份工作吧' },
  { text: '工作', sub: '为生存奔波，日复一日' },
  { text: '被推着走', sub: '结婚、买房、生子……社会时钟不停' },
  { text: '中年', sub: '突然迷茫——这是我想要的生活吗？' },
  { text: '晚年', sub: '回首一生，遗憾比成就多' },
  { text: '墓碑', sub: '无字。一生潦草落幕' },
  { text: '', sub: '如果这是你的结局，你甘心吗？' },
];

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

  // ── Epitaph state ──
  const [showEpitaph, setShowEpitaph] = useState(false);
  const [epitaphSeen, setEpitaphSeen] = useState(false);
  const [epitaphData, setEpitaphData] = useState<EpitaphData | null>(null);
  const [epitaphAnimStep, setEpitaphAnimStep] = useState(-1); // -1 = not playing
  const [epitaphTab, setEpitaphTab] = useState<'refs' | 'write' | 'deduce'>('refs');
  const [epitaphFilter, setEpitaphFilter] = useState<string>('all');
  // Write form
  const [epOneLiner, setEpOneLiner] = useState('');
  const [epCareer, setEpCareer] = useState('');
  const [epCharacter, setEpCharacter] = useState('');
  const [epRelationship, setEpRelationship] = useState('');
  const [epWork1, setEpWork1] = useState('');
  const [epWork2, setEpWork2] = useState('');
  const [epWork3, setEpWork3] = useState('');
  // Deduce: dimension inputs
  const [dimInputs, setDimInputs] = useState<Record<string, string>>({});

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
    // Epitaph
    const seen = localStorage.getItem('epitaph-seen');
    setEpitaphSeen(!!seen);
    const ed = localStorage.getItem('epitaph-data');
    if (ed) { try { setEpitaphData(JSON.parse(ed)); } catch { /* ignore */ } }
    if (!seen) { setEpitaphAnimStep(0); }
    setMounted(true);
  }, [todayKey]);

  // ── Save ──
  useEffect(() => { if (mounted) localStorage.setItem('okr-data', JSON.stringify(okrs)); }, [okrs, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('tomato-daily-target', String(dailyTarget)); }, [dailyTarget, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem(`tomato-interrupt-${todayKey}`, String(interruptions)); }, [interruptions, mounted, todayKey]);
  useEffect(() => { if (mounted && epitaphData) localStorage.setItem('epitaph-data', JSON.stringify(epitaphData)); }, [epitaphData, mounted]);

  // ── Epitaph animation ──
  useEffect(() => {
    if (epitaphAnimStep < 0 || epitaphAnimStep >= LIFE_SCRIPT.length) return;
    const delay = epitaphAnimStep === LIFE_SCRIPT.length - 1 ? 4000 : 2200;
    const tid = setTimeout(() => {
      if (epitaphAnimStep < LIFE_SCRIPT.length - 1) {
        setEpitaphAnimStep(prev => prev + 1);
      } else {
        setEpitaphAnimStep(-1);
        setEpitaphSeen(true);
        localStorage.setItem('epitaph-seen', '1');
        setShowEpitaph(true);
      }
    }, delay);
    return () => clearTimeout(tid);
  }, [epitaphAnimStep]);

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

  // ── Epitaph actions ──
  const saveEpitaph = useCallback(() => {
    const data: EpitaphData = {
      oneLiner: epOneLiner.trim(),
      evaluation: { career: epCareer.trim(), character: epCharacter.trim(), relationship: epRelationship.trim() },
      threeWorks: [epWork1.trim(), epWork2.trim(), epWork3.trim()],
      updatedAt: Date.now(),
    };
    setEpitaphData(data);
    localStorage.setItem('epitaph-data', JSON.stringify(data));
  }, [epOneLiner, epCareer, epCharacter, epRelationship, epWork1, epWork2, epWork3]);

  // Auto-deduce 5 dimensions from epitaph content
  const autoDeduceDimensions = useCallback(() => {
    if (!epitaphData) return;
    const works = epitaphData.threeWorks.filter(Boolean);
    const { career, character, relationship } = epitaphData.evaluation;
    const newInputs: Record<string, string> = {};
    // 事业价值: career evaluation + work-related works
    const careerWorks = works.filter(w => /产品|工具|公司|项目|业务|客户|团队|技术|平台|创业|职业|事业|行业|工作/.test(w));
    newInputs['事业价值'] = [career, ...careerWorks].filter(Boolean).join('；') || `在事业上实现${epitaphData.oneLiner.slice(0, 10)}的核心追求`;
    // 财富自由: income/asset-related works
    const wealthWorks = works.filter(w => /收入|资产|投资|房|车|存款|财务|自由|百万|千万|亿/.test(w));
    newInputs['财富自由'] = wealthWorks.join('；') || '实现财务独立，不再为生存出售时间';
    // 健康精力
    const healthWorks = works.filter(w => /运动|健康|体检|跑步|健身|养生|睡眠|精力/.test(w));
    newInputs['健康精力'] = healthWorks.join('；') || '保持充沛精力，支撑所有目标';
    // 亲密关系
    const relWorks = works.filter(w => /家|陪伴|孩子|伴侣|父母|朋友|爱人|旅行|团聚/.test(w));
    newInputs['亲密关系'] = [relationship, ...relWorks].filter(Boolean).join('；') || '经营深度关系，不让爱缺席';
    // 自我成长
    const growthWorks = works.filter(w => /学习|读书|写作|技能|成长|语言|学历|知识/.test(w));
    newInputs['自我成长'] = [character, ...growthWorks].filter(Boolean).join('；') || '持续成长，成为更好的自己';
    setDimInputs(newInputs);
  }, [epitaphData]);

  const generateOKRsFromEpitaph = useCallback(() => {
    const newOkrs: OKR[] = LIFE_DIMENSIONS.map(dim => {
      const customObj = dimInputs[dim]?.trim();
      return {
        id: genId(),
        objective: customObj || `${dim}：实现墓志铭中的${dim}目标`,
        status: 'not_started' as OKRStatus,
        period: periodKey,
        keyResults: [{ id: genId(), description: `定义${dim}的关键衡量标准`, tasks: [] }],
        reviews: [],
        createdAt: Date.now(),
      };
    });
    setOkrs(prev => [...prev, ...newOkrs]);
    setShowEpitaph(false);
    if (newOkrs.length > 0) setSelectedId(newOkrs[0].id);
  }, [dimInputs, periodKey]);

  const skipAnimation = useCallback(() => {
    setEpitaphAnimStep(-1);
    setEpitaphSeen(true);
    localStorage.setItem('epitaph-seen', '1');
    setShowEpitaph(true);
  }, []);

  // Load epitaph into form when opening write tab
  useEffect(() => {
    if (showEpitaph && epitaphTab === 'write' && epitaphData) {
      setEpOneLiner(epitaphData.oneLiner);
      setEpCareer(epitaphData.evaluation.career);
      setEpCharacter(epitaphData.evaluation.character);
      setEpRelationship(epitaphData.evaluation.relationship);
      setEpWork1(epitaphData.threeWorks[0]);
      setEpWork2(epitaphData.threeWorks[1]);
      setEpWork3(epitaphData.threeWorks[2]);
    }
  }, [showEpitaph, epitaphTab, epitaphData]);

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

  // ═══════════════════════════════════════════════════
  // EPITAPH ANIMATION OVERLAY
  // ═══════════════════════════════════════════════════
  if (epitaphAnimStep >= 0) {
    const step = LIFE_SCRIPT[epitaphAnimStep];
    const isLast = epitaphAnimStep === LIFE_SCRIPT.length - 1;
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center"
           style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)' }}>
        {/* Vignette */}
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 150px rgba(0,0,0,0.8)' }} />

        {/* Timeline dots on the left */}
        <div className="absolute left-[15%] top-1/2 -translate-y-1/2 flex flex-col gap-4">
          {LIFE_SCRIPT.map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full transition-all duration-700"
                   style={{ backgroundColor: i <= epitaphAnimStep ? (isLast && i === epitaphAnimStep ? '#ef4444' : '#fff') : '#333', boxShadow: i === epitaphAnimStep ? '0 0 8px rgba(255,255,255,0.4)' : 'none' }} />
              {i < LIFE_SCRIPT.length - 1 && (
                <div className="w-px h-4" style={{ backgroundColor: i < epitaphAnimStep ? '#555' : '#222' }} />
              )}
            </div>
          ))}
        </div>

        {/* Center text */}
        <div className="relative z-10 text-center animate-fadeIn">
          {step.text && (
            <div className="text-5xl font-bold text-white mb-4" style={{ textShadow: '0 0 30px rgba(255,255,255,0.15)' }}>
              {step.text}
            </div>
          )}
          <div className={`text-lg ${isLast ? 'text-red-400 text-xl font-medium' : 'text-gray-400'}`}
               style={{ textShadow: isLast ? '0 0 20px rgba(239,68,68,0.3)' : 'none' }}>
            {step.sub}
          </div>
        </div>

        {/* Skip button */}
        <button onClick={skipAnimation}
                className="absolute bottom-8 right-8 text-sm text-gray-600 hover:text-gray-300 transition-colors">
          跳过 →
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // EPITAPH MAIN OVERLAY (black & white style)
  // ═══════════════════════════════════════════════════
  if (showEpitaph) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: 'linear-gradient(180deg, #0f0f0f 0%, #1a1a1a 50%, #111 100%)' }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#222' }}>
          <h2 className="text-lg font-bold text-white tracking-wider">终局 · 墓志铭</h2>
          <button onClick={() => setShowEpitaph(false)} className="text-gray-500 hover:text-white transition-colors text-sm">
            ✕ 返回OKR
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3">
          {([['refs', '参考库'], ['write', '我的墓志铭'], ['deduce', '终局倒推']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setEpitaphTab(k)}
                    className="px-4 py-2 rounded-t-lg text-sm font-medium transition-all"
                    style={{ backgroundColor: epitaphTab === k ? '#222' : 'transparent', color: epitaphTab === k ? '#fff' : '#666' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ──── Tab: 参考库 ──── */}
          {epitaphTab === 'refs' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500 mb-4">对标不同人生选择，看清内心真正向往的人生。</p>
              {/* Filter tags */}
              <div className="flex flex-wrap gap-2">
                {['all', ...Array.from(new Set(EPITAPH_REFS.map(r => r.type)))].map(type => (
                  <button key={type} onClick={() => setEpitaphFilter(type)}
                          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                          style={{ backgroundColor: epitaphFilter === type ? '#444' : '#1a1a1a', color: epitaphFilter === type ? '#fff' : '#666', border: '1px solid ' + (epitaphFilter === type ? '#555' : '#2a2a2a') }}>
                    {type === 'all' ? '全部' : type}
                  </button>
                ))}
              </div>
              {Array.from(new Set(EPITAPH_REFS.filter(r => epitaphFilter === 'all' || r.type === epitaphFilter).map(r => r.type))).map(type => (
                <div key={type}>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{type}</div>
                  <div className="space-y-2">
                    {EPITAPH_REFS.filter(r => r.type === type).map((ref, i) => (
                      <div key={i} className="rounded-lg p-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                        <div className="text-white font-medium mb-1">{ref.epitaph}</div>
                        <div className="text-sm text-gray-500">{ref.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ──── Tab: 我的墓志铭 ──── */}
          {epitaphTab === 'write' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <p className="text-sm text-gray-500">写下你希望刻在墓碑上的话，从终点倒推当下。</p>

              {/* One liner */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">我的墓志铭一句话</label>
                <input value={epOneLiner} onChange={e => setEpOneLiner(e.target.value)} placeholder="例：这里躺着一个有趣的人，一辈子做了3款改变普通人效率的工具"
                       className="w-full rounded-lg px-4 py-3 text-white text-base outline-none placeholder-gray-600"
                       style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
              </div>

              {/* Evaluation */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">我希望在最后一天，别人如何评价我</label>
                <div className="space-y-2">
                  {([
                    ['事业', epCareer, setEpCareer],
                    ['品格', epCharacter, setEpCharacter],
                    ['关系', epRelationship, setEpRelationship],
                  ] as const).map(([label, val, set]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-8 flex-shrink-0">{label}</span>
                      <input value={val} onChange={e => set(e.target.value)} placeholder={label === '事业' ? '他做的产品帮上千万人提升了效率' : label === '品格' ? '他永远真诚，从不妥协底线' : '他是家人最坚实的依靠'}
                             className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder-gray-600"
                             style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Three works */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">我这一生最想留下的 3 件作品 / 成果</label>
                <div className="space-y-2">
                  {([
                    ['1', epWork1, setEpWork1],
                    ['2', epWork2, setEpWork2],
                    ['3', epWork3, setEpWork3],
                  ] as const).map(([n, val, set]) => (
                    <div key={n} className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-4 flex-shrink-0">{n}</span>
                      <input value={val} onChange={e => set(e.target.value)} placeholder={n === '1' ? '例：打造用户量破千万的效率工具' : n === '2' ? '例：出版一本个人成长畅销书' : '例：和家人环游世界50国'}
                             className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder-gray-600"
                             style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={saveEpitaph}
                      className="px-6 py-2.5 rounded-lg text-white font-medium text-sm hover:brightness-110 transition-all"
                      style={{ backgroundColor: '#333', border: '1px solid #444' }}>
                保存墓志铭
              </button>

              {epitaphData && (
                <div className="rounded-lg p-4 mt-2" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                  <div className="text-xs text-gray-500 mb-1">已保存</div>
                  <div className="text-white text-sm italic">&quot;{epitaphData.oneLiner}&quot;</div>
                </div>
              )}
            </div>
          )}

          {/* ──── Tab: 终局倒推 ──── */}
          {epitaphTab === 'deduce' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <p className="text-sm text-gray-500">从墓志铭出发，自动拆解为五大人生维度，生成年度OKR。</p>

              {!epitaphData ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-gray-400 text-sm">请先在「我的墓志铭」中写下你的终局目标</p>
                  <button onClick={() => setEpitaphTab('write')}
                          className="mt-4 px-4 py-2 rounded-lg text-white text-sm hover:brightness-110"
                          style={{ backgroundColor: '#333', border: '1px solid #444' }}>
                    去撰写
                  </button>
                </div>
              ) : (
                <>
                  {/* Epitaph reminder */}
                  <div className="rounded-lg p-4 text-center" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                    <div className="text-xs text-gray-500 mb-1">你的墓志铭</div>
                    <div className="text-white text-lg italic">&quot;{epitaphData.oneLiner}&quot;</div>
                  </div>

                  {/* Auto-deduce button */}
                  <button onClick={autoDeduceDimensions}
                          className="w-full py-2.5 rounded-lg text-white text-sm font-medium hover:brightness-110 transition-all"
                          style={{ background: 'linear-gradient(135deg, #333 0%, #444 100%)', border: '1px solid #555' }}>
                    ⚡ 自动从墓志铭拆解到五大维度
                  </button>

                  {/* 5 dimensions */}
                  <div className="space-y-3">
                    {LIFE_DIMENSIONS.map(dim => (
                      <div key={dim} className="rounded-lg p-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                        <div className="text-sm font-bold text-white mb-2">{dim}</div>
                        <input value={dimInputs[dim] || ''} onChange={e => setDimInputs(prev => ({ ...prev, [dim]: e.target.value }))}
                               placeholder={`${dim}方面的年度目标（点击上方自动拆解，或手动输入）`}
                               className="w-full rounded px-3 py-2 text-sm text-white outline-none placeholder-gray-600"
                               style={{ backgroundColor: '#111', border: '1px solid #333' }} />
                      </div>
                    ))}
                  </div>

                  <button onClick={generateOKRsFromEpitaph}
                          className="w-full py-3 rounded-lg text-white font-bold text-base hover:brightness-110 transition-all"
                          style={{ background: 'linear-gradient(135deg, #333 0%, #555 100%)', border: '1px solid #666' }}>
                    生成年度OKR →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // MAIN OKR WORKSPACE (left-right layout)
  // ═══════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: s.bg }}>
      {/* Epitaph summary top banner (if saved) */}
      {epitaphData && (
        <div className="flex-shrink-0 px-6 py-2 flex items-center gap-3 border-b"
             style={{ backgroundColor: '#1a1a1a', borderColor: '#333' }}>
          <span className="text-[10px] tracking-widest text-gray-500 flex-shrink-0">墓志铭</span>
          <span className="flex-1 text-xs text-gray-300 italic truncate">&quot;{epitaphData.oneLiner}&quot;</span>
          <button onClick={() => setShowEpitaph(true)} className="text-[10px] text-gray-500 hover:text-white transition-colors flex-shrink-0">
            编辑
          </button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">

      {/* ══════════ LEFT PANEL: OKR LIST ══════════ */}
      <div className="w-[480px] flex-shrink-0 flex flex-col border-r" style={{ backgroundColor: s.panelBg, borderColor: s.divider }}>

        {/* Header banner */}
        <div className="flex-shrink-0 px-5 pb-6 relative overflow-hidden" style={{ paddingTop: '1.5rem', ...(skin.headerBgImage ? { backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(135deg, ${skin.headerFrom} 0%, ${skin.headerTo} 100%)` }) }}>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${skin.sidebarFrom}cc, ${skin.sidebarTo}bb)` }} />
          <ParticleEffect color={skin.swatch} count={30} />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-wide text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>人生旅途</h2>
                  <button onClick={() => setShowEpitaph(true)}
                          className="px-2 py-0.5 rounded text-[11px] font-medium text-white/70 hover:text-white transition-colors"
                          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    终局 · 墓志铭
                  </button>
                </div>
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
              <button onClick={() => setShowEpitaph(true)} className="mt-3 text-xs hover:underline" style={{ color: swatch }}>
                或从墓志铭生成 →
              </button>
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
