'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SKINS, NO_SKIN, DEFAULT_SKIN, type SkinTheme } from '@/lib/skins';

interface LifeCalendarProps {
  birthYear: number; setBirthYear: (y: number) => void; onClose: () => void; skinKey?: string;
}

type StepType = 'online' | 'offline' | 'collab';
type StepStatus = 'pending' | 'ai_doing' | 'waiting_user' | 'user_doing' | 'done';
type CompletedBy = 'ai' | 'user' | 'ai_user' | '';

interface Step {
  id: string; text: string; type: StepType; status: StepStatus;
  completedBy: CompletedBy; done: boolean; aiResult?: string;
  createdAt: number; completedAt?: number;
}
interface Goal {
  id: string; vision: string; targetYear: number; steps: Step[]; createdAt: number;
}
interface DailyLog {
  date: string; goalId: string; pct: number; done: number; total: number;
}

const STEP_CFG: Record<StepType, { label: string; color: string; icon: string }> = {
  online: { label: '线上', color: '#3b82f6', icon: '☁' },
  offline: { label: '线下', color: '#f59e0b', icon: '📍' },
  collab: { label: '协作', color: '#8b5cf6', icon: '🤝' },
};
const STATUS_CFG: Record<StepStatus, { label: string; color: string }> = {
  pending: { label: '待执行', color: '#6b7280' },
  ai_doing: { label: 'AI处理中', color: '#3b82f6' },
  waiting_user: { label: '等你行动', color: '#f59e0b' },
  user_doing: { label: '进行中', color: '#8b5cf6' },
  done: { label: '已完成', color: '#22c55e' },
};

function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

export default function LifeCalendar({ birthYear, setBirthYear, onClose, skinKey }: LifeCalendarProps) {
  const [innerSkin] = useState(DEFAULT_SKIN);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newVision, setNewVision] = useState('');
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 10);
  const [addText, setAddText] = useState('');
  const [addType, setAddType] = useState<StepType>('online');
  const [decomposing, setDecomposing] = useState(false);
  const [decompText, setDecompText] = useState('');
  const [aiExecId, setAiExecId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const streamRef = useRef('');

  const skin: SkinTheme = (skinKey ?? innerSkin) ? (SKINS.find(s => s.key === (skinKey ?? innerSkin)) ?? NO_SKIN) : NO_SKIN;
  const goal = goals.find(g => g.id === selId);

  useEffect(() => {
    try { const s = localStorage.getItem('life-goals'); if (s) { const p = JSON.parse(s) as Goal[]; setGoals(p); if (p.length) setSelId(p[0].id); } } catch { /* */ }
    try { const s = localStorage.getItem('life-daily-logs'); if (s) setDailyLogs(JSON.parse(s)); } catch { /* */ }
  }, []);

  const save = useCallback((g: Goal[]) => { setGoals(g); try { localStorage.setItem('life-goals', JSON.stringify(g)); } catch { /* */ } }, []);
  const saveLogs = useCallback((l: DailyLog[]) => { setDailyLogs(l); try { localStorage.setItem('life-daily-logs', JSON.stringify(l)); } catch { /* */ } }, []);

  const progress = (g: Goal) => g.steps.length ? Math.round(g.steps.filter(s => s.done).length / g.steps.length * 100) : 0;
  const todayPct = (g: Goal) => {
    const ts = todayStart();
    const d = g.steps.filter(s => s.done && s.completedAt && s.completedAt >= ts).length;
    return g.steps.length ? Math.round(d / g.steps.length * 100) : 0;
  };

  const logUpdate = useCallback((gid: string, gs: Goal[]) => {
    const g = gs.find(x => x.id === gid);
    if (!g) return;
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

  // Create goal
  const createGoal = () => {
    if (!newVision.trim()) return;
    const g: Goal = { id: genId(), vision: newVision.trim(), targetYear: newYear, steps: [], createdAt: Date.now() };
    const gs = [...goals, g]; save(gs); setSelId(g.id);
    setNewVision(''); setNewYear(new Date().getFullYear() + 10); setCreating(false);
  };

  // Add manual step
  const addStep = () => {
    if (!goal || !addText.trim()) return;
    updateGoal(goal.id, g => ({ ...g, steps: [...g.steps, { id: genId(), text: addText.trim(), type: addType, status: 'pending', completedBy: '', done: false, createdAt: Date.now() }] }));
    setAddText('');
  };

  // AI decompose
  const decompose = async () => {
    if (!goal || decomposing) return;
    setDecomposing(true); setDecompText(''); streamRef.current = '';
    try {
      const res = await fetch('/api/life-decompose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vision: goal.vision, targetYear: goal.targetYear }),
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

  // User completes step
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

  // Delete goal
  const deleteGoal = (gid: string) => {
    const gs = goals.filter(g => g.id !== gid); save(gs);
    if (selId === gid) setSelId(gs.length ? gs[0].id : null);
  };

  // Delete step
  const deleteStep = (sid: string) => {
    if (!goal) return;
    updateGoal(goal.id, g => ({ ...g, steps: g.steps.filter(s => s.id !== sid) }));
  };

  // Recent logs
  const recentLogs = dailyLogs.filter(l => l.goalId === selId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  return (
    <div className="absolute inset-0 z-50 flex" style={{ background: skin.panelBg }}>
      {/* Close button */}
      <button onClick={onClose} className="absolute top-4 left-4 z-50 w-8 h-8 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition-opacity" style={{ background: skin.swatch, color: '#fff' }}>←</button>

      {/* Left: Goal List */}
      <div className="w-[320px] border-r flex flex-col" style={{ borderColor: skin.cellBorder }}>
        <div className="p-5 pt-14">
          <h2 className="text-xl font-bold" style={{ color: skin.swatch }}>人生旅途</h2>
          <p className="text-xs mt-1" style={{ color: skin.textMuted }}>锚定10年目标，拆解到每一天</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-2">
          {goals.map(g => {
            const pct = progress(g);
            const tp = todayPct(g);
            return (
              <div key={g.id} onClick={() => setSelId(g.id)}
                className="p-3 rounded-lg cursor-pointer transition-all border"
                style={{ background: selId === g.id ? skin.cardHover : skin.cardBg, borderColor: selId === g.id ? skin.swatch : 'transparent' }}>
                <div className="text-sm font-semibold truncate" style={{ color: skin.textPrimary }}>{g.vision}</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: skin.cellBorder }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: skin.swatch }} />
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: skin.swatch }}>{pct}%</span>
                </div>
                <div className="text-[10px] mt-1.5 flex justify-between" style={{ color: skin.textMuted }}>
                  <span>目标: {g.targetYear}年</span>
                  <span>今日参与: <b style={{ color: tp > 0 ? skin.swatch : skin.textMuted }}>{tp}%</b></span>
                </div>
              </div>
            );
          })}

          <button onClick={() => setCreating(true)}
            className="w-full p-3 rounded-lg border-2 border-dashed text-sm hover:opacity-80 transition-opacity"
            style={{ borderColor: skin.cellBorder, color: skin.textMuted }}>
            + 设定新目标
          </button>
        </div>

        {/* Create Goal Modal */}
        {creating && (
          <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="w-[360px] rounded-xl p-6 shadow-2xl" style={{ background: skin.panelBg }}>
              <h3 className="text-lg font-bold mb-4" style={{ color: skin.textPrimary }}>锚定你的10年目标</h3>
              <label className="text-xs font-medium mb-1 block" style={{ color: skin.textMuted }}>10年后，你想成为什么样的人？</label>
              <textarea value={newVision} onChange={e => setNewVision(e.target.value)} rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2"
                style={{ background: skin.cardBg, borderColor: skin.cellBorder, color: skin.textPrimary }}
                placeholder="例如：成为自由职业的设计师，每年旅居2个城市..." />
              <label className="text-xs font-medium mb-1 mt-3 block" style={{ color: skin.textMuted }}>目标年份</label>
              <input type="number" value={newYear} onChange={e => setNewYear(Number(e.target.value))}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ background: skin.cardBg, borderColor: skin.cellBorder, color: skin.textPrimary }} />
              <div className="flex gap-2 mt-4">
                <button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg text-sm" style={{ background: skin.cardBg, color: skin.textMuted }}>取消</button>
                <button onClick={createGoal} className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ background: skin.swatch }}>锚定目标</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Goal Detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {goal ? (
          <>
            {/* Header */}
            <div className="px-6 pt-14 pb-4 border-b" style={{ borderColor: skin.cellBorder }}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: skin.textPrimary }}>{goal.vision}</h2>
                  <p className="text-xs mt-1" style={{ color: skin.textMuted }}>目标: {goal.targetYear}年 | 距今 {goal.targetYear - new Date().getFullYear()} 年</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-black" style={{ color: skin.swatch }}>{todayPct(goal)}%</div>
                    <div className="text-[9px]" style={{ color: skin.textMuted }}>今日参与度</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black" style={{ color: progress(goal) > 0 ? skin.swatch : skin.textMuted }}>{progress(goal)}%</div>
                    <div className="text-[9px]" style={{ color: skin.textMuted }}>总进度</div>
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: skin.cellBorder }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress(goal)}%`, background: skin.swatch }} />
              </div>
            </div>

            {/* Steps */}
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

              {/* Add step manually */}
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
                        {/* Type badge */}
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: `${cfg.color}20`, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                        {/* Status badge */}
                        {!step.done && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${stCfg.color}20`, color: stCfg.color }}>{stCfg.label}</span>}
                        {/* Done badge */}
                        {step.done && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#22c55e20', color: '#22c55e' }}>✓ {step.completedBy === 'ai' ? 'AI完成' : step.completedBy === 'user' ? '你完成' : '协作完成'}</span>}
                        {/* Text */}
                        <span className={`flex-1 text-sm ${step.done ? 'line-through opacity-60' : ''}`} style={{ color: skin.textPrimary }}>{step.text}</span>
                        {/* Actions */}
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
                      {/* AI Result */}
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

            {/* Delete Goal */}
            <div className="px-6 py-3 border-t" style={{ borderColor: skin.cellBorder }}>
              <button onClick={() => { if (confirm('确定删除此目标？')) deleteGoal(goal.id); }}
                className="text-xs hover:underline" style={{ color: '#ef4444' }}>删除此目标</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-sm" style={{ color: skin.textMuted }}>设定你的10年目标，开始人生旅途</p>
              <button onClick={() => setCreating(true)}
                className="mt-4 px-6 py-2 rounded-lg text-sm font-bold text-white"
                style={{ background: skin.swatch }}>锚定目标</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
