'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SKINS } from '@/lib/skins';
import ParticleEffect from '@/components/particle-effect';

interface LifeCalendarProps {
  visible: boolean;
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

// ── Life Map Stages ──

function LifeMapView({ birthYear, skin }: { birthYear: number; skin: typeof SKINS[0]; swatch: string }) {
  const s = { text1: skin.textPrimary, text2: skin.textSecondary, textMuted: skin.textMuted, panelBg: skin.panelBg, cardBg: skin.cardBg, divider: skin.divider };
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;
  const totalLifespan = 80;
  const progress = Math.min(currentAge / totalLifespan, 1);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgProgress, setImgProgress] = useState(0);

  // Simulate progress while image loads
  useEffect(() => {
    if (imgLoaded) return;
    setImgProgress(0);
    const steps = [20, 40, 55, 65, 72, 78, 83, 87, 90, 93, 95];
    let i = 0;
    const timer = setInterval(() => {
      if (i < steps.length) {
        setImgProgress(steps[i]);
        i++;
      }
    }, 300);
    return () => clearInterval(timer);
  }, [imgLoaded]);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm" style={{ color: s.text1 }}>
          <span className="font-bold text-lg">{birthYear}</span>
          <span style={{ color: s.textMuted }}> → </span>
          <span className="font-bold text-lg">{birthYear + totalLifespan}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: s.textMuted }}>当前 {currentAge} 岁</span>
          <div className="w-40 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: s.cardBg }}>
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg, #4ade80, #facc15, #f97316, #a78bfa)' }} />
          </div>
          <span className="text-sm font-bold" style={{ color: s.text1 }}>{Math.round(progress * 100)}%</span>
        </div>
      </div>

      {/* Life Map Image */}
      <div className="relative w-full rounded-xl overflow-hidden shadow-lg" style={{ border: `1px solid ${s.divider}`, minHeight: '300px', backgroundColor: '#1a1a2e' }}>
        {/* Loading progress */}
        {!imgLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ backgroundColor: '#1a1a2e' }}>
            <div className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>地图加载中...</div>
            <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${imgProgress}%`, background: 'linear-gradient(90deg, #60a5fa, #a78bfa)' }}
              />
            </div>
            <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{imgProgress}%</div>
          </div>
        )}
        <img
          src="/life-map.jpeg"
          alt="人生地图"
          className="w-full h-auto block"
          style={{ maxHeight: '65vh', objectFit: 'contain', backgroundColor: '#1a1a2e', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
          onLoad={() => { setImgProgress(100); setTimeout(() => setImgLoaded(true), 200); }}
        />
        {/* Age overlay labels */}
        <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
          <div className="flex justify-between text-[10px] text-white/70">
            <span>出生 0岁</span>
            <span>童年 6岁</span>
            <span>少年 13岁</span>
            <span>青年 19岁</span>
            <span>而立 30岁</span>
            <span>不惑 40岁</span>
            <span>知天命 50岁</span>
            <span>花甲 60岁</span>
            <span>古稀 70岁+</span>
          </div>
        </div>
      </div>

      {/* Wisdom */}
      <div className="text-center">
        <div className="text-xs italic" style={{ color: s.textMuted }}>
          &ldquo;人生如旅，每一站都有独特的风景。珍惜当下，不负此行。&rdquo;
        </div>
      </div>
    </div>
  );
}

// ── Component ──
export default function LifeCalendar({ visible, birthYear, setBirthYear, onClose, skinKey }: LifeCalendarProps) {
  const skin = SKINS.find(s => s.key === skinKey) || SKINS[0];
  const swatch = skin.swatch || '#6558c1';
  const currentYear = new Date().getFullYear();

  const [goals, setGoals] = useState<OKRObjective[]>([]);
  const [period, setPeriod] = useState<PeriodType>('annual');
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

  // Goal discovery flow
  const [discoveryState, setDiscoveryState] = useState<'idle' | 'scanning' | 'selecting' | 'generating' | 'previewing'>('idle');

  const [discoveredThemes, setDiscoveredThemes] = useState<Array<{ keyword: string; count: number; pattern: string; suggestion: string; source?: string }>>([]);
  const [discoveryMessage, setDiscoveryMessage] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [pendingOKR, setPendingOKR] = useState<OKRObjective | null>(null);
  const [addedThemes, setAddedThemes] = useState<Set<string>>(new Set());
  const [helpTooltipPos, setHelpTooltipPos] = useState<{top: number, left: number} | null>(null);

  const year = new Date().getFullYear();
  const periodKey = period === 'annual' ? `${year}` : `${year}-${period}`;

  const [loading, setLoading] = useState(true);

  // Mount immediately so the panel renders instantly
  useEffect(() => { setMounted(true); }, []);

  // Load from API (with localStorage migration) — async, non-blocking
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/okr');
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.objectives) {
            const parsed = migrateGoals(data.objectives);
            setGoals(parsed);
            setExpandedKRs(new Set(parsed.flatMap(o => o.children.map(kr => kr.id))));
            if (parsed.length > 0) setSelectedOId(parsed[0].id);
          } else if (data.goals) {
            const parsed = migrateGoals(data.goals);
            setGoals(parsed);
            setExpandedKRs(new Set(parsed.flatMap(o => o.children.map(kr => kr.id))));
            if (parsed.length > 0) setSelectedOId(parsed[0].id);
          } else {
            // Migrate from localStorage if DB is empty
            try {
              const lsOKR = localStorage.getItem('life-calendar-okr');
              if (lsOKR) {
                const okrData = JSON.parse(lsOKR);
                if (okrData && (Array.isArray(okrData) || okrData.objectives)) {
                  const goalsArr = Array.isArray(okrData) ? okrData : okrData.objectives || [];
                  const parsed = migrateGoals(goalsArr);
                  if (parsed.length > 0) {
                    setGoals(parsed);
                    setExpandedKRs(new Set(parsed.flatMap(o => o.children.map(kr => kr.id))));
                    setSelectedOId(parsed[0].id);
                    await fetch('/api/okr', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ objectives: parsed }),
                    });
                    localStorage.removeItem('life-calendar-okr');
                  }
                }
              }
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
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

  // Save via API — only after initial load completes
  useEffect(() => { if (mounted && !loading) fetch('/api/okr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objectives: goals }) }).catch(() => {}); }, [goals, mounted, loading]);

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
    setDiscoveryState('idle');
  }, [newOTitle, periodKey]);

  // Goal discovery: scan reviews
  const startDiscovery = useCallback(async () => {
    setDiscoveryState('scanning');
    setAddedThemes(new Set());
    try {
      const res = await fetch('/api/discover-goals');
      const data = await res.json();
      if (data.themes && data.themes.length > 0) {
        setDiscoveredThemes(data.themes);
        const stats = data.signalStats;
        const statParts = [];
        if (stats?.checkPatterns > 0) statParts.push(`勾叉模式${stats.checkPatterns}条`);
        if (stats?.shouldSentences > 0) statParts.push(`"应该"${stats.shouldSentences}条`);
        if (stats?.againSentences > 0) statParts.push(`"又"${stats.againSentences}条`);
        if (stats?.noteContent > 0) statParts.push(`笔记${stats.noteContent}条`);
        if (stats?.canceledTodos > 0) statParts.push(`未完成待办${stats.canceledTodos}条`);
        const statMsg = statParts.length > 0 ? `（信号：${statParts.join('、')}）` : '';
        setDiscoveryMessage(data.message + statMsg);
        setDiscoveryState('selecting');
      } else {
        setDiscoveredThemes([]);
        setDiscoveryMessage(data.message || '暂未发现明显模式');
        setDiscoveryState('selecting');
      }
    } catch {
      setDiscoveryMessage('扫描失败，请稍后重试');
      setDiscoveryState('idle');
    }
  }, []);

  // Goal discovery: generate OKR from selected theme
  const generateOKRFromTheme = useCallback(async (theme: string) => {
    setSelectedTheme(theme);
    setDiscoveryState('generating');
    setPendingOKR(null);
    try {
      const res = await fetch('/api/generate-okr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json();
      if (data.error) {
        setDiscoveryMessage(data.error);
        setDiscoveryState('selecting');
        return;
      }
      // Create the objective with KRs and tasks, but DON'T add yet — preview first
      const o: OKRObjective = {
        id: genId(),
        title: data.objective || theme,
        period: periodKey,
        children: (data.keyResults || []).map((kr: { title: string; targetValue: number; tasks: string[] }) => ({
          id: genId(),
          title: kr.title,
          targetValue: kr.targetValue || 100,
          children: (kr.tasks || []).map((t: string) => ({
            id: genId(),
            title: t,
            done: false,
            createdAt: Date.now(),
          })),
          createdAt: Date.now(),
        })),
        createdAt: Date.now(),
      };
      setPendingOKR(o);
      setDiscoveryState('previewing');
    } catch {
      setDiscoveryMessage('生成失败，请稍后重试');
      setDiscoveryState('selecting');
    }
  }, [periodKey]);

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
    setExpandedKRs(prev => new Set([...prev, ...newKRs.map(kr => kr.id)]));
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

  if (!mounted) return null; // SSR guard only

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
    <div className="fixed inset-0 z-50 flex pointer-events-none"
      style={{ backgroundColor: visible ? s.bg : 'transparent', transition: 'background-color 0.3s ease' }}>
      {/* 遮罩层 */}
      {visible && (
        <div className="absolute inset-0 pointer-events-auto" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onClick={onClose} />
      )}

      {/* ══════════ LEFT PANEL ══════════ */}
      <div
        className={`w-[480px] flex-shrink-0 flex flex-col border-r relative z-10 ${visible ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{
          backgroundColor: s.panelBg,
          borderColor: s.divider,
          transform: visible ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >

        {/* Header banner */}
        <div className="flex-shrink-0 px-5 pb-5 relative overflow-hidden" style={{ paddingTop: '1.2rem', ...(skin.headerBgImage ? { backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(135deg, ${skin.headerFrom} 0%, ${skin.headerTo} 100%)` }) }}>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${skin.sidebarFrom}cc, ${skin.sidebarTo}bb)` }} />
          <ParticleEffect color={skin.swatch} count={30} />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-wide text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>人生旅途 · OKR</h2>
                <div className="flex items-center gap-2 mt-2 text-xs text-white/70">
                  <span>出生年份</span>
                  <input type="number" value={birthYear} onChange={e => setBirthYear(Number(e.target.value))}
                    className="w-16 px-1.5 py-0.5 rounded text-center text-xs border focus:outline-none bg-white/20 text-white border-white/20" />
                  <span className="text-white/40">|</span>
                  <span>当前 {currentYear - birthYear} 岁</span>
                  <button onClick={() => setShowTemplates(true)}
                    className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white/80 hover:bg-white/30 hover:text-white transition-colors border border-white/10">
                    地图
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

        {/* Objective list + Discovery flow */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* OKR list (always show when there are goals) */}
          {filteredGoals.length > 0 && filteredGoals.map((o, oi) => {
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
          {/* Continue discovery button (when goals exist and discovery is idle) */}
          {filteredGoals.length > 0 && discoveryState === 'idle' && (
            <div className="px-5 py-3">
              <button onClick={startDiscovery}
                className="w-full rounded-lg py-2 text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                style={{ backgroundColor: swatch + '12', color: swatch, border: `1px solid ${swatch}25` }}>
                <span>🔍</span> 继续发现目标
              </button>
            </div>
          )}

          {/* Discovery flow (show when idle+no goals, or when actively scanning/selecting/previewing) */}
          {(discoveryState !== 'idle' || filteredGoals.length === 0) && (
          <div className="px-5 py-6">
              {discoveryState === 'idle' && (
                <div className="flex flex-col items-center gap-4">
                  {/* Discovery card */}
                  <div className="w-full rounded-xl p-5 text-left transition-all"
                    style={{ backgroundColor: swatch + '12', border: `1px solid ${swatch}25` }}>
                    <div className="mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🔍</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <div className="font-bold text-base" style={{ color: s.text1 }}>发现你的年度目标</div>
                            <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center cursor-default text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: swatch + '25', color: swatch }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHelpTooltipPos({ top: rect.top, left: rect.right + 8 });
                              }}
                              onMouseLeave={() => setHelpTooltipPos(null)}>
                              ?
                            </div>
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: s.textMuted }}>从复盘中发现你的反复模式</div>
                        </div>
                      </div>
                    </div>

                    <button onClick={startDiscovery}
                      className="w-full rounded-lg py-2 text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
                      style={{ backgroundColor: swatch + '20', color: swatch }}>
                      开始
                    </button>
                  </div>
                  {/* Manual add hint */}
                  <div className="text-center" style={{ color: s.textMuted }}>
                    <p className="text-xs">或直接在上方输入框创建目标</p>
                  </div>
                </div>
              )}
              {discoveryState === 'scanning' && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: swatch + '40', borderTopColor: 'transparent' }} />
                    <span className="absolute inset-0 flex items-center justify-center text-xl">🔍</span>
                  </div>
                  <p className="text-sm" style={{ color: s.text2 }}>正在扫描你的复盘数据...</p>
                </div>
              )}
              {discoveryState === 'selecting' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium" style={{ color: s.text1 }}>
                      {discoveredThemes.length > 0 ? '选择你想改变的方向' : (discoveryMessage || '选择你最想改变的方向')}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setDiscoveryState('idle'); setDiscoveredThemes([]); setSelectedTheme(null); }}
                        className="text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                        style={{ backgroundColor: s.cardBg, color: s.textMuted, border: `1px solid ${s.divider}` }}>
                        取消
                      </button>
                    </div>
                  </div>
                  {discoveredThemes.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {discoveredThemes.map((t) => {
                        const isAdded = addedThemes.has(t.keyword);
                        return (
                          <button key={t.keyword} onClick={() => !isAdded && generateOKRFromTheme(t.keyword)}
                            className="w-full rounded-lg p-3.5 text-left transition-all cursor-pointer"
                            style={{ 
                              backgroundColor: isAdded ? swatch + '06' : swatch + '10', 
                              border: `1px solid ${isAdded ? swatch + '10' : swatch + '20'}`,
                              opacity: isAdded ? 0.5 : 1
                            }}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm" style={{ color: swatch }}>{t.keyword}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: swatch + '18', color: swatch }}>{t.count}次</span>
                              {t.source && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: s.panelBg, color: s.textMuted }}>{t.source}</span>}
                              {isAdded && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#22c55e18', color: '#22c55e' }}>已添加</span>}
                            </div>
                            <div className="text-xs" style={{ color: s.text2 }}>{t.pattern}</div>
                            <div className="text-[10px] mt-1" style={{ color: s.textMuted }}>{t.suggestion}</div>
                          </button>
                        );
                      })}
                      {/* Custom theme input */}
                      <div className="flex items-center gap-2 mt-1">
                        <input type="text" placeholder="或自己输入方向..."
                          className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                          style={{ backgroundColor: s.panelBg, border: `1px solid ${s.divider}`, color: s.text1 }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                              generateOKRFromTheme((e.target as HTMLInputElement).value.trim());
                            }
                          }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <p className="text-xs" style={{ color: s.textMuted }}>{discoveryMessage}</p>
                      <input type="text" placeholder="输入你想改变的方向..."
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ backgroundColor: s.panelBg, border: `1px solid ${s.divider}`, color: s.text1 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                            generateOKRFromTheme((e.target as HTMLInputElement).value.trim());
                          }
                        }} />
                    </div>
                  )}
                </div>
              )}
              {discoveryState === 'generating' && selectedTheme && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: swatch + '40', borderTopColor: 'transparent' }} />
                    <span className="absolute inset-0 flex items-center justify-center text-xl">✨</span>
                  </div>
                  <p className="text-sm" style={{ color: s.text2 }}>正在围绕「{selectedTheme}」生成OKR...</p>
                  <p className="text-xs" style={{ color: s.textMuted }}>AI正在拆解可执行的目标和步骤</p>
                </div>
              )}
              {discoveryState === 'previewing' && pendingOKR && (
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium" style={{ color: s.text1 }}>
                    预览生成的OKR
                  </div>
                  {/* OKR Preview Card */}
                  <div className="rounded-lg p-4" style={{ backgroundColor: swatch + '08', border: `1px solid ${swatch}20` }}>
                    <div className="mb-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: swatch + '18', color: swatch }}>目标</span>
                      <p className="text-sm font-semibold mt-1.5" style={{ color: s.text1 }}>{pendingOKR.title}</p>
                    </div>
                    {pendingOKR.children.map((kr, ki) => (
                      <div key={kr.id} className="ml-3 mb-2.5 pl-3" style={{ borderLeft: `2px solid ${swatch}30` }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: swatch + '12', color: swatch }}>KR{ki + 1}</span>
                          <span className="text-xs font-medium" style={{ color: s.text1 }}>{kr.title}</span>
                        </div>
                        {kr.children.length > 0 && (
                          <div className="ml-4 flex flex-col gap-0.5">
                            {kr.children.map(task => (
                              <div key={task.id} className="flex items-center gap-1.5 text-[11px]" style={{ color: s.text2 }}>
                                <span style={{ color: swatch }}>○</span> {task.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      // Confirm: add the OKR and expand all KRs
                      setGoals(prev => [...prev, pendingOKR]);
                      setSelectedOId(pendingOKR.id);
                      setAddedThemes(prev => new Set(prev).add(selectedTheme!));
                      setExpandedKRs(prev => new Set([...prev, ...pendingOKR.children.map(kr => kr.id)]));
                      setPendingOKR(null);
                      setSelectedTheme(null);
                      setDiscoveryState('selecting'); // Go back to select more
                    }}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 cursor-pointer"
                      style={{ backgroundColor: swatch, color: '#fff' }}>
                      添加到目标
                    </button>
                    <button onClick={() => {
                      // Cancel: discard and go back to select another
                      setPendingOKR(null);
                      setSelectedTheme(null);
                      setDiscoveryState('selecting');
                    }}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                      style={{ backgroundColor: s.cardBg, color: s.text2, border: `1px solid ${s.divider}` }}>
                      不添加
                    </button>
                  </div>
                </div>
              )}
          </div>
          )}
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
      <div className={`flex-1 overflow-y-auto ${visible ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{
          backgroundColor: s.panelBg,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(20px)',
          transition: 'opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s',
        }}>
        {!selectedO ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: s.textMuted }}>
            <svg className="w-14 h-14 mb-4 opacity-25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            <p className="text-sm">选择左侧目标查看详情</p>
          </div>
        ) : (() => {
          const o = selectedO;
          const oPct = Math.round(oProgress(o) * 100);
          const krCount = o.children.length;
          const taskDone = o.children.reduce((a, kr) => a + kr.children.filter(t => t.done).length, 0);
          const taskTotal = o.children.reduce((a, kr) => a + kr.children.length, 0);
          return (
            <div className="p-5 space-y-4">

              {/* ── O Header: circular progress + info ── */}
              <div className="rounded-2xl p-5" style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                <div className="flex items-start gap-4">
                  {/* Circular progress */}
                  <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
                    <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke={s.progressTrack} strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="15.5" fill="none"
                        stroke={oPct >= 100 ? '#22c55e' : swatch} strokeWidth="2.5"
                        strokeDasharray={`${oPct} 100`} strokeLinecap="round"
                        className="transition-all duration-700" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold" style={{ color: oPct > 0 ? swatch : s.textMuted }}>{oPct}%</span>
                    </div>
                  </div>
                  {/* Title & stats */}
                  <div className="flex-1 min-w-0">
                    {editingId === o.id ? (
                      <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                             onBlur={() => saveTitle(o.id)}
                             onKeyDown={e => { if (e.key === 'Enter') saveTitle(o.id); if (e.key === 'Escape') setEditingId(null); }}
                             className="w-full text-base font-bold outline-none bg-transparent px-1 mb-1"
                             style={{ color: s.text1, borderBottom: `1.5px solid ${swatch}` }} />
                    ) : (
                      <h2 className="text-base font-bold cursor-text hover:opacity-80 mb-1 leading-snug" style={{ color: s.text1 }}
                          onClick={() => { setEditingId(o.id); setEditText(o.title); }}>
                        <span style={{ color: swatch }}>O{goals.findIndex(g => g.id === o.id) + 1}</span> {o.title}
                      </h2>
                    )}
                    <div className="flex items-center gap-3 text-xs" style={{ color: s.textMuted }}>
                      <span>{krCount} 个关键结果</span>
                      <span>·</span>
                      <span>已完成 {taskDone}/{taskTotal} 任务</span>
                    </div>
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${s.divider}` }}>
                  <button onClick={() => decomposeOKR(o.id)} disabled={aiDecompose.loading}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                          style={{ backgroundColor: `${swatch}15`, color: swatch, border: `1px solid ${swatch}30` }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {aiDecompose.loading && aiDecompose.objectiveId === o.id ? '拆解中...' : 'AI 拆解'}
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => deleteObjective(o.id, o.title)}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-70"
                          style={{ color: '#ef4444', backgroundColor: '#ef444410', border: '1px solid #ef444420' }}>删除目标</button>
                </div>
              </div>

              {/* ── Add KR ── */}
              <div className="rounded-xl flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: swatch }}>+ KR</span>
                <input type="text" value={newKRTitle} onChange={e => setNewKRTitle(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && addKR(o.id)}
                       placeholder="添加关键结果..." className="flex-1 text-sm outline-none bg-transparent"
                       style={{ color: s.text1 }} />
                <button onClick={voiceKR.phase !== 'idle' ? undefined : voiceKR.start}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all flex-shrink-0 hover:opacity-70"
                        style={{ color: voiceKR.phase !== 'idle' ? swatch : s.textMuted, backgroundColor: voiceKR.phase !== 'idle' ? `${swatch}15` : 'transparent' }}
                        disabled={voiceKR.phase !== 'idle'}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
                {newKRTitle.trim() && (
                  <button onClick={() => addKR(o.id)} className="text-xs font-bold flex-shrink-0 px-2 py-1 rounded-lg transition-all hover:opacity-80"
                    style={{ color: '#fff', backgroundColor: swatch }}>添加</button>
                )}
              </div>

              {/* ── KR Cards ── */}
              {o.children.map((kr, kri) => {
                const krPct = Math.round(krProgress(kr) * 100);
                const doneTasks = kr.children.filter(t => t.done).length;
                return (
                  <div key={kr.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                    {/* KR header */}
                    <div className="px-4 pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        {editingId === kr.id ? (
                          <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                                 onBlur={() => saveTitle(kr.id)}
                                 onKeyDown={e => { if (e.key === 'Enter') saveTitle(kr.id); if (e.key === 'Escape') setEditingId(null); }}
                                 className="flex-1 text-sm font-medium outline-none bg-transparent px-1"
                                 style={{ color: s.text1, borderBottom: `1.5px solid ${swatch}` }} />
                        ) : (
                          <span className="flex-1 text-sm font-medium truncate cursor-text hover:opacity-80" style={{ color: s.text1 }}
                                onClick={() => { setEditingId(kr.id); setEditText(kr.title); }}>
                            <span style={{ color: swatch, fontWeight: 700 }}>KR{kri + 1}</span> {kr.title}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {editingTargetValue === kr.id ? (
                            <input autoFocus type="number" min={1} value={editingTargetValue}
                                   onChange={e => setEditingTargetValue(e.target.value)}
                                   onBlur={() => saveTargetValue(o.id, kr.id)}
                                   onKeyDown={e => { if (e.key === 'Enter') saveTargetValue(o.id, kr.id); if (e.key === 'Escape') setEditingTargetValue(null); }}
                                   className="w-10 text-center text-xs outline-none rounded px-1 py-0.5"
                                   style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                          ) : (
                            <span className="text-[10px] cursor-pointer hover:opacity-70" style={{ color: s.textMuted }}
                                  onClick={() => setEditingTargetValue(kr.id)}>
                              目标{kr.targetValue}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${swatch}12`, color: swatch }}>
                            {doneTasks}/{kr.children.length}
                          </span>
                          <span className="text-xs font-bold" style={{ color: krPct > 0 ? swatch : s.textMuted }}>{krPct}%</span>
                          <button onClick={() => deleteKR(o.id, kr.id, kr.title)}
                                  className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:opacity-80 transition-opacity"
                                  style={{ color: '#ef4444' }}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2">{pb(krPct, 4)}</div>
                    </div>

                    {/* Tasks */}
                    {kr.children.length > 0 && (
                      <div className="px-4 pb-2">
                        {kr.children.map(t => (
                          <div key={t.id} className="group flex items-center gap-2 py-1.5"
                               style={{ borderBottom: `1px solid ${s.divider}20` }}>
                            <button onClick={() => toggleTask(o.id, kr.id, t.id)}
                                    className="w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center transition-all"
                                    style={{ border: `1.5px solid ${t.done ? '#22c55e' : s.textMuted}40`, backgroundColor: t.done ? '#22c55e' : 'transparent' }}>
                              {t.done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </button>
                            {editingId === t.id ? (
                              <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                                     onBlur={() => saveTitle(t.id)}
                                     onKeyDown={e => { if (e.key === 'Enter') saveTitle(t.id); if (e.key === 'Escape') setEditingId(null); }}
                                     className={`flex-1 text-xs leading-relaxed outline-none bg-transparent px-0.5 ${t.done ? 'line-through' : ''}`}
                                     style={{ color: t.done ? s.textMuted : s.text1, borderBottom: `1.5px solid ${swatch}` }} />
                            ) : (
                              <span className={`flex-1 text-xs leading-relaxed cursor-text ${t.done ? 'line-through' : ''}`} style={{ color: t.done ? s.textMuted : s.text2 }}
                                    onClick={() => { setEditingId(t.id); setEditText(t.title); }}>{t.title}</span>
                            )}
                            <button onClick={() => deleteTask(o.id, kr.id, t.id, t.title)}
                                    className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:opacity-70 transition-opacity flex-shrink-0"
                                    style={{ color: '#ef4444' }}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add task */}
                    <div className="px-4 pb-3 flex items-center gap-2">
                      <svg className="w-3 h-3 flex-shrink-0" style={{ color: swatch }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <input type="text" value={getTaskInput(kr.id)} onChange={e => setTaskInput(kr.id, e.target.value)}
                             onFocus={() => setActiveKRId(kr.id)}
                             onKeyDown={e => e.key === 'Enter' && addTask(o.id, kr.id)}
                             placeholder="添加任务..." className="flex-1 text-xs outline-none bg-transparent"
                             style={{ color: s.text1 }} />
                      <button onClick={voiceTask.phase !== 'idle' ? undefined : () => { setActiveKRId(kr.id); voiceTask.start(); }}
                              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors hover:opacity-70"
                              style={{ color: voiceTask.phase !== 'idle' ? swatch : s.textMuted }}
                              disabled={voiceTask.phase !== 'idle'}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                      </button>
                      {getTaskInput(kr.id).trim() && (
                        <button onClick={() => addTask(o.id, kr.id)} className="text-[10px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded transition-all hover:opacity-80"
                          style={{ color: '#fff', backgroundColor: swatch }}>添加</button>
                      )}
                    </div>
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-auto" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
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

      {/* ══════════ LIFE MAP PANEL ══════════ */}
      {showTemplates && (
        <div className="fixed inset-0 z-[60] flex pointer-events-auto" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="m-auto w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col" style={{ backgroundColor: s.panelBg }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: s.divider }}>
              <h3 className="text-lg font-bold" style={{ color: s.text1 }}>人生地图</h3>
              <button onClick={() => setShowTemplates(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:opacity-80" style={{ backgroundColor: s.cardBg, color: s.text2 }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Life Map */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <LifeMapView birthYear={birthYear} skin={skin} swatch={swatch} />
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Delete confirmation ══════════ */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-auto" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-auto" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
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

      {helpTooltipPos && (
        <div className="fixed z-[9999] w-80 rounded-xl p-5 text-xs leading-relaxed"
          style={{ top: helpTooltipPos.top, left: helpTooltipPos.left, backgroundColor: s.cardBg, border: `1px solid ${swatch}30`, boxShadow: `0 8px 32px ${swatch}20`, color: s.text2 }}>
          <div className="font-medium mb-2 text-sm" style={{ color: s.text1 }}>6大数据源</div>
          <ul className="space-y-1.5 ml-3" style={{ listStyle: 'disc' }}>
            <li>日历勾叉模式 — 连续✗、工作日周末落差</li>
            <li>"应该"句式 — 你自己说了想做但没做</li>
            <li>"又"字句式 — 承认反复失败（最强信号）</li>
            <li>导入的笔记内容 — 你关心的事</li>
            <li>未完成待办 — 有意愿但执行困难</li>
            <li>AI深度分析 — 发现深层反复模式</li>
          </ul>
          <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${swatch}20`, color: s.textMuted }}>
            追溯范围：最近3个月（数据不足时逐步扩展至6个月、12个月）
          </div>
        </div>
      )}
    </div>
  );
}
