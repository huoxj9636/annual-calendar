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
  focus: string;
  details: string[];
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
    focus: '建立安全感和好奇心，学会与世界建立信任',
    details: [
      '【认知】0-3岁是大脑发育黄金期，多与孩子说话、共读绘本，词汇量决定未来学习能力',
      '【情感】建立安全依恋关系，父母的及时回应是孩子一生自信的根基',
      '【习惯】养成规律作息，睡眠、饮食、运动的基本节律影响终身健康',
      '【社交】3岁后进入幼儿园，学会分享、排队、等待，这是社会化的起点',
      '【探索】保护好奇心，不要阻止孩子摸爬滚打，感官体验是认知的基础',
      '【语言】双语启蒙的窗口期，3岁前接触第二语言效果最佳',
      '【运动】大运动发育(跑跳攀爬)比精细动作更重要，多户外活动',
      '【品格】犯错时不要惩罚，要引导，"你试试看"比"不许"更有力量',
    ],
  },
  {
    range: '7-12', label: '童年', icon: '🌈', color: '#f59e0b',
    focus: '培养学习能力和一项持久兴趣，建立"我能行"的自我认知',
    details: [
      '【学习习惯】学会制定小计划并完成，番茄钟、任务清单从这时开始练习',
      '【阅读】从绘本过渡到文字书，每天30分钟阅读量直接影响理解力',
      '【一项运动】选择一项团体运动(篮球/足球/游泳)，坚持3年以上，培养韧性和团队意识',
      '【一项艺术】音乐/绘画/书法，不求考级，但要能沉浸其中',
      '【数学思维】不是刷题，是理解数量关系、空间想象、逻辑推理',
      '【社交】从玩伴到朋友，学会倾听和表达不同意见，处理小矛盾',
      '【家务】承担力所能及的家务，责任感不是教出来的，是做出来的',
      '【财商】开始管理零花钱，学会储蓄和延迟满足',
      '【屏幕】控制屏幕时间，但不要完全禁止，教会自律而非依赖管控',
    ],
  },
  {
    range: '13-18', label: '少年', icon: '⚡', color: '#3b82f6',
    focus: '寻找自我定位，建立价值观和独立思考能力',
    details: [
      '【身份认同】我是谁？我擅长什么？这些问题比成绩更重要，需要探索而非被安排',
      '【价值观】开始独立判断是非，父母的角色从"指挥官"变为"顾问"',
      '【学习方法】从被动接受到主动学习，学会记笔记、画思维导图、费曼学习法',
      '【深度兴趣】在1-2个领域深入钻研，参加竞赛/社团/项目，体验深度投入的快感',
      '【情商】学会管理情绪，特别是愤怒和焦虑，这是成人世界的核心竞争力',
      '【社交边界】理解个人空间和边界感，学会说"不"，也尊重别人的"不"',
      '【身体管理】青春期身体剧变，建立运动习惯和营养意识，这将影响30岁后的状态',
      '【职业启蒙】不要急着定方向，但要广泛接触：实习、访谈、职业体验日',
      '【逆商】第一次大考失利、第一次被拒绝，这些都是成长的必修课',
      '【数字素养】理解信息真假辨别、隐私保护、网络礼仪',
    ],
  },
  {
    range: '19-22', label: '青年前期', icon: '🎓', color: '#8b5cf6',
    focus: '选择专业方向，学会独立生活和深度学习',
    details: [
      '【专业选择】选你愿意花1万小时深入的方向，而不是"好就业"的方向',
      '【深度学习】大学最大的价值不是文凭，是学会如何快速掌握一个领域',
      '【第一次实习】越早越好，大二就开始，真实世界和课本完全不同',
      '【独立生活】理财、做饭、看病、租房，这些生存技能比GPA重要',
      '【人脉】大学同学是最纯粹的社交网络，深度交往5-10个值得长期交往的人',
      '【阅读升级】从教材到经典，每年至少读10本非专业领域的书',
      '【身体投资】20岁的运动习惯决定40岁的身体状态，每周至少3次运动',
      '【表达力】学会公开演讲、写文章、做PPT，这是所有职业的通用能力',
      '【试错】这是试错成本最低的时期，创业、gap year、换专业都值得尝试',
    ],
  },
  {
    range: '23-30', label: '青年', icon: '🚀', color: '#ec4899',
    focus: '确立职业方向，经济独立，建立深度关系',
    details: [
      '【职业方向】25岁前可以频繁切换，28岁后需要聚焦，30岁时应有清晰赛道',
      '【核心竞争力】找到你的"不可替代性"，T型人才(一专多能)最具竞争力',
      '【经济独立】先有存款再消费，建立3-6个月应急基金，拒绝消费主义陷阱',
      '【第一次跳槽】不要因为不舒服而跳，要因为成长空间而跳，每次跳槽薪资至少涨30%',
      '【深度关系】2-3个能托付后背的朋友，1段认真对待的感情，比100个点赞重要',
      '【健康底线】每年体检，关注心理健康，焦虑和抑郁不是矫情是病',
      '【认知升级】开始系统学习金融、法律、心理学，这三门课学校不教但社会必考',
      '【副业/创业】30岁前至少尝试一次，即使失败也是最好的MBA',
      '【家庭对话】理解父母的局限，完成心理上的"弑父弑母"(独立判断)',
      '【城市选择】一线城市的核心价值不是薪资，是认知密度和可能性',
    ],
  },
  {
    range: '31-40', label: '而立', icon: '💪', color: '#ef4444',
    focus: '职业上升期，组建家庭，开始长期主义思维',
    details: [
      '【职业上升】从执行者到管理者，学会通过他人拿结果，个人英雄主义到此为止',
      '【管理能力】不是"我最强"，而是"让团队最强"，这是35岁后最重要的能力',
      '【家庭建设】如果选择组建家庭，优先选择三观一致的伴侣，而非条件最优',
      '【买房决策】量力而行，不要让房贷压垮生活质量，租房不丢人',
      '【子女教育】身教大于言传，你的行为是孩子最大的教材',
      '【健康管理】代谢开始下降，每年增肌比减脂更重要，骨密度从35岁开始流失',
      '【财富增值】开始学习投资，复利的起点越早效果越惊人，但先学再投',
      '【时间管理】学会说不，把时间留给真正重要的人和事',
      '【情绪成熟】不再追求所有人的认可，接受"被误解是表达者的宿命"',
      '【长期主义】5年规划比年度目标更重要，做时间的朋友',
    ],
  },
  {
    range: '41-50', label: '不惑', icon: '🎯', color: '#f97316',
    focus: '事业巅峰期，关注传承和下一代，守住健康底线',
    details: [
      '【事业巅峰】这是职业收入的高峰期，但不要用命换钱，40岁后的健康债利滚利',
      '【传帮带】开始培养接班人，你的经验是组织最大的隐性资产',
      '【子女青春期】最难也最重要的阶段，倾听比说教有效100倍',
      '【中年危机】不是危机，是重新审视人生意义的机会，迷茫是正常的',
      '【健康红线】心血管、前列腺/乳腺、颈椎腰椎，这些是40+的四大杀手',
      '【资产配置】从追求增长转向保值，分散投资，降低风险敞口',
      '【关系经营】维护5-8个深度关系，比扩展500个弱连接更有价值',
      '【第二曲线】如果主业见顶，开始布局B计划，副业/投资/教学/写作',
      '【心理韧性】接受不完美，接受失控，这是中年人最重要的心理建设',
    ],
  },
  {
    range: '51-65', label: '知天命', icon: '🌅', color: '#14b8a6',
    focus: '从获取者变为给予者，规划退休，培养精神世界',
    details: [
      '【传帮带】将经验制度化、系统化，写书/做课/当顾问，让智慧不止于你',
      '【退休规划】55岁开始规划，60岁执行，财务自由=支出<被动收入',
      '【慢性病管理】高血压、糖尿病、关节退化，控制比治愈更现实',
      '【精神世界】培养1-2个深度的非功利爱好，书法/园艺/太极/摄影',
      '【空巢适应】子女独立后重新定义家庭关系，和伴侣重新认识彼此',
      '【社会参与】社区志愿者/行业协会/公益组织，从参与者变为组织者',
      '【旅行清单】60岁前去需要体力的地方(徒步/高原/远洋)，70岁后以休闲为主',
      '【遗产规划】不只是财产分配，更是价值观和家族故事的传承',
    ],
  },
  {
    range: '66-80', label: '古稀', icon: '🍂', color: '#a855f7',
    focus: '享受生命，传承智慧，与时间和解',
    details: [
      '【健康管理】每周3次以上适度运动(散步/太极/游泳)，保持社交活动延缓认知衰退',
      '【智慧传承】写回忆录/家族史/人生信条，这是给后代最珍贵的遗产',
      '【社交活跃】孤独比疾病更致命，保持至少每周1次深度社交',
      '【终身学习】学新技能(手机/互联网/新语言)保持大脑活力，预防阿尔茨海默',
      '【财务安全】不碰高风险投资，保住养老金，警惕针对老人的诈骗',
      '【与疾病共存】接受身体衰退是自然规律，重点是生活质量而非寿命长度',
      '【和解】与过去的遗憾和解，与疏远的亲友和解，与自己的不完美和解',
      '【活在当下】不再为未来焦虑，每个清晨都是礼物，认真过好每一天',
    ],
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
  const [stageProgress, setStageProgress] = useState<Record<string, Record<number, boolean>>>({});
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
    try { const s = localStorage.getItem('life-stage-progress'); if (s) setStageProgress(JSON.parse(s)); } catch { /* */ }
  }, []);

  const save = useCallback((g: Goal[]) => { setGoals(g); try { localStorage.setItem('life-goals', JSON.stringify(g)); } catch { /* */ } }, []);
  const saveLogs = useCallback((l: DailyLog[]) => { setDailyLogs(l); try { localStorage.setItem('life-daily-logs', JSON.stringify(l)); } catch { /* */ } }, []);
  const saveStage = useCallback((p: Record<string, Record<number, boolean>>) => { setStageProgress(p); try { localStorage.setItem('life-stage-progress', JSON.stringify(p)); } catch { /* */ } }, []);

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
  const viewStageProgress = viewingStage !== null ? (stageProgress[`${viewingStage}`] || {}) : {};

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: skin.panelBg }}>
      {/* Close button - fixed top right */}
      <button onClick={onClose} className="fixed top-4 right-5 z-[60] w-9 h-9 rounded-full flex items-center justify-center text-base font-bold hover:opacity-80 transition-opacity shadow-lg" style={{ background: skin.swatch, color: '#fff' }}>✕</button>

      {/* ===== LEFT: Header Banner + Stage/Plan List ===== */}
      <div className="w-[420px] flex-shrink-0 border-r flex flex-col" style={{ borderColor: skin.cellBorder }}>
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
              const sp = stageProgress[`${idx}`] || {};
              const doneCount = Object.values(sp).filter(Boolean).length;
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
                        {doneCount > 0 && (
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: doneCount >= stage.details.length ? '#22c55e' : stage.color, background: doneCount >= stage.details.length ? '#22c55e12' : `${stage.color}12` }}>{doneCount}/{stage.details.length}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs mt-1.5 leading-relaxed truncate" style={{ color: isCurrent ? stage.color : skin.textSecondary }}>{stage.focus}</p>
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
              <p className="text-lg mt-4 leading-relaxed font-semibold" style={{ color: viewStage.color }}>{viewStage.focus}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-10 py-8">
              <div className="space-y-4">
                {viewStage.details.map((detail, di) => {
                  const done = !!viewStageProgress[di];
                  const tagMatch = detail.match(/^【(.+?)】(.+)$/);
                  const tag = tagMatch ? tagMatch[1] : '';
                  const text = tagMatch ? tagMatch[2] : detail;
                  return (
                    <div key={di}
                      className="flex items-start gap-4 p-4 rounded-xl transition-all cursor-pointer hover:brightness-95"
                      style={{ background: done ? `${viewStage.color}08` : skin.cardBg, opacity: done ? 0.5 : 1 }}
                      onClick={() => toggleAction(viewingStage!, di)}>
                      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                        style={{ borderColor: done ? viewStage.color : skin.cellBorder, background: done ? viewStage.color : 'transparent' }}>
                        {done && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        {tag && <span className="inline-block text-[11px] px-2 py-0.5 rounded-md mr-2 font-bold mb-1" style={{ background: `${viewStage.color}15`, color: viewStage.color }}>{tag}</span>}
                        <span className={`text-base leading-relaxed ${done ? 'line-through' : ''}`} style={{ color: skin.textPrimary }}>{text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Progress */}
              <div className="mt-10 p-5 rounded-xl" style={{ background: skin.cardBg }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold" style={{ color: skin.textSecondary }}>完成进度</span>
                  <span className="text-lg font-black" style={{ color: viewStage.color }}>
                    {Object.values(viewStageProgress).filter(Boolean).length} / {viewStage.details.length}
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: skin.cellBorder }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.round(Object.values(viewStageProgress).filter(Boolean).length / viewStage.details.length * 100)}%`,
                    background: viewStage.color,
                  }} />
                </div>
              </div>
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
              <p className="text-sm mt-2" style={{ color: skin.textMuted }}>查看每个阶段应该做的事</p>
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
