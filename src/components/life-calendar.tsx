'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SKINS, NO_SKIN, DEFAULT_SKIN } from '@/lib/skins';
import type { SkinTheme } from '@/lib/skins';
import ParticleEffect from '@/components/particle-effect';

/* ============ Props ============ */
interface LifeCalendarProps {
  birthYear: number;
  setBirthYear: (y: number) => void;
  onClose: () => void;
  skinKey?: string;
}

/* ============ Life Stage Types ============ */
interface LifeStage {
  range: string;
  label: string;
  icon: string;
  color: string;
  /** 经典出处 — 孔子/埃里克森等 */
  classic: string;
  /** 一句话核心 */
  core: string;
  /** 反直觉认知：读了就刷新认知 */
  insights: string[];
  /** 别人踩过的坑：具体、真实 */
  pitfalls: string[];
  /** 一句话忠告 */
  motto: string;
}

/* ============ Goal / Step Types ============ */
type StepType = 'online' | 'offline' | 'collab';
type StepStatus = 'pending' | 'ai_doing' | 'waiting_user' | 'done';
type CompletedBy = 'ai' | 'user' | 'ai_user' | '';

interface Step {
  id: string;
  text: string;
  type: StepType;
  status: StepStatus;
  completedBy: CompletedBy;
  done: boolean;
  aiResult?: string;
  createdAt: number;
  completedAt?: number;
}
interface Goal {
  id: string;
  vision: string;
  duration: string;
  durationUnit: 'week' | 'month' | 'year';
  steps: Step[];
  createdAt: number;
}
interface DailyLog {
  date: string;
  goalId: string;
  pct: number;
  done: number;
  total: number;
}

/* ============ Life Stages Data ============ */
const LIFE_STAGES: LifeStage[] = [
  {
    range: '0-6', label: '幼年', icon: '🌱', color: '#22c55e',
    classic: '孔子："少成若天性，习惯成自然" · 埃里克森：基本信任 vs 不信任',
    core: '这个阶段的核心是建立对世界的基本信任感，安全感是一切的根基',
    insights: [
      '0-3岁大脑每秒建立100万个神经连接，是人生唯一的爆炸期，错过不可逆',
      '孩子哭闹时及时回应不会惯坏，反而让他学会"世界是可靠的"——这是未来自信的底层代码',
      '3岁前的词汇量差距到5岁时会扩大到3000万词，这不是天赋，是父母说话的频率决定的',
      '规律作息比早教班重要100倍，生物钟稳定的孩子情绪更稳定、免疫力更强',
    ],
    pitfalls: [
      '把孩子丢给屏幕"安静看"，0-6岁的屏幕时间每增加1小时，注意力缺陷风险增加50%',
      '以为孩子不记得就不需要陪伴，0-6岁形成的依恋模式影响一生的亲密关系',
      '过早教识字算数，反而挤占了感官探索的时间，运动和触觉才是大脑发育的真正燃料',
    ],
    motto: '你给的安全感，是他一生最坚固的地基',
  },
  {
    range: '7-12', label: '童年', icon: '🌈', color: '#f59e0b',
    classic: '孔子："蒙以养正，圣功也" · 埃里克森：勤奋 vs 自卑',
    core: '这个阶段的核心是建立"我能行"的自我认知，通过完成挑战获得胜任感',
    insights: [
      '7-12岁是养成习惯的黄金窗口，一个习惯一旦在此时扎根，到成年自动运行的概率超过80%',
      '这个阶段学会的"延迟满足"能力，比智商更能预测未来收入——棉花糖实验追踪40年证实',
      '坚持一项运动3年以上的孩子，抗挫折能力比不运动的孩子高3倍——身体的韧性会迁移到心理',
      '阅读量决定理解力，每天30分钟自主阅读的孩子，到12岁时理解力比不阅读的孩子领先2个学年',
    ],
    pitfalls: [
      '用分数衡量一切，孩子会把"我=成绩"，一次考差就崩盘',
      '报8个兴趣班不等于全面发展，什么都学等于什么都没学会，1-2项深度坚持才有积累效应',
      '代替孩子解决问题，他永远学不会面对困难，"你自己想想"比"我来帮你"更有远见',
    ],
    motto: '这个阶段种下的习惯，40岁还在替你工作',
  },
  {
    range: '13-18', label: '少年', icon: '⚡', color: '#3b82f6',
    classic: '孔子："志于学" · 埃里克森：自我认同 vs 角色混乱',
    core: '这个阶段的核心是找到"我是谁"，自我认同比任何技能都重要',
    insights: [
      '青春期大脑的杏仁核（情绪中心）发育早于前额叶（理性中心），所以少年冲动不是态度问题，是硬件问题',
      '15岁左右形成的自我评价体系，将影响30年——认为自己"不行"的人，会本能地回避挑战',
      '少年的叛逆不是对抗你，是在试探"我能不能自己做决定"——每次你允许他做主，他都在建立自我',
      '这个阶段交到的1-2个深度朋友，比100个泛泛之交更能影响他的社交模式',
    ],
    pitfalls: [
      '替孩子选一切——学校、专业、兴趣，他30岁时会迷茫"我到底想要什么"',
      '只关注成绩忽略社交，社交能力是成年人最被低估的核心竞争力',
      '禁止孩子犯错，青春期犯错的成本是人生最低的，被保护的少年成年后更容易崩溃',
    ],
    motto: '别替他选路，陪他学会选路',
  },
  {
    range: '19-22', label: '青年前期', icon: '🎓', color: '#8b5cf6',
    classic: '孔子："兴于诗，立于礼" · 埃里克森：亲密 vs 孤立',
    core: '这个阶段的核心是学会独立生活和深度学习，大学最大的价值不是文凭是能力',
    insights: [
      '大学期间建立的学习方法论，比专业选择更决定你的天花板——专业可以换，学习能力不会凭空出现',
      '20岁的身体是投资不是消费，每周3次运动存下的"健康储蓄"，40岁后利息远超你的想象',
      '大学的社交网络是人生唯一一次"纯粹的关系"，工作后所有关系都附带利益，深度经营5-10个人',
      '试错成本随年龄指数级上升，20岁创业失败是简历亮点，35岁创业失败是家庭灾难',
    ],
    pitfalls: [
      '为了"好就业"选专业，3年后行业变了你什么都没积累，选你愿意花1万小时的领域',
      '大学四年只读书不实习，毕业时你和岗位之间隔着一个真实世界',
      '以为GPA最重要，表达力（演讲、写作、PPT）才是所有职业的通用货币',
    ],
    motto: '这个阶段试错最便宜，别浪费',
  },
  {
    range: '23-30', label: '青年', icon: '🚀', color: '#ec4899',
    classic: '孔子："三十而立" · 埃里克森：建立亲密关系 vs 孤立',
    core: '这个阶段的核心是确立方向，经济独立，建立深度关系——立的是方向和根基',
    insights: [
      '25岁前可以频繁切换，28岁后必须聚焦——不是限制自由，是自由需要积累才能兑现',
      '3-6个月应急基金不是理财建议，是心理防线——没有存款的人没有说"不"的自由',
      '一线城市的核心价值不是薪资，是认知密度——你周围人的平均认知水平，就是你的天花板',
      '2-3个能托付后背的朋友，比500个微信好友值钱100倍，深度关系不会自动出现，需要你主动经营',
    ],
    pitfalls: [
      '为面子消费，30岁回头看，那些"必须买"的东西全是负债，真正的资产是技能、人脉和健康',
      '同时追三个目标等于一个都追不到，T型人才不是什么都做，是一专多能',
      '用忙碌回避"我到底要什么"这个问题，忙到30岁突然发现方向全错',
    ],
    motto: '30岁立不住没关系，怕的是30岁还在原地转',
  },
  {
    range: '31-40', label: '而立', icon: '💪', color: '#ef4444',
    classic: '孔子："三十而立，四十而不惑" · 埃里克森：繁衍 vs 停滞',
    core: '这个阶段的核心是深耕和深耕，从执行者变成决策者，从"我能做"到"我让别人能做"',
    insights: [
      '管理能力不是"我最强"，是"让团队最强"——个人英雄主义到35岁必须退休',
      '35岁后代谢每年下降1-2%，增肌比减脂更紧迫，骨密度从35岁开始不可逆地流失',
      '复利的起点越早效果越惊人——30岁开始每月投2000和40岁开始每月投5000，60岁时前者多',
      '5年规划比年度目标更有用，长期主义不是口号，是每个选择都在为5年后的自己铺路',
    ],
    pitfalls: [
      '用忙碌填满时间来回避战略思考，忙≠有价值，"不做什么"比"做什么"更难更重要',
      '把健康换钱，40岁后健康债利滚利——一次心梗能清空你十年的积蓄',
      '为了安全感拒绝变化，35-40岁是职业转型的最后窗口期，45岁后转换成本翻倍',
    ],
    motto: '深耕一件事的回报，是同时做五件事的十倍',
  },
  {
    range: '41-50', label: '不惑', icon: '🎯', color: '#f97316',
    classic: '孔子："四十而不惑" · 埃里克森：繁衍 vs 停滞（深化）',
    core: '这个阶段的核心是建立确定的价值体系，不再被外界评价绑架，从"能做"转向"该做"',
    insights: [
      '40岁后职业收入的边际效用急剧下降，时间比钱贵——学会用钱换时间，而不是反过来',
      '中年危机的本质：用20岁的操作系统跑40岁的人生，不是人生出问题了，是系统该升级了',
      '你的经验是组织最大的隐性资产，培养接班人不是让位，是让影响力倍增',
      '心血管、颈椎、腰椎、代谢综合征——这四个是40+的定时炸弹，每年体检不是可选是必选',
    ],
    pitfalls: [
      '觉得自己不可替代，结果真的不可替代——也就不可晋升',
      '忽视子女青春期，这是比事业更重要的阶段，陪伴的质量=倾听的时间×专注程度',
      '中年消费升级失控，收入在涨但支出涨得更快，50岁突然发现存不下钱',
    ],
    motto: '不惑不是什么都知道，是知道什么不重要',
  },
  {
    range: '51-65', label: '知天命', icon: '🌅', color: '#14b8a6',
    classic: '孔子："五十而知天命" · 埃里克森：自我整合 vs 绝望',
    core: '这个阶段的核心是认清边界与使命，从获取者变为给予者，让智慧不止于你',
    insights: [
      '55岁开始规划退休，60岁执行——财务自由的公式很简单：月支出 < 被动收入÷12',
      '55岁后每半年一次深度社交的老人，认知衰退速度比独居老人慢70%——孤独比疾病更致命',
      '将经验制度化的价值远超继续打工——写书、做课、当顾问，一份时间卖多次',
      '55岁前去需要体力的远方，70岁后只能看照片了——旅行的窗口期正在关闭',
    ],
    pitfalls: [
      '退而不休，用忙碌回避"我的价值是什么"这个问题，真正的退休是心理上的转型',
      '把全部积蓄投入"稳健理财"，通货膨胀每年吃掉3%，50岁后的投资失误没有时间弥补',
      '空巢后和伴侣无话可说，你们需要重新认识彼此——不是住在一起就叫在一起',
    ],
    motto: '知天命不是认命，是知道什么值得全力以赴',
  },
  {
    range: '66-80', label: '古稀', icon: '🍂', color: '#a855f7',
    classic: '孔子："六十而耳顺，七十而从心所欲不逾矩"',
    core: '这个阶段的核心是自在与圆满，接受生命的有限，在每个清晨里认真活着',
    insights: [
      '每周3次以上适度运动+深度社交的老人，阿尔茨海默发病率降低60%——动身体和动脑子同样重要',
      '写回忆录/家族史/人生信条的老人，抑郁率比不写的低40%——整理过去是给心灵做SPA',
      '学新技能的老人大脑灰质密度高于同龄人——70岁学用智能手机不是赶时髦，是给大脑续命',
      '与过去的遗憾和解，心理上"完成"的人生比物理上"更长"的人生更幸福',
    ],
    pitfalls: [
      '被"养生焦虑"绑架，花大钱买保健品不如每天散步30分钟+好好睡觉',
      '拒绝一切新事物，数字鸿沟会切断你和世界的联系——不会用手机=社会性死亡',
      '把所有精力放在担忧疾病上，恐惧比疾病本身更消耗生命',
    ],
    motto: '不再为未来焦虑，每个清晨都是礼物',
  },
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

/* ===== Tab type for right panel ===== */
type RightTab = 'stage' | 'plans';

export default function LifeCalendar({ birthYear, setBirthYear, onClose, skinKey }: LifeCalendarProps) {
  const [innerSkin] = useState(DEFAULT_SKIN);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [newDurIdx, setNewDurIdx] = useState(4);
  const [addText, setAddText] = useState('');
  const [addType, setAddType] = useState<StepType>('online');
  const [decomposing, setDecomposing] = useState(false);
  const [decompText, setDecompText] = useState('');
  const [aiExecId, setAiExecId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingStage, setViewingStage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<RightTab>('stage');
  const [stageGuide, setStageGuide] = useState('');
  const [guideStream, setGuideStream] = useState('');
  const [generatingGuide, setGeneratingGuide] = useState(false);
  const streamRef = useRef('');

  // Voice recognition
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const skin: SkinTheme = (skinKey ?? innerSkin) ? (SKINS.find(s => s.key === (skinKey ?? innerSkin)) ?? NO_SKIN) : NO_SKIN;
  const goal = goals.find(g => g.id === selId);
  const currentAge = birthYear ? new Date().getFullYear() - birthYear : 30;

  useEffect(() => {
    try { const s = localStorage.getItem('life-goals'); if (s) { const p = JSON.parse(s) as Goal[]; setGoals(p); if (p.length) setSelId(p[0].id); } } catch { /* */ }
    try { const s = localStorage.getItem('life-daily-logs'); if (s) setDailyLogs(JSON.parse(s)); } catch { /* */ }
  }, []);

  // Reset stage guide when switching stages
  useEffect(() => {
    setStageGuide(''); setGuideStream(''); setGeneratingGuide(false);
  }, [viewingStage]);

  const save = useCallback((g: Goal[]) => { setGoals(g); try { localStorage.setItem('life-goals', JSON.stringify(g)); } catch { /* */ } }, []);
  const saveLogs = useCallback((l: DailyLog[]) => { setDailyLogs(l); try { localStorage.setItem('life-daily-logs', JSON.stringify(l)); } catch { /* */ } }, []);

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

  // Create goal with vision text
  const createGoalWithVision = useCallback((vision: string) => {
    if (!vision.trim()) return;
    const dur = DURATIONS[newDurIdx];
    const g: Goal = {
      id: genId(), vision: vision.trim(), duration: dur.value, durationUnit: dur.unit,
      steps: [], createdAt: Date.now(),
    };
    const gs = [...goals, g]; save(gs); setSelId(g.id);
    setActiveTab('plans');
  }, [newDurIdx, goals, save]);

  // Add manual step
  const addStep = () => {
    if (!goal || !addText.trim()) return;
    updateGoal(goal.id, g => ({
      ...g, steps: [...g.steps, { id: genId(), text: addText.trim(), type: addType, status: 'pending', completedBy: '', done: false, createdAt: Date.now() }],
    }));
    setAddText('');
  };

  // AI decompose
  /* --- AI Stage Guide --- */
  const generateStageGuide = async () => {
    if (viewingStage === null || generatingGuide) return;
    const stage = LIFE_STAGES[viewingStage];
    setGeneratingGuide(true); setStageGuide(''); setGuideStream(''); streamRef.current = '';
    try {
      const prompt = `你是一位人生规划导师。用户当前${currentAge}岁，处于「${stage.label}」阶段（${stage.range}岁）。

经典框架指出这个阶段的核心是：${stage.core}

请为用户生成一份个性化的行动指南，包含：
1. 每日习惯（3-4项具体动作）
2. 每月行动（2-3项）
3. 阶段里程碑（3-4项这个阶段结束前应达成的目标）
4. 避坑清单（2-3项）

要求：
- 每一条都是具体可执行的动作，不是抽象建议
- 结合用户当前年龄给出针对性建议
- 语气直接，不要废话，不要鸡汤
- 格式清晰，用标题分隔四个部分`;

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], stream: true }),
      });
      if (!res.ok || !res.body) throw new Error('请求失败');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const d = line.slice(5).trim();
            if (d === '[DONE]') continue;
            try {
              const obj = JSON.parse(d);
              const c = obj.choices?.[0]?.delta?.content || '';
              if (c) { streamRef.current += c; setGuideStream(streamRef.current); }
            } catch { /* skip */ }
          }
        }
      }
      setStageGuide(streamRef.current);
    } catch {
      setStageGuide('生成失败，请重试');
    } finally {
      setGeneratingGuide(false);
    }
  };

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

  // Voice: click mic → record → auto create goal + auto decompose
  const startVoiceCreate = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('浏览器不支持语音识别'); return; }
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* */ } }
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalTranscript = '';
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setDecompText(finalTranscript + interim);
    };
    rec.onerror = () => { setIsListening(false); };
    rec.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        createGoalWithVision(finalTranscript.trim());
        setDecompText('');
      }
    };
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    setDecompText('');
    setActiveTab('plans');
  }, [createGoalWithVision]);

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* */ }
    }
    setIsListening(false);
  }, []);

  // Find current stage
  const currentStageIdx = LIFE_STAGES.findIndex(s => {
    const [lo, hi] = s.range.split('-').map(Number);
    return currentAge >= lo && currentAge <= hi;
  });

  // Stage being viewed on the right
  const viewStage = viewingStage !== null ? LIFE_STAGES[viewingStage] : null;

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: skin.panelBg }}>
      {/* Close button - fixed top right */}
      <button onClick={onClose} className="fixed top-4 right-5 z-[60] w-9 h-9 rounded-full flex items-center justify-center text-base font-bold hover:opacity-80 transition-opacity shadow-lg" style={{ background: skin.swatch, color: '#fff' }}>✕</button>

      {/* ===== LEFT: Header Banner + Stage/Plan List ===== */}
      <div className="w-[500px] flex-shrink-0 border-r flex flex-col" style={{ borderColor: skin.cellBorder }}>
        {/* Header Banner - same width as left panel, same height as main page header */}
        <header className="flex-shrink-0 relative overflow-hidden" style={{ height: 110 }}>
          {skin.headerBgImage ? (
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${skin.headerFrom} 0%, ${skin.headerTo} 100%)` }} />
          )}
          <div className="absolute inset-0" style={{ background: skin.headerBgOverlay }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.12) 50%, rgba(0,0,0,0.03) 100%)" }} />
          <ParticleEffect color={skin.swatch} count={20} />
          <div className="relative h-full flex flex-col justify-center px-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺</span>
              <h1 className="text-2xl font-black tracking-tight" style={{ color: skin.textPrimary, textShadow: `0 1px 2px ${skin.swatch}15` }}>
                人生旅途
              </h1>
            </div>
            <span className="text-[11px] font-medium mt-1" style={{ color: skin.textSecondary }}>0 ~ 80 岁人生蓝图</span>
            {currentStageIdx >= 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full w-fit" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <span className="text-xs">{LIFE_STAGES[currentStageIdx].icon}</span>
                <span className="text-[10px] font-bold" style={{ color: skin.textPrimary }}>{LIFE_STAGES[currentStageIdx].label} ({currentAge}岁)</span>
              </div>
            )}
          </div>
        </header>

        {/* Two main tabs: 人生阶段 / 我的计划 */}
        <div className="px-5 pt-3 pb-2 flex gap-2">
          <button onClick={() => { setActiveTab('stage'); setViewingStage(null); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: activeTab === 'stage' ? skin.swatch : skin.cardBg,
              color: activeTab === 'stage' ? '#fff' : skin.textMuted,
              boxShadow: activeTab === 'stage' ? `0 2px 8px ${skin.swatch}30` : 'none',
            }}>
            人生阶段
          </button>
          <button onClick={() => { setActiveTab('plans'); setViewingStage(null); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative"
            style={{
              background: activeTab === 'plans' ? skin.swatch : skin.cardBg,
              color: activeTab === 'plans' ? '#fff' : skin.textMuted,
              boxShadow: activeTab === 'plans' ? `0 2px 8px ${skin.swatch}30` : 'none',
            }}>
            我的计划
            {goals.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] flex items-center justify-center font-bold text-white px-1" style={{ background: '#ef4444' }}>{goals.length}</span>
            )}
          </button>
        </div>

        {/* Voice create + birth year row */}
        <div className="px-5 pb-3 flex items-center gap-3">
          <button onClick={isListening ? stopVoice : startVoiceCreate}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${isListening ? 'animate-pulse' : 'hover:opacity-80'}`}
            style={{ background: isListening ? '#ef4444' : skin.swatch, color: '#fff', boxShadow: `0 1px 4px ${isListening ? '#ef444440' : skin.swatch}20` }}
            title={isListening ? '停止录音' : '语音创建计划'}>
            {isListening ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            )}
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[11px]" style={{ color: skin.textMuted }}>出生年</span>
            <input type="number" value={birthYear || 1990} onChange={e => setBirthYear(Number(e.target.value))}
              className="w-16 rounded-lg border px-2 py-1 text-xs text-center focus:outline-none"
              style={{ background: skin.cardBg, borderColor: skin.cellBorder, color: skin.textPrimary }} />
            <span className="text-[11px] font-medium" style={{ color: skin.textSecondary }}>{currentAge}岁</span>
          </div>
        </div>

        {/* Voice listening indicator */}
        {isListening && (
          <div className="mx-5 mb-2 px-4 py-2.5 rounded-xl flex items-center gap-2.5" style={{ background: '#ef444412', border: '1px solid #ef444425' }}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-500 font-bold">正在聆听，说出你的计划...</span>
          </div>
        )}

        {/* ===== Stage list (when tab=stage) ===== */}
        {activeTab === 'stage' && (
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
            {LIFE_STAGES.map((stage, idx) => {
              const isCurrent = idx === currentStageIdx;
              const isSelected = viewingStage === idx;
              return (
                <div key={idx}
                  className={`rounded-xl transition-all cursor-pointer hover:brightness-95 ${isCurrent ? 'ring-1' : ''}`}
                  style={{
                    background: isSelected ? `${stage.color}18` : isCurrent ? `${stage.color}08` : skin.cardBg,
                    borderLeft: `3px solid ${isSelected ? stage.color : isCurrent ? stage.color : 'transparent'}`,
                    ...(isCurrent && !isSelected ? { boxShadow: `0 0 6px ${stage.color}15` } : {}),
                    ...(isSelected ? { boxShadow: `0 2px 8px ${stage.color}20` } : {}),
                  }}
                  onClick={() => setViewingStage(isSelected ? null : idx)}>
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{stage.icon}</span>
                        <span className="text-sm font-bold" style={{ color: isSelected || isCurrent ? stage.color : skin.textPrimary }}>{stage.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium" style={{ color: skin.textMuted }}>{stage.range}岁</span>
                      </div>
                    </div>
                    <p className="text-xs mt-1.5 leading-relaxed truncate" style={{ color: isCurrent ? stage.color : skin.textSecondary }}>{stage.core}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== Plans list (when tab=plans) ===== */}
        {activeTab === 'plans' && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* New plan button */}
            <button onClick={() => { setSelId(null); setViewingStage(null); }}
              className="w-full py-3 rounded-xl text-sm font-bold text-white mb-4 hover:opacity-90 transition-all"
              style={{ background: skin.swatch, boxShadow: `0 2px 8px ${skin.swatch}25` }}>
              + 新建计划
            </button>

            {goals.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-base font-medium" style={{ color: skin.textMuted }}>还没有计划</p>
                <p className="text-xs mt-2" style={{ color: skin.textSecondary }}>点击上方按钮或麦克风创建</p>
              </div>
            ) : (
              <div className="space-y-2">
                {goals.map(g => {
                  const pct = progress(g);
                  const isActive = selId === g.id;
                  return (
                    <div key={g.id} onClick={() => { setSelId(g.id); setViewingStage(null); }}
                      className="p-4 rounded-xl cursor-pointer transition-all hover:brightness-95"
                      style={{ background: isActive ? skin.cardBg : skin.cardBg, borderLeft: isActive ? `3px solid ${skin.swatch}` : '3px solid transparent', boxShadow: isActive ? `0 2px 8px ${skin.swatch}12` : 'none' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold truncate flex-1" style={{ color: isActive ? skin.swatch : skin.textPrimary }}>{g.vision}</span>
                        <span className="text-sm font-black shrink-0 ml-3" style={{ color: pct > 0 ? skin.swatch : skin.textMuted }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: skin.cellBorder }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: skin.swatch }} />
                      </div>
                      <p className="text-xs mt-2 font-medium" style={{ color: skin.textSecondary }}>
                        {g.duration}{g.durationUnit === 'week' ? '周' : g.durationUnit === 'month' ? '个月' : '年'} · 剩余{daysLeft(g)}天
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== RIGHT: Content Area ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stage detail view */}
        {activeTab === 'stage' && viewStage ? (
          <>
            <div className="px-10 pt-10 pb-6" style={{ borderBottom: `2px solid ${viewStage.color}30` }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${viewStage.color}15` }}>
                  <span className="text-3xl">{viewStage.icon}</span>
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight" style={{ color: viewStage.color }}>{viewStage.label}</h2>
                  <p className="text-base font-medium mt-0.5" style={{ color: skin.textSecondary }}>{viewStage.range}岁</p>
                </div>
              </div>
              <p className="text-lg mt-4 leading-relaxed font-semibold" style={{ color: viewStage.color }}>{viewStage.core}</p>
              <p className="text-sm mt-3 leading-relaxed italic" style={{ color: skin.textMuted }}>{viewStage.classic}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-10 py-8 space-y-10">
              {/* 反直觉认知 */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">💡</span>
                  <h3 className="text-base font-black" style={{ color: viewStage.color }}>反直觉认知</h3>
                </div>
                <div className="space-y-3">
                  {viewStage.insights.map((insight, i) => (
                    <div key={i} className="p-4 rounded-xl leading-relaxed text-[15px]"
                      style={{ background: `${viewStage.color}08`, borderLeft: `3px solid ${viewStage.color}` }}>
                      <span style={{ color: skin.textPrimary }}>{insight}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 别人踩过的坑 */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">⚠️</span>
                  <h3 className="text-base font-black" style={{ color: '#ef4444' }}>别人踩过的坑</h3>
                </div>
                <div className="space-y-3">
                  {viewStage.pitfalls.map((pit, i) => (
                    <div key={i} className="p-4 rounded-xl leading-relaxed text-[15px]"
                      style={{ background: '#ef444408', borderLeft: '3px solid #ef4444' }}>
                      <span style={{ color: skin.textPrimary }}>{pit}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 一句话忠告 */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🎯</span>
                  <h3 className="text-base font-black" style={{ color: viewStage.color }}>一句话忠告</h3>
                </div>
                <div className="p-5 rounded-xl text-lg font-bold leading-relaxed text-center"
                  style={{ background: `${viewStage.color}10`, color: viewStage.color }}>
                  「{viewStage.motto}」
                </div>
              </section>

              {/* AI 个性化行动指南 */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🤖</span>
                  <h3 className="text-base font-black" style={{ color: skin.swatch }}>个性化行动指南</h3>
                </div>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: skin.textMuted }}>
                  AI 结合你的年龄和现状，生成专属于你的行动清单
                </p>
                {stageGuide ? (
                  <div className="p-5 rounded-xl leading-relaxed text-[15px] whitespace-pre-wrap"
                    style={{ background: `${skin.swatch}08`, color: skin.textPrimary }}>
                    {stageGuide}
                  </div>
                ) : generatingGuide ? (
                  <div className="p-5 rounded-xl text-sm leading-relaxed"
                    style={{ background: skin.cardBg, color: skin.textSecondary }}>
                    <span className="animate-pulse">AI 正在生成...</span>
                    {guideStream && <span className="mt-2 block whitespace-pre-wrap">{guideStream}</span>}
                  </div>
                ) : (
                  <button onClick={generateStageGuide}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
                    style={{ background: skin.swatch, boxShadow: `0 2px 12px ${skin.swatch}30` }}>
                    获取行动指南
                  </button>
                )}
              </section>
            </div>
          </>
        ) : activeTab === 'stage' && !viewStage ? (
          /* Stage tab but no stage selected */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: `${skin.swatch}12` }}>
                <span className="text-4xl">🗺</span>
              </div>
              <p className="text-xl font-bold" style={{ color: skin.textPrimary }}>选择左侧的人生阶段</p>
              <p className="text-sm mt-2" style={{ color: skin.textMuted }}>查看经典人生框架与行动指南</p>
            </div>
          </div>
        ) : activeTab === 'plans' && goal ? (
          /* Goal detail view */
          <>
            <div className="px-8 py-6 border-b" style={{ borderColor: skin.cellBorder }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold" style={{ color: skin.textPrimary }}>{goal.vision}</h2>
                  <p className="text-sm mt-2 font-medium" style={{ color: skin.textSecondary }}>
                    周期: {goal.duration}{goal.durationUnit === 'week' ? '周' : goal.durationUnit === 'month' ? '个月' : '年'} · 剩余 <b style={{ color: daysLeft(goal) < 30 ? '#ef4444' : skin.swatch }}>{daysLeft(goal)}天</b>
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-black" style={{ color: skin.swatch }}>{todayPct(goal)}%</div>
                    <div className="text-[10px] font-medium mt-0.5" style={{ color: skin.textMuted }}>今日参与</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black" style={{ color: progress(goal) > 0 ? skin.swatch : skin.textMuted }}>{progress(goal)}%</div>
                    <div className="text-[10px] font-medium mt-0.5" style={{ color: skin.textMuted }}>总进度</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: skin.cellBorder }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress(goal)}%`, background: skin.swatch }} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              {/* AI Decompose */}
              <div className="mb-6">
                <button onClick={decompose} disabled={decomposing}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                  style={{ background: skin.swatch, boxShadow: `0 2px 8px ${skin.swatch}20` }}>
                  {decomposing ? 'AI拆解中...' : 'AI 拆解步骤'}
                </button>
                {decomposing && decompText && (
                  <div className="mt-3 p-4 rounded-xl text-xs whitespace-pre-wrap leading-relaxed" style={{ background: skin.cardBg, color: skin.textSecondary }}>{decompText}</div>
                )}
              </div>

              {/* Add step */}
              <div className="flex gap-2 mb-6">
                <input value={addText} onChange={e => setAddText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStep()}
                  placeholder="添加步骤..." className="flex-1 rounded-xl border px-4 py-2.5 text-sm focus:outline-none"
                  style={{ background: skin.cardBg, borderColor: skin.cellBorder, color: skin.textPrimary }} />
                <select value={addType} onChange={e => setAddType(e.target.value as StepType)}
                  className="rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: skin.cardBg, borderColor: skin.cellBorder, color: skin.textPrimary }}>
                  <option value="online">☁ 线上</option>
                  <option value="offline">📍 线下</option>
                  <option value="collab">🤝 协作</option>
                </select>
                <button onClick={addStep} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: skin.swatch }}>+</button>
              </div>

              {/* Steps list */}
              <div className="space-y-3">
                {goal.steps.map(step => {
                  const cfg = STEP_CFG[step.type];
                  const stCfg = STATUS_CFG[step.status];
                  const isExp = expandedId === step.id;
                  return (
                    <div key={step.id} className={`rounded-xl border p-4 transition-all ${step.done ? 'opacity-60' : ''}`}
                      style={{ background: skin.cardBg, borderColor: step.done ? skin.cellBorder : cfg.color + '40' }}>
                      <div className="flex items-start gap-3">
                        <span className="text-sm shrink-0 mt-0.5">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${step.done ? 'line-through' : ''}`} style={{ color: skin.textPrimary }}>{step.text}</span>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] px-2 py-0.5 rounded-md font-medium" style={{ background: cfg.color + '15', color: cfg.color }}>{cfg.label}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md font-medium" style={{ background: stCfg.color + '15', color: stCfg.color }}>{stCfg.label}</span>
                            {step.completedBy && <span className="text-[11px] font-medium" style={{ color: skin.textMuted }}>by {step.completedBy === 'ai' ? 'AI' : step.completedBy === 'user' ? '我' : '协作'}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!step.done && step.type !== 'offline' && step.status !== 'ai_doing' && (
                            <button onClick={() => aiExec(step.id)} disabled={aiExecId === step.id}
                              className="text-[11px] px-3 py-1 rounded-lg font-bold text-white disabled:opacity-50"
                              style={{ background: skin.swatch }}>AI执行</button>
                          )}
                          {step.status === 'waiting_user' && (
                            <button onClick={() => userDone(step.id)}
                              className="text-[11px] px-3 py-1 rounded-lg font-bold text-white"
                              style={{ background: '#22c55e' }}>该你了</button>
                          )}
                          {!step.done && step.type === 'offline' && (
                            <button onClick={() => userDone(step.id)}
                              className="text-[11px] px-3 py-1 rounded-lg font-bold"
                              style={{ background: '#f59e0b20', color: '#f59e0b' }}>完成</button>
                          )}
                          <button onClick={() => setExpandedId(isExp ? null : step.id)}
                            className="text-xs px-1.5 py-1 rounded-lg hover:opacity-70"
                            style={{ color: skin.textMuted }}>{isExp ? '▲' : '▼'}</button>
                          <button onClick={() => deleteStep(step.id)}
                            className="text-xs px-1.5 py-1 rounded-lg hover:opacity-70"
                            style={{ color: '#ef4444' }}>✕</button>
                        </div>
                      </div>
                      {isExp && step.aiResult && (
                        <div className="mt-3 p-3 rounded-lg text-xs whitespace-pre-wrap leading-relaxed" style={{ background: skin.panelBg, color: skin.textSecondary }}>{step.aiResult}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Recent logs */}
              {recentLogs.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-bold mb-3" style={{ color: skin.textSecondary }}>近7日参与度</h3>
                  <div className="flex gap-2">
                    {recentLogs.map((log, i) => (
                      <div key={i} className="flex-1 text-center">
                        <div className="h-10 rounded-lg flex items-end justify-center overflow-hidden" style={{ background: skin.cellBorder }}>
                          <div className="w-full rounded-t-lg" style={{ height: `${log.pct}%`, background: skin.swatch, minHeight: log.pct > 0 ? '2px' : '0' }} />
                        </div>
                        <div className="text-[10px] mt-1 font-medium" style={{ color: skin.textMuted }}>{log.pct}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 py-4 border-t flex justify-end" style={{ borderColor: skin.cellBorder }}>
              <button onClick={() => deleteGoal(goal.id)} className="text-xs px-4 py-2 rounded-lg font-medium" style={{ color: '#ef4444', background: '#ef444410' }}>删除计划</button>
            </div>
          </>
        ) : activeTab === 'plans' && !goal ? (
          /* Plans tab — no goal selected, show create form */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: `${skin.swatch}12` }}>
                <span className="text-4xl">🎯</span>
              </div>
              <p className="text-xl font-bold mb-2" style={{ color: skin.textPrimary }}>创建你的第一个长期计划</p>
              <p className="text-sm mb-8" style={{ color: skin.textMuted }}>点击麦克风说出你的计划，AI自动识别并拆解</p>
              <div className="flex items-center justify-center gap-5 mb-8">
                <button onClick={isListening ? stopVoice : startVoiceCreate}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isListening ? 'animate-pulse' : 'hover:opacity-80'}`}
                  style={{ background: isListening ? '#ef4444' : skin.swatch, color: '#fff', boxShadow: `0 4px 16px ${isListening ? '#ef444440' : skin.swatch}30` }}
                  title={isListening ? '停止录音' : '语音创建计划'}>
                  {isListening ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                  )}
                </button>
                <div className="text-left">
                  <p className="text-base font-bold" style={{ color: skin.textPrimary }}>语音创建</p>
                  <p className="text-sm" style={{ color: skin.textMuted }}>说出你的目标，AI自动拆解</p>
                </div>
              </div>
              {isListening && decompText && (
                <div className="mb-6 p-4 rounded-xl text-sm text-left leading-relaxed" style={{ background: skin.cardBg, color: skin.textPrimary }}>{decompText}</div>
              )}
              <div>
                <p className="text-xs mb-3 font-medium" style={{ color: skin.textMuted }}>或选择周期后手动输入</p>
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {DURATIONS.map((d, i) => (
                    <button key={i} onClick={() => setNewDurIdx(i)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: newDurIdx === i ? skin.swatch : skin.cardBg,
                        color: newDurIdx === i ? '#fff' : skin.textPrimary,
                        border: `1px solid ${newDurIdx === i ? skin.swatch : skin.cellBorder}`,
                      }}>{d.label}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input id="new-goal-input"
                    placeholder="输入你的目标..."
                    className="flex-1 rounded-xl border px-4 py-2.5 text-sm focus:outline-none"
                    style={{ background: skin.cardBg, borderColor: skin.cellBorder, color: skin.textPrimary }}
                    onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value; if (v.trim()) createGoalWithVision(v); } }} />
                  <button
                    onClick={() => { const el = document.querySelector<HTMLInputElement>('#new-goal-input'); if (el?.value.trim()) createGoalWithVision(el.value); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{ background: skin.swatch }}>创建</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
