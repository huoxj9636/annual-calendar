'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SKINS, NO_SKIN, DEFAULT_SKIN, type SkinTheme } from '@/lib/skins';

interface LifeCalendarProps {
  birthYear: number; setBirthYear: (y: number) => void; onClose: () => void; skinKey?: string;
}

/* ============ Life Stage Types ============ */
interface LifeStage {
  range: string; label: string; icon: string; color: string;
  actions: string[];
}
interface StageProgress {
  [stageKey: string]: { [actionIdx: number]: boolean };
}

/* ============ Goal / Step Types ============ */
type StepType = 'online' | 'offline' | 'collab';
type StepStatus = 'pending' | 'ai_doing' | 'waiting_user' | 'done';
type CompletedBy = 'ai' | 'user' | 'ai_user' | '';

interface Step {
  id: string; text: string; type: StepType; status: StepStatus;
  completedBy: CompletedBy; done: boolean; aiResult?: string;
  createdAt: number; completedAt?: number;
}
interface Goal {
  id: string; vision: string; duration: string; durationUnit: 'week' | 'month' | 'year';
  steps: Step[]; createdAt: number;
}
interface DailyLog {
  date: string; goalId: string; pct: number; done: number; total: number;
}

/* ============ Life Stages Data ============ */
const LIFE_STAGES: LifeStage[] = [
  { range: '0-6', label: '幼年', icon: '🌱', color: '#22c55e', actions: ['学会走路说话', '建立基本安全感', '培养好奇心'] },
  { range: '7-12', label: '童年', icon: '🌈', color: '#f59e0b', actions: ['养成学习习惯', '发展一项运动', '培养阅读兴趣'] },
  { range: '13-18', label: '少年', icon: '⚡', color: '#3b82f6', actions: ['确立价值观', '找到擅长领域', '建立朋友圈'] },
  { range: '19-22', label: '青年前期', icon: '🎓', color: '#8b5cf6', actions: ['选择专业方向', '第一次实习', '学会独立生活'] },
  { range: '23-30', label: '青年', icon: '🚀', color: '#ec4899', actions: ['确立职业方向', '经济独立', '建立深度关系', '第一次跳槽/创业'] },
  { range: '31-40', label: '而立', icon: '💪', color: '#ef4444', actions: ['职业上升期', '组建家庭', '买房安家', '管理团队'] },
  { range: '41-50', label: '不惑', icon: '🎯', color: '#f97316', actions: ['事业巅峰期', '子女教育', '健康管理', '财富增值'] },
  { range: '51-65', label: '知天命', icon: '🌅', color: '#14b8a6', actions: ['传帮带', '规划退休', '慢性病预防', '培养爱好'] },
  { range: '66-80', label: '古稀', icon: '🍂', color: '#a855f7', actions: ['享受生活', '健康管理', '传承智慧', '旅行体验'] },
];

const STEP_CFG: Record<StepType, { label: string; color: string; icon: string }> = {
  online: { label: '线上', color: '#3b82f6', icon: '☁' },
  offline: { label: '线下', color: '#f59e0b', icon: '📍' },
  collab: { label: '协作', color: '#8b5cf6', icon: '🤝' },
};
const STATUS_CFG: Record<StepStatus, { label: string; color: string }> = {
  pending: { label: '待执行', color: '#6b7280' },
  ai_doing: { label: 'AI处理中', color: '#3b82f6' },
  waiting_user: { label: '等你行动', color: '#f59e0b' },
  done: { label: '已完成', color: '#22c55e' },
};

const DURATIONS = [
  { value: '1', unit: 'week' as const, label: '1周' },
  { value: '2', unit: 'week' as const, label: '2周' },
  { value: '1', unit: 'month' as const, label: '1个月' },
  { value: '3', unit: 'month' as const, label: '3个月' },
  { value: '6', unit: 'month' as const, label: '半年' },
  { value: '1', unit: 'year' as const, label: '1年' },
  { value: '3', unit: 'year' as const, label: '3年' },
  { value: '5', unit: 'year' as const, label: '5年' },
  { value: '10', unit: 'year' as const, label: '10年' },
];

function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function calcDeadline(g: Goal): Date {
  const d = new Date(g.createdAt);
  const n = parseInt(g.duration);
  if (g.durationUnit === 'week') d.setDate(d.getDate() + n * 7);
  else if (g.durationUnit === 'month') d.setMonth(d.getMonth() + n);
  else d.setFullYear(d.getFullYear() + n);
  return d;
}
function daysLeft(g: Goal): number {
  const dl = calcDeadline(g);
  return Math.max(0, Math.ceil((dl.getTime() - Date.now()) / 86400000));
}

export default function LifeCalendar({ birthYear, setBirthYear, onClose, skinKey }: LifeCalendarProps) {
  const [innerSkin] = useState(DEFAULT_SKIN);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [stageProgress, setStageProgress] = useState<StageProgress>({});
  const [selId, setSelId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newVision, setNewVision] = useState('');
  const [newDurIdx, setNewDurIdx] = useState(4); // default: 半年
  const [addText, setAddText] = useState('');
  const [addType, setAddType] = useState<StepType>('online');
  const [decomposing, setDecomposing] = useState(false);
  const [decompText, setDecompText] = useState('');
  const [aiExecId, setAiExecId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const streamRef = useRef('');

  const skin: SkinTheme = (skinKey ?? innerSkin) ? (SKINS.find(s => s.key === (skinKey ?? innerSkin)) ?? NO_SKIN) : NO_SKIN;
  const goal = goals.find(g => g.id === selId);
  const currentAge = birthYear ? new Date().getFullYear() - birthYear : 30;

  useEffect(() => {
    try { const s = localStorage.getItem('life-goals'); if (s) { const p = JSON.parse(s) as Goal[]; setGoals(p); if (p.length) setSelId(p[0].id); } } catch { /* */ }
    try { const s = localStorage.getItem('life-daily-logs'); if (s) setDailyLogs(JSON.parse(s)); } catch { /* */ }
    try { const s = localStorage.getItem('life-stage-progress'); if (s) setStageProgress(JSON.parse(s)); } catch { /* */ }
  }, []);

  const save = useCallback((g: Goal[]) => { setGoals(g); try { localStorage.setItem('life-goals', JSON.stringify(g)); } catch { /* */ } }, []);
  const saveLogs = useCallback((l: DailyLog[]) => { setDailyLogs(l); try { localStorage.setItem('life-daily-logs', JSON.stringify(l)); } catch { /* */ } }, []);
  const saveStage = useCallback((p: StageProgress) => { setStageProgress(p); try { localStorage.setItem('life-stage-progress', JSON.stringify(p)); } catch { /* */ } }, []);

  const progress = (g: Goal) => g.steps.length ? Math.round(g.steps.filter(s => s.done).length / g.steps.length * 100) : 0;
  const todayPct = (g: Goal) => {
    const ts = todayStart();
    const d = g.steps.filter(s => s.done && s.completedAt && s.completedAt >= ts).length;
    return g.steps.length ? Math.round(d / g.steps.length * 100) : 0;
  };

  const logUpdate = useCallback((gid: string, gs: Goal[]) => {
    const g = gs.find(x => x.id === gid); if (!g) return;
    const today = todayStr(); const pct = todayPct(g);
    const ts = todayStart(); const d = g.steps.filter(s => s.done && s.completedAt && s.completedAt >= ts).length;
    const entry: DailyLog = { date: today, goalId: gid, pct, done: d, total: g.steps.length };
    const idx = dailyLogs.findIndex(l => l.date === today && l.goalId === gid);
    const logs = [...dailyLogs];
    if (idx >= 0) logs[idx] = entry; else logs.push(entry);
    saveLogs(logs);
  }, [dailyLogs, saveLogs]);

  const updateGoal = useCallback((gid: string, fn: (g: Goal) => Goal) => {
    const gs = goals.map(g => g.id === gid ? fn(g) : g);
    save(gs); logUpdate(gid, gs);
  }, [goals, save, logUpdate]);

  const toggleAction = (stageIdx: number, actionIdx: number) => {
    const key = `${stageIdx}`;
    const sp = { ...stageProgress };
    if (!sp[key]) sp[key] = {};
    sp[key][actionIdx] = !sp[key][actionIdx];
    saveStage(sp);
  };

  // Create goal
  const createGoal = () => {
    if (!newVision.trim()) return;
    const dur = DURATIONS[newDurIdx];
    const g: Goal = {
      id: genId(), vision: newVision.trim(), duration: dur.value, durationUnit: dur.unit,
      steps: [], createdAt: Date.now(),
    };
    const gs = [...goals, g]; save(gs); setSelId(g.id);
    setNewVision(''); setNewDurIdx(4); setCreating(false);
  };

  // Add manual step
  const addStep = () => {
    if (!goal || !addText.trim()) return;
    updateGoal(goal.id, g => ({
      ...g, steps: [...g.steps, { id: genId(), text: addText.trim(), type: addType, status: 'pending', completedBy: '', done: false, createdAt: Date.now() }],
    }));
    setAddText('');
  };

  // AI decompose
  const decompose = async () => {
    if (!goal || decomposing) return;
    setDecomposing(true); setDecompText(''); streamRef.current = '';
    try {
      const dur = goal.duration + (goal.durationUnit === 'week' ? '周' : goal.durationUnit === 'month' ? '个月' : '年');
      const res = await fetch('/api/life-decompose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vision: goal.vision, targetYear: dur }),
      });
      const reader = res.body?.getReader(); if (!reader) return;
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        dec.decode(value, { stream: true }).split('\n').forEach(line => {
          if (!line.startsWith('data: ')) return;
          const d = line.slice(6);
          if (d === '[DONE]') return;
          try { const j = JSON.parse(d); if (j.content) { streamRef.current += j.content; setDecompText(streamRef.current); } } catch { /* */ }
        });
      }
      const steps = streamRef.current.split('\n').filter(l => /^\d+[.、)\s]/.test(l.trim())).map(l => l.replace(/^\d+[.、)\s]+/, '').trim()).filter(Boolean);
      if (steps.length) {
        updateGoal(goal.id, g => ({
          ...g, steps: [...g.steps, ...steps.map(text => {
            const isOff = /见面|拜访|跑|走|去|到场|线下|实体|面对面/.test(text);
            const isCol = /协作|合作|对接|沟通|讨论|确认|审批/.test(text);
            return { id: genId(), text, type: (isCol ? 'collab' : isOff ? 'offline' : 'online') as StepType, status: 'pending' as StepStatus, completedBy: '' as CompletedBy, done: false, createdAt: Date.now() };
          })],
        }));
      }
    } catch { /* */ }
    setDecomposing(false);
  };

  // AI execute step
  const aiExec = async (sid: string) => {
    if (!goal) return;
    const step = goal.steps.find(s => s.id === sid);
    if (!step || step.type === 'offline') return;
    setAiExecId(sid); streamRef.current = '';
    updateGoal(goal.id, g => ({ ...g, steps: g.steps.map(s => s.id === sid ? { ...s, status: 'ai_doing' as StepStatus } : s) }));
    try {
      const res = await fetch('/api/life-execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: step.text, vision: goal.vision }),
      });
      const reader = res.body?.getReader(); if (!reader) return;
      const dec = new TextDecoder(); let result = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        dec.decode(value, { stream: true }).split('\n').forEach(line => {
          if (!line.startsWith('data: ')) return;
          const d = line.slice(6);
          try { const j = JSON.parse(d); if (j.content) result += j.content; } catch { /* */ }
        });
      }
      const newStatus: StepStatus = step.type === 'collab' ? 'waiting_user' : 'done';
      const newBy: CompletedBy = step.type === 'collab' ? 'ai' : 'ai';
      const newDone = step.type !== 'collab';
      updateGoal(goal.id, g => ({
        ...g, steps: g.steps.map(s => s.id === sid ? { ...s, status: newStatus, completedBy: newBy, done: newDone, aiResult: result, completedAt: newDone ? Date.now() : undefined } : s),
      }));
    } catch { /* */ }
    setAiExecId(null);
  };

  const userDone = (sid: string) => {
    if (!goal) return;
    updateGoal(goal.id, g => ({
      ...g, steps: g.steps.map(s => s.id === sid ? {
        ...s, done: true, status: 'done' as StepStatus,
        completedBy: (s.completedBy === 'ai' ? 'ai_user' : 'user') as CompletedBy,
        completedAt: Date.now(),
      } : s),
    }));
  };

  const deleteGoal = (gid: string) => {
    const gs = goals.filter(g => g.id !== gid); save(gs);
    if (selId === gid) setSelId(gs.length ? gs[0].id : null);
  };
  const deleteStep = (sid: string) => {
    if (!goal) return;
    updateGoal(goal.id, g => ({ ...g, steps: g.steps.filter(s => s.id !== sid) }));
  };

  const recentLogs = dailyLogs.filter(l => l.goalId === selId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  // Find current stage
  const currentStageIdx = LIFE_STAGES.findIndex(s => {
    const [lo, hi] = s.range.split('-').map(Number);
    return currentAge >= lo && currentAge <= hi;
  });

  return (
    <div className="absolute inset-0 z-50 flex" style={{ background: skin.panelBg }}>
      {/* Close button */}
      <button onClick={onClose} className="absolute top-4 left-4 z-50 w-8 h-8 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition-opacity" style={{ background: skin.swatch, color: '#fff' }}>←</button>

      {/* ===== LEFT: Life Stages ===== */}
      <div className="w-[340px] border-r flex flex-col" style={{ borderColor: skin.cellBorder }}>
        <div className="p-5 pt-14 pb-3">
          <h2 className="text-xl font-bold" style={{ color: skin.swatch }}>人生旅途</h2>
          <p className="text-xs mt-1" style={{ color: skin.textMuted }}>每个阶段，都有该做的事</p>
        </div>

        {/* Birth year */}
        <div className="px-5 pb-3 flex items-center gap-2">
          <span className="text-xs" style={{ color: skin.textMuted }}>出生年份</span>
          <input type="number" value={birthYear || 1990} onChange={e => setBirthYear(Number(e.target.value))}
            className="w-20 rounded border px-2 py-1 text-xs focus:outline-none"
            style={{ background: skin.cardBg, borderColor: skin.cellBorder, color: skin.textPrimary }} />
          <span className="text-xs" style={{ color: skin.textMuted }}>当前 {currentAge}岁</span>
        </div>

        {/* Stages */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {LIFE_STAGES.map((stage, idx) => {
            const sp = stageProgress[`${idx}`] || {};
            const doneCount = Object.values(sp).filter(Boolean).length;
            const total = stage.actions.length;
            const isCurrent = idx === currentStageIdx;
            return (
              <div key={idx}
                className={`rounded-lg p-3 transition-all ${isCurrent ? 'ring-2' : ''}`}
                style={{
                  background: isCurrent ? `${stage.color}10` : skin.cardBg,
                  borderLeft: `3px solid ${isCurrent ? stage.color : skin.cellBorder}`,
                  ...(isCurrent ? { boxShadow: `0 0 8px ${stage.color}30` } : {}),
                }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{stage.icon}</span>
                    <span className="text-sm font-bold" style={{ color: isCurrent ? stage.color : skin.textPrimary }}>{stage.label}</span>
                    <span className="text-[10px]" style={{ color: skin.textMuted }}>{stage.range}岁</span>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: doneCount === total && total > 0 ? '#22c55e' : skin.textMuted }}>
                    {doneCount}/{total}
                  </span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {stage.actions.map((act, ai) => (
                    <label key={ai} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={!!sp[ai]} onChange={() => toggleAction(idx, ai)}
                        className="w-3.5 h-3.5 rounded accent-current"
                        style={{ accentColor: stage.color }} />
                      <span className={`text-[11px] leading-tight ${sp[ai] ? 'line-through opacity-50' : ''}`}
                        style={{ color: skin.textPrimary }}>{act}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== RIGHT: Goal Management ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Goal Tabs */}
        <div className="px-5 pt-14 pb-0 flex items-center gap-2 border-b" style={{ borderColor: skin.cellBorder }}>
          <div className="flex-1 overflow-x-auto flex gap-1 pb-2">
            {goals.map(g => {
              const pct = progress(g);
              return (
                <button key={g.id} onClick={() => setSelId(g.id)}
                  className="shrink-0 px-3 py-1.5 rounded-t-lg text-xs font-medium transition-all flex items-center gap-1.5"
                  style={{
                    background: selId === g.id ? skin.cardBg : 'transparent',
                    color: selId === g.id ? skin.swatch : skin.textMuted,
                    borderBottom: selId === g.id ? `2px solid ${skin.swatch}` : '2px solid transparent',
                  }}>
                  <span className="truncate max-w-[100px]">{g.vision}</span>
                  <span className="text-[10px] font-bold" style={{ color: pct > 0 ? skin.swatch : skin.textMuted }}>{pct}%</span>
                </button>
              );
            })}
            <button onClick={() => setCreating(true)}
              className="shrink-0 px-3 py-1.5 text-xs rounded-t-lg hover:opacity-80"
              style={{ color: skin.textMuted }}>+ 新计划</button>
          </div>
        </div>

        {/* Goal Detail */}
        {goal ? (
          <>
            <div className="px-6 py-4 border-b" style={{ borderColor: skin.cellBorder }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-bold" style={{ color: skin.textPrimary }}>{goal.vision}</h2>
                  <p className="text-xs mt-1" style={{ color: skin.textMuted }}>
                    周期: {goal.duration}{goal.durationUnit === 'week' ? '周' : goal.durationUnit === 'month' ? '个月' : '年'} | 剩余 <b style={{ color: daysLeft(goal) < 30 ? '#ef4444' : skin.swatch }}>{daysLeft(goal)}天</b>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-black" style={{ color: skin.swatch }}>{todayPct(goal)}%</div>
                    <div className="text-[9px]" style={{ color: skin.textMuted }}>今日参与</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black" style={{ color: progress(goal) > 0 ? skin.swatch : skin.textMuted }}>{progress(goal)}%</div>
                    <div className="text-[9px]" style={{ color: skin.textMuted }}>总进度</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: skin.cellBorder }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress(goal)}%`, background: skin.swatch }} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* AI Decompose */}
              <div className="mb-4">
                <button onClick={decompose} disabled={decomposing}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: skin.swatch }}>
                  {decomposing ? 'AI拆解中...' : 'AI 拆解步骤'}
                </button>
                {decomposing && decompText && (
                  <div className="mt-2 p-3 rounded-lg text-xs whitespace-pre-wrap" style={{ background: skin.cardBg, color: skin.textMuted }}>{decompText}</div>
                )}
              </div>

              {/* Add step */}
              <div className="flex gap-2 mb-4">
                <input value={addText} onChange={e => setAddText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStep()}
                  placeholder="添加步骤..." className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{ background: skin.cardBg, borderColor: skin.cellBorder, color: skin.textPrimary }} />
                <select value={addType} onChange={e => setAddType(e.target.value as StepType)}
                  className="rounded-lg border px-2 py-2 text-sm"
                  style={{ background: skin.cardBg, borderColor: skin.cellBorder, color: skin.textPrimary }}>
                  <option value="online">☁ 线上</option>
                  <option value="offline">📍 线下</option>
                  <option value="collab">🤝 协作</option>
                </select>
                <button onClick={addStep} className="px-3 py-2 rounded-lg text-sm font-bold text-white" style={{ background: skin.swatch }}>+</button>
              </div>

              {/* Step list */}
              <div className="space-y-2">
                {goal.steps.map(step => {
                  const cfg = STEP_CFG[step.type];
                  const stCfg = STATUS_CFG[step.status];
                  const isExpanded = expandedId === step.id;
                  return (
                    <div key={step.id}
                      className="rounded-lg border transition-all"
                      style={{ background: step.done ? `${skin.swatch}10` : skin.cardBg, borderColor: step.done ? skin.swatch : skin.cellBorder }}>
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: `${cfg.color}20`, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                        {!step.done && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${stCfg.color}20`, color: stCfg.color }}>{stCfg.label}</span>}
                        {step.done && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#22c55e20', color: '#22c55e' }}>✓ {step.completedBy === 'ai' ? 'AI完成' : step.completedBy === 'user' ? '你完成' : '协作完成'}</span>}
                        <span className={`flex-1 text-sm ${step.done ? 'line-through opacity-60' : ''}`} style={{ color: skin.textPrimary }}>{step.text}</span>
                        <div className="flex items-center gap-1">
                          {step.type !== 'offline' && !step.done && step.status !== 'ai_doing' && (
                            <button onClick={() => aiExec(step.id)} disabled={aiExecId === step.id}
                              className="text-[10px] px-2 py-1 rounded font-bold text-white disabled:opacity-50"
                              style={{ background: '#3b82f6' }}>
                              {aiExecId === step.id ? '...' : 'AI执行'}
                            </button>
                          )}
                          {step.status === 'waiting_user' && (
                            <button onClick={() => userDone(step.id)}
                              className="text-[10px] px-2 py-1 rounded font-bold text-white"
                              style={{ background: '#f59e0b' }}>轮到我了</button>
                          )}
                          {!step.done && step.status === 'pending' && step.type === 'offline' && (
                            <button onClick={() => userDone(step.id)}
                              className="text-[10px] px-2 py-1 rounded font-bold text-white"
                              style={{ background: '#f59e0b' }}>完成</button>
                          )}
                          {step.aiResult && (
                            <button onClick={() => setExpandedId(isExpanded ? null : step.id)}
                              className="text-[10px] px-1.5 py-1 rounded"
                              style={{ background: skin.cardHover, color: skin.textMuted }}>详情</button>
                          )}
                          <button onClick={() => deleteStep(step.id)}
                            className="text-[10px] px-1.5 py-1 rounded opacity-50 hover:opacity-100"
                            style={{ color: skin.textMuted }}>✕</button>
                        </div>
                      </div>
                      {isExpanded && step.aiResult && (
                        <div className="px-3 pb-3 text-xs whitespace-pre-wrap" style={{ color: skin.textMuted, borderTop: `1px solid ${skin.cellBorder}` }}>
                          <div className="pt-2 font-bold mb-1" style={{ color: skin.swatch }}>AI 执行结果：</div>
                          {step.aiResult}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Daily Log */}
              {recentLogs.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-bold mb-2" style={{ color: skin.textPrimary }}>近7日参与度</h3>
                  <div className="flex gap-1 items-end h-16">
                    {recentLogs.map(log => (
                      <div key={log.date} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-sm transition-all" style={{
                          height: `${Math.max(log.pct, 4)}%`, background: log.pct > 0 ? skin.swatch : skin.cellBorder,
                        }} />
                        <span className="text-[8px]" style={{ color: skin.textMuted }}>{log.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t" style={{ borderColor: skin.cellBorder }}>
              <button onClick={() => { if (confirm('确定删除此计划？')) deleteGoal(goal.id); }}
                className="text-xs hover:underline" style={{ color: '#ef4444' }}>删除此计划</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-sm" style={{ color: skin.textMuted }}>创建一个长期计划，AI帮你拆解执行</p>
              <button onClick={() => setCreating(true)}
                className="mt-4 px-6 py-2 rounded-lg text-sm font-bold text-white"
                style={{ background: skin.swatch }}>创建计划</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Goal Modal */}
      {creating && (
        <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-[400px] rounded-xl p-6 shadow-2xl" style={{ background: skin.panelBg }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: skin.textPrimary }}>创建长期计划</h3>
            <label className="text-xs font-medium mb-1 block" style={{ color: skin.textMuted }}>你想达成什么目标？</label>
            <textarea value={newVision} onChange={e => setNewVision(e.target.value)} rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2"
              style={{ background: skin.cardBg, borderColor: skin.cellBorder, color: skin.textPrimary }}
              placeholder="例如：学会日语N2、转行做产品经理、跑一次马拉松..." />
            <label className="text-xs font-medium mb-2 mt-3 block" style={{ color: skin.textMuted }}>计划周期</label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d, i) => (
                <button key={i} onClick={() => setNewDurIdx(i)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: newDurIdx === i ? skin.swatch : skin.cardBg,
                    color: newDurIdx === i ? '#fff' : skin.textMuted,
                    border: `1px solid ${newDurIdx === i ? skin.swatch : skin.cellBorder}`,
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg text-sm" style={{ background: skin.cardBg, color: skin.textMuted }}>取消</button>
              <button onClick={createGoal} className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ background: skin.swatch }}>创建计划</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
