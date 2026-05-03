'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SKINS, NO_SKIN, DEFAULT_SKIN } from '@/lib/skins';
import ParticleEffect from '@/components/particle-effect';

interface LifeCalendarProps {
  birthYear: number;
  setBirthYear: (year: number) => void;
  onClose: () => void;
  /** 当前选中的皮肤 key，与父组件共享 */
  skinKey?: string;
  /** 点击年份格子时回调，切换年历到对应年份 */

}

interface ActionItem {
  id: string;
  text: string;
  done: boolean;
  addedToCalendar: boolean;
}

interface Category {
  key: string;
  title: string;
  icon: string;
  actions: ActionItem[];
}

interface Stage {
  key: string;
  label: string;
  range: string;
  emoji: string;
  start: number;
  end: number;
  slogan: string;
  categories: Category[];
}

const STAGES: Stage[] = [
  {
    key: 'childhood', label: '童年', range: '0-5岁', emoji: '🌱', start: 0, end: 5,
    slogan: '万物皆可探索',
    categories: [
      { key: 'body', title: '身体成长', icon: '🏃', actions: [
        { id: 'c1', text: '学会独立走路和跑步', done: false, addedToCalendar: false },
        { id: 'c2', text: '能自己用筷子吃饭', done: false, addedToCalendar: false },
        { id: 'c3', text: '每天户外活动至少1小时', done: false, addedToCalendar: false },
        { id: 'c4', text: '学会骑儿童自行车', done: false, addedToCalendar: false },
        { id: 'c5', text: '养成早睡早起的作息', done: false, addedToCalendar: false },
      ]},
      { key: 'mind', title: '认知启蒙', icon: '🧠', actions: [
        { id: 'c6', text: '认识26个英文字母', done: false, addedToCalendar: false },
        { id: 'c7', text: '能数到100', done: false, addedToCalendar: false },
        { id: 'c8', text: '每天亲子阅读20分钟', done: false, addedToCalendar: false },
        { id: 'c9', text: '学会10首儿歌', done: false, addedToCalendar: false },
        { id: 'c10', text: '认识常见动物和植物', done: false, addedToCalendar: false },
      ]},
      { key: 'emotion', title: '情感培养', icon: '❤️', actions: [
        { id: 'c11', text: '学会说"我爱你"和"谢谢"', done: false, addedToCalendar: false },
        { id: 'c12', text: '能表达自己的开心和难过', done: false, addedToCalendar: false },
        { id: 'c13', text: '建立安全感，知道家人永远在', done: false, addedToCalendar: false },
        { id: 'c14', text: '学会和小朋友分享玩具', done: false, addedToCalendar: false },
      ]},
      { key: 'social', title: '社交萌芽', icon: '🤝', actions: [
        { id: 'c15', text: '交到第一个好朋友', done: false, addedToCalendar: false },
        { id: 'c16', text: '学会排队和轮流', done: false, addedToCalendar: false },
        { id: 'c17', text: '在集体活动中不哭闹', done: false, addedToCalendar: false },
      ]},
    ]
  },
  {
    key: 'youth', label: '少年', range: '6-11岁', emoji: '🌿', start: 6, end: 11,
    slogan: '好奇心是最棒的老师',
    categories: [
      { key: 'study', title: '学业基础', icon: '📚', actions: [
        { id: 'y1', text: '养成每天按时完成作业的习惯', done: false, addedToCalendar: false },
        { id: 'y2', text: '找到一门最喜欢的学科', done: false, addedToCalendar: false },
        { id: 'y3', text: '读完整套《十万个为什么》', done: false, addedToCalendar: false },
        { id: 'y4', text: '学会查字典和独立找资料', done: false, addedToCalendar: false },
        { id: 'y5', text: '参加一次学科竞赛或考试', done: false, addedToCalendar: false },
      ]},
      { key: 'hobby', title: '兴趣发展', icon: '🎨', actions: [
        { id: 'y6', text: '选择一项运动并坚持练习1年', done: false, addedToCalendar: false },
        { id: 'y7', text: '学会一种乐器的基础演奏', done: false, addedToCalendar: false },
        { id: 'y8', text: '完成一幅自己满意的画作', done: false, addedToCalendar: false },
        { id: 'y9', text: '学会做3道简单的菜', done: false, addedToCalendar: false },
      ]},
      { key: 'character', title: '品格塑造', icon: '💎', actions: [
        { id: 'y10', text: '学会承认错误并道歉', done: false, addedToCalendar: false },
        { id: 'y11', text: '坚持做完一件困难的事', done: false, addedToCalendar: false },
        { id: 'y12', text: '每月做一件帮助别人的事', done: false, addedToCalendar: false },
        { id: 'y13', text: '学会管理自己的零花钱', done: false, addedToCalendar: false },
      ]},
      { key: 'explore', title: '视野拓展', icon: '🌍', actions: [
        { id: 'y14', text: '去一次博物馆或科技馆', done: false, addedToCalendar: false },
        { id: 'y15', text: '了解3个不同国家的文化', done: false, addedToCalendar: false },
        { id: 'y16', text: '写一本观察日记', done: false, addedToCalendar: false },
      ]},
    ]
  },
  {
    key: 'teenager', label: '青春', range: '12-17岁', emoji: '🌳', start: 12, end: 17,
    slogan: '找到自己热爱的事',
    categories: [
      { key: 'academics', title: '学业进阶', icon: '📖', actions: [
        { id: 't1', text: '确定自己的文理方向偏好', done: false, addedToCalendar: false },
        { id: 't2', text: '建立一套适合自己的学习方法', done: false, addedToCalendar: false },
        { id: 't3', text: '读完10本课外经典名著', done: false, addedToCalendar: false },
        { id: 't4', text: '为中考/高考制定详细复习计划', done: false, addedToCalendar: false },
        { id: 't5', text: '参加至少一个学术类社团', done: false, addedToCalendar: false },
      ]},
      { key: 'identity', title: '自我认知', icon: '🪞', actions: [
        { id: 't6', text: '写一封信给10年后的自己', done: false, addedToCalendar: false },
        { id: 't7', text: '列出自己最擅长的3件事', done: false, addedToCalendar: false },
        { id: 't8', text: '找到一件即使没人夸也会做的事', done: false, addedToCalendar: false },
        { id: 't9', text: '学会独处，享受一个人的时光', done: false, addedToCalendar: false },
      ]},
      { key: 'career', title: '职业启蒙', icon: '🧭', actions: [
        { id: 't10', text: '了解5种不同职业的日常工作', done: false, addedToCalendar: false },
        { id: 't11', text: '和长辈聊他们为什么选这份工作', done: false, addedToCalendar: false },
        { id: 't12', text: '做一次职业兴趣测评', done: false, addedToCalendar: false },
        { id: 't13', text: '尝试一份兼职或志愿者工作', done: false, addedToCalendar: false },
      ]},
      { key: 'health', title: '身心成长', icon: '💪', actions: [
        { id: 't14', text: '养成每周运动3次的习惯', done: false, addedToCalendar: false },
        { id: 't15', text: '学会3种缓解压力的方法', done: false, addedToCalendar: false },
        { id: 't16', text: '和信任的人聊一次心里话', done: false, addedToCalendar: false },
      ]},
    ]
  },
  {
    key: 'young-adult', label: '青年', range: '18-29岁', emoji: '🚀', start: 18, end: 29,
    slogan: '用行动丈量世界的广度',
    categories: [
      { key: 'career', title: '职业探索', icon: '💼', actions: [
        { id: 'ya1', text: '完成学历教育或职业技能培训', done: false, addedToCalendar: false },
        { id: 'ya2', text: '找到第一份工作，养活自己', done: false, addedToCalendar: false },
        { id: 'ya3', text: '换一次工作，知道自己不要什么', done: false, addedToCalendar: false },
        { id: 'ya4', text: '建立个人职业发展3年规划', done: false, addedToCalendar: false },
        { id: 'ya5', text: '存下第一个10万', done: false, addedToCalendar: false },
        { id: 'ya6', text: '在某个领域成为被咨询的专家', done: false, addedToCalendar: false },
      ]},
      { key: 'relationship', title: '亲密关系', icon: '💑', actions: [
        { id: 'ya7', text: '认真谈一次恋爱，学会爱与被爱', done: false, addedToCalendar: false },
        { id: 'ya8', text: '想清楚自己对伴侣的核心需求', done: false, addedToCalendar: false },
        { id: 'ya9', text: '学会在关系中说"不"和"我需要"', done: false, addedToCalendar: false },
        { id: 'ya10', text: '如果遇到对的人，考虑组建家庭', done: false, addedToCalendar: false },
      ]},
      { key: 'finance', title: '财务独立', icon: '💰', actions: [
        { id: 'ya11', text: '建立3-6个月的应急储备金', done: false, addedToCalendar: false },
        { id: 'ya12', text: '开始每月定投指数基金', done: false, addedToCalendar: false },
        { id: 'ya13', text: '学会做月度预算并执行', done: false, addedToCalendar: false },
        { id: 'ya14', text: '配置基础保险(医疗+意外)', done: false, addedToCalendar: false },
      ]},
      { key: 'growth', title: '个人成长', icon: '🌟', actions: [
        { id: 'ya15', text: '独自旅行一次，学会与自己相处', done: false, addedToCalendar: false },
        { id: 'ya16', text: '每年学一项新技能(编程/设计/外语)', done: false, addedToCalendar: false },
        { id: 'ya17', text: '读50本关于认知和成长的书', done: false, addedToCalendar: false },
        { id: 'ya18', text: '建立自己的知识管理系统', done: false, addedToCalendar: false },
      ]},
    ]
  },
  {
    key: 'thirties', label: '而立', range: '30-39岁', emoji: '⛰️', start: 30, end: 39,
    slogan: '在深耕中建立不可替代性',
    categories: [
      { key: 'career', title: '事业深耕', icon: '🏔️', actions: [
        { id: 'th1', text: '从执行者转型为管理者或专家', done: false, addedToCalendar: false },
        { id: 'th2', text: '找到自己的专业壁垒和护城河', done: false, addedToCalendar: false },
        { id: 'th3', text: '带出一个高绩效团队', done: false, addedToCalendar: false },
        { id: 'th4', text: '完成一个让你骄傲的项目', done: false, addedToCalendar: false },
        { id: 'th5', text: '建立行业人脉网络', done: false, addedToCalendar: false },
      ]},
      { key: 'family', title: '家庭经营', icon: '🏠', actions: [
        { id: 'th6', text: '每周安排一次家庭活动日', done: false, addedToCalendar: false },
        { id: 'th7', text: '学会有效沟通，减少争吵', done: false, addedToCalendar: false },
        { id: 'th8', text: '和伴侣保持每月一次深度对话', done: false, addedToCalendar: false },
        { id: 'th9', text: '为孩子制定教养原则(如有)', done: false, addedToCalendar: false },
        { id: 'th10', text: '建立家庭年度旅行传统', done: false, addedToCalendar: false },
      ]},
      { key: 'finance', title: '财务进阶', icon: '📊', actions: [
        { id: 'th11', text: '被动收入覆盖基本生活支出', done: false, addedToCalendar: false },
        { id: 'th12', text: '制定并执行子女教育金计划', done: false, addedToCalendar: false },
        { id: 'th13', text: '完善家庭保障体系(重疾+寿险)', done: false, addedToCalendar: false },
        { id: 'th14', text: '开始规划退休储蓄', done: false, addedToCalendar: false },
      ]},
      { key: 'health', title: '健康管理', icon: '🏋️', actions: [
        { id: 'th15', text: '每年做一次全面体检', done: false, addedToCalendar: false },
        { id: 'th16', text: '养成每周3次有氧运动习惯', done: false, addedToCalendar: false },
        { id: 'th17', text: '注意颈椎腰椎，调整工位', done: false, addedToCalendar: false },
        { id: 'th18', text: '学会2种以上放松和冥想技巧', done: false, addedToCalendar: false },
      ]},
    ]
  },
  {
    key: 'forties', label: '不惑', range: '40-49岁', emoji: '🏔️', start: 40, end: 49,
    slogan: '知道自己要什么，更知道自己不要什么',
    categories: [
      { key: 'career', title: '事业进阶', icon: '🎯', actions: [
        { id: 'fo1', text: '成为行业内被尊重的声音', done: false, addedToCalendar: false },
        { id: 'fo2', text: '培养接班人或传承经验', done: false, addedToCalendar: false },
        { id: 'fo3', text: '评估是否需要职业第二曲线', done: false, addedToCalendar: false },
        { id: 'fo4', text: '参与行业标准的制定或评审', done: false, addedToCalendar: false },
      ]},
      { key: 'children', title: '子女教育', icon: '👨‍👧', actions: [
        { id: 'fo5', text: '从管教者转变为引导者', done: false, addedToCalendar: false },
        { id: 'fo6', text: '每周一次和孩子的单独相处', done: false, addedToCalendar: false },
        { id: 'fo7', text: '帮助孩子找到他们的热爱', done: false, addedToCalendar: false },
        { id: 'fo8', text: '学会放手，允许孩子犯错', done: false, addedToCalendar: false },
      ]},
      { key: 'balance', title: '身心平衡', icon: '⚖️', actions: [
        { id: 'fo9', text: '接受身体的变化，调整运动方式', done: false, addedToCalendar: false },
        { id: 'fo10', text: '每年一次深度体检+专项筛查', done: false, addedToCalendar: false },
        { id: 'fo11', text: '培养一个与工作无关的深度爱好', done: false, addedToCalendar: false },
        { id: 'fo12', text: '学会说"不"，减少不必要的社交', done: false, addedToCalendar: false },
      ]},
      { key: 'meaning', title: '人生思考', icon: '🪶', actions: [
        { id: 'fo13', text: '写一份人生中期回顾', done: false, addedToCalendar: false },
        { id: 'fo14', text: '和父母深入聊一次他们的人生', done: false, addedToCalendar: false },
        { id: 'fo15', text: '思考什么是真正让自己快乐的事', done: false, addedToCalendar: false },
      ]},
    ]
  },
  {
    key: 'fifties', label: '知天命', range: '50-59岁', emoji: '🌅', start: 50, end: 59,
    slogan: '享受从参与者到传承者的转变',
    categories: [
      { key: 'legacy', title: '经验传承', icon: '📜', actions: [
        { id: 'fi1', text: '带3个年轻人成长', done: false, addedToCalendar: false },
        { id: 'fi2', text: '整理自己的人生经验写成文章', done: false, addedToCalendar: false },
        { id: 'fi3', text: '在行业协会或社区担任顾问', done: false, addedToCalendar: false },
      ]},
      { key: 'hobby', title: '兴趣深耕', icon: '🎭', actions: [
        { id: 'fi4', text: '把一个爱好练到专业水平', done: false, addedToCalendar: false },
        { id: 'fi5', text: '尝试一个一直想做但没做的事', done: false, addedToCalendar: false },
        { id: 'fi6', text: '加入一个兴趣社群，结交新朋友', done: false, addedToCalendar: false },
      ]},
      { key: 'health', title: '健康保养', icon: '🧘', actions: [
        { id: 'fi7', text: '建立每日晨练的习惯(太极/散步/瑜伽)', done: false, addedToCalendar: false },
        { id: 'fi8', text: '关注心脑血管健康，定期检查', done: false, addedToCalendar: false },
        { id: 'fi9', text: '调整饮食结构，少油少盐多蔬果', done: false, addedToCalendar: false },
      ]},
      { key: 'freedom', title: '放下执念', icon: '🍃', actions: [
        { id: 'fi10', text: '和过去和解，原谅该原谅的人', done: false, addedToCalendar: false },
        { id: 'fi11', text: '清理不再需要的物品和关系', done: false, addedToCalendar: false },
        { id: 'fi12', text: '学会享受当下，而非追逐更多', done: false, addedToCalendar: false },
      ]},
    ]
  },
  {
    key: 'sixties', label: '耳顺', range: '60-69岁', emoji: '🌾', start: 60, end: 69,
    slogan: '人生下半场，活出真正的自己',
    categories: [
      { key: 'retire', title: '退休规划', icon: '🏖️', actions: [
        { id: 'si1', text: '制定退休后的日程表，保持节奏感', done: false, addedToCalendar: false },
        { id: 'si2', text: '评估退休金是否足够，调整支出', done: false, addedToCalendar: false },
        { id: 'si3', text: '找到退休后的身份认同', done: false, addedToCalendar: false },
      ]},
      { key: 'family', title: '家庭温情', icon: '👴', actions: [
        { id: 'si4', text: '每周和子女通一次电话', done: false, addedToCalendar: false },
        { id: 'si5', text: '和老伴培养共同爱好', done: false, addedToCalendar: false },
        { id: 'si6', text: '给孙辈讲你年轻时的故事', done: false, addedToCalendar: false },
      ]},
      { key: 'explore', title: '人生新探索', icon: '🗺️', actions: [
        { id: 'si7', text: '去3个一直想去的地方旅行', done: false, addedToCalendar: false },
        { id: 'si8', text: '学会用智能手机和社交软件', done: false, addedToCalendar: false },
        { id: 'si9', text: '尝试一种新的艺术形式(书法/绘画/摄影)', done: false, addedToCalendar: false },
      ]},
      { key: 'health', title: '健康管理', icon: '🏥', actions: [
        { id: 'si10', text: '每年做2次体检', done: false, addedToCalendar: false },
        { id: 'si11', text: '每天散步6000步以上', done: false, addedToCalendar: false },
        { id: 'si12', text: '保持社交活跃，预防认知衰退', done: false, addedToCalendar: false },
      ]},
    ]
  },
  {
    key: 'seventies', label: '古稀', range: '70-79岁', emoji: '🌕', start: 70, end: 79,
    slogan: '每一天都是礼物',
    categories: [
      { key: 'wisdom', title: '智慧传承', icon: '📝', actions: [
        { id: 'se1', text: '写回忆录或家族史', done: false, addedToCalendar: false },
        { id: 'se2', text: '把人生教训告诉下一代', done: false, addedToCalendar: false },
        { id: 'se3', text: '整理照片和书信，留给家人', done: false, addedToCalendar: false },
      ]},
      { key: 'peace', title: '安享生活', icon: '☀️', actions: [
        { id: 'se4', text: '每天做一件让自己开心的小事', done: false, addedToCalendar: false },
        { id: 'se5', text: '和老朋友保持联系，每月见一次', done: false, addedToCalendar: false },
        { id: 'se6', text: '养花种草，享受生命的节奏', done: false, addedToCalendar: false },
      ]},
      { key: 'body', title: '身体照护', icon: '🩺', actions: [
        { id: 'se7', text: '按时服药，定期复查', done: false, addedToCalendar: false },
        { id: 'se8', text: '预防跌倒，注意居家安全', done: false, addedToCalendar: false },
        { id: 'se9', text: '保持适度活动，量力而行', done: false, addedToCalendar: false },
      ]},
      { key: 'spirit', title: '心灵富足', icon: '🕊️', actions: [
        { id: 'se10', text: '每天感恩三件事', done: false, addedToCalendar: false },
        { id: 'se11', text: '放下所有遗憾，与自己和解', done: false, addedToCalendar: false },
        { id: 'se12', text: '对身边的人说"谢谢你们陪伴我"', done: false, addedToCalendar: false },
      ]},
    ]
  },
];


export default function LifeCalendar({ birthYear, setBirthYear, onClose, skinKey }: LifeCalendarProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [stageData, setStageData] = useState<Record<string, Record<string, Record<string, ActionItem>>>>({});
  const [innerSkin, setInnerSkin] = useState<string>(DEFAULT_SKIN);

  // Use shared skin key if provided, else internal
  const activeSkinKey = skinKey ?? innerSkin;
  const skin = activeSkinKey ? (SKINS.find(s => s.key === activeSkinKey) ?? NO_SKIN) : NO_SKIN;



  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('calendar-lifecal-width');
    if (containerRef.current && saved) {
      const w = Math.min(Math.max(Number(saved), 360), window.innerWidth * 0.92);
      containerRef.current.style.width = w + 'px';
    } else if (containerRef.current) {
      containerRef.current.style.width = '480px';
    }
  }, []);

  // Load saved progress + skin
  useEffect(() => {
    // Load skin if not managed externally
    if (!skinKey) {
      try {
        const savedSkin = localStorage.getItem('life-calendar-skin');
        if (savedSkin && SKINS.find(s => s.key === savedSkin)) setInnerSkin(savedSkin);
      } catch { /* ignore */ }
    }

    try {
      const saved = localStorage.getItem('life-calendar-progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        const data: Record<string, Record<string, Record<string, ActionItem>>> = {};
        STAGES.forEach(stage => {
          data[stage.key] = {};
          stage.categories.forEach(cat => {
            data[stage.key][cat.key] = {};
            cat.actions.forEach(action => {
              const savedAction = parsed[stage.key]?.[cat.key]?.[action.id];
              data[stage.key][cat.key][action.id] = savedAction ? { ...action, ...savedAction } : action;
            });
          });
        });
        setStageData(data);
      } else {
        const data: Record<string, Record<string, Record<string, ActionItem>>> = {};
        STAGES.forEach(stage => {
          data[stage.key] = {};
          stage.categories.forEach(cat => {
            data[stage.key][cat.key] = {};
            cat.actions.forEach(action => { data[stage.key][cat.key][action.id] = { ...action }; });
          });
        });
        setStageData(data);
      }
    } catch {
      const data: Record<string, Record<string, Record<string, ActionItem>>> = {};
      STAGES.forEach(stage => {
        data[stage.key] = {};
        stage.categories.forEach(cat => {
          data[stage.key][cat.key] = {};
          cat.actions.forEach(action => { data[stage.key][cat.key][action.id] = { ...action }; });
        });
      });
      setStageData(data);
    }

    const current = STAGES.find(s => currentAge >= s.start && currentAge <= s.end);
    if (current) setExpandedStage(current.key);
  }, [currentAge, skinKey]);

  const saveData = useCallback((data: Record<string, Record<string, Record<string, ActionItem>>>) => {
    try { localStorage.setItem('life-calendar-progress', JSON.stringify(data)); } catch { /* ignore */ }
  }, []);

  const toggleAction = (stageKey: string, catKey: string, actionId: string) => {
    setStageData(prev => {
      const next = { ...prev };
      next[stageKey] = { ...next[stageKey] };
      next[stageKey][catKey] = { ...next[stageKey][catKey] };
      next[stageKey][catKey][actionId] = { ...next[stageKey][catKey][actionId], done: !next[stageKey][catKey][actionId].done };
      saveData(next);
      return next;
    });
  };

  const addToCalendar = (stageKey: string, catKey: string, actionId: string) => {
    setStageData(prev => {
      const next = { ...prev };
      next[stageKey] = { ...next[stageKey] };
      next[stageKey][catKey] = { ...next[stageKey][catKey] };
      const action = next[stageKey][catKey][actionId];
      next[stageKey][catKey][actionId] = { ...action, addedToCalendar: !action.addedToCalendar };
      saveData(next);
      return next;
    });
  };

  const getStageProgress = (stage: Stage) => {
    const stageD = stageData[stage.key];
    if (!stageD) return 0;
    let total = 0, done = 0;
    stage.categories.forEach(cat => {
      cat.actions.forEach(action => { total++; if (stageD[cat.key]?.[action.id]?.done) done++; });
    });
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  const getStageStatus = (stage: Stage): 'past' | 'current' | 'future' => {
    if (currentAge > stage.end) return 'past';
    if (currentAge >= stage.start && currentAge <= stage.end) return 'current';
    return 'future';
  };

  return (
    <div ref={containerRef} className="fixed top-0 left-0 z-50 h-full animate-slide-in-left shadow-2xl flex flex-col transition-colors duration-500"
      style={{ background: skin.panelBg }}>

      {/* Resize handle */}
      <div className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-white/20 z-50 transition-colors"
        onMouseDown={(e) => {
          const startX = e.clientX;
          const panel = (e.target as HTMLElement).parentElement!;
          const startW = panel.offsetWidth;
          const onMove = (ev: MouseEvent) => {
            const newW = Math.min(Math.max(startW + (ev.clientX - startX), 360), window.innerWidth * 0.92);
            panel.style.width = newW + 'px';
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            localStorage.setItem('calendar-lifecal-width', String(panel.offsetWidth));
          };
          document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      />

      {/* Header - same width/padding as day-view sidebar */}
      <div className="flex-shrink-0 px-5 pb-4 relative overflow-hidden" style={{ paddingTop: '0.95rem', ...(skin.headerBgImage ? { backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(135deg, ${skin.headerFrom} 0%, ${skin.headerTo} 100%)` }) }}>
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
                <span>当前 {currentAge} 岁</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1 rounded-full overflow-hidden bg-white/15">
                  <div className="h-full rounded-full transition-all bg-white/40" style={{ width: `${Math.min((currentAge / 80) * 100, 100)}%` }} />
                </div>
                <span className="text-[10px] text-white/60">{currentAge}/80</span>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Stages List */}
      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-3 sidebar-scroll">
        {STAGES.map((stage, idx) => {
          const status = getStageStatus(stage);
          const isExpanded = expandedStage === stage.key;
          const progress = getStageProgress(stage);
          const stageD = stageData[stage.key];
          const sc = skin.stageColors[idx] ?? skin.stageColors[0];

          return (
            <div key={stage.key} className="rounded-xl overflow-hidden transition-all duration-300"
              style={{
                background: skin.cardBg,
                border: `1px solid ${isExpanded ? sc.border : skin.divider}`,
                boxShadow: isExpanded ? `0 4px 20px ${sc.border}40` : 'none',
              }}>
              {/* Stage Header */}
              <button onClick={() => setExpandedStage(isExpanded ? null : stage.key)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors"
                style={{ background: isExpanded ? sc.bg : (status === 'current' ? sc.bg : skin.cardBg) }}>
                {/* Color dot */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: sc.color + '40' }}>
                  {stage.emoji}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm" style={{ color: skin.textPrimary }}>{stage.label}</span>
                    <span className="text-xs" style={{ color: skin.textMuted }}>{stage.range}</span>
                    {status === 'current' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ background: sc.accent }}>当前</span>
                    )}
                    {status === 'past' && progress === 100 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: skin.plannedBg, color: skin.plannedText }}>完成</span>
                    )}
                  </div>
                  {!isExpanded && <p className="text-xs mt-0.5 truncate" style={{ color: skin.textMuted }}>{stage.slogan}</p>}
                </div>
                {/* Progress ring */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-medium" style={{ color: progress > 0 ? sc.accent : skin.textMuted }}>{progress}%</span>
                  <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
                    <circle cx="14" cy="14" r="11" fill="none" stroke={skin.progressTrack} strokeWidth="2.5" />
                    <circle cx="14" cy="14" r="11" fill="none" stroke={sc.accent} strokeWidth="2.5"
                      strokeDasharray={`${progress * 0.691} 69.1`} strokeLinecap="round" />
                  </svg>
                  <span className="text-xs" style={{ color: skin.textMuted }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="animate-fade-in" style={{ background: sc.bg }}>
                  <div className="px-4 py-2 border-b" style={{ borderColor: sc.border + '60' }}>
                    <p className="text-xs font-medium" style={{ color: sc.accent }}>「{stage.slogan}」</p>
                  </div>
                  <div className="px-4 py-3 space-y-4">
                    {stage.categories.map(cat => {
                      const catActions = cat.actions.map(a => stageD?.[cat.key]?.[a.id]).filter(Boolean);
                      const catDone = catActions.filter(a => a.done).length;
                      const catTotal = cat.actions.length;

                      return (
                        <div key={cat.key}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm">{cat.icon}</span>
                            <span className="text-sm font-medium" style={{ color: skin.textPrimary }}>{cat.title}</span>
                            <span className="text-[10px] ml-auto" style={{ color: skin.textMuted }}>{catDone}/{catTotal}</span>
                          </div>
                          <div className="space-y-1">
                            {cat.actions.map(action => {
                              const saved = stageD?.[cat.key]?.[action.id];
                              const isDone = saved?.done ?? false;
                              const isAdded = saved?.addedToCalendar ?? false;

                              return (
                                <div key={action.id}
                                  className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors group"
                                  style={{
                                    background: skin.isDark ? (isDone ? 'transparent' : 'transparent') : 'transparent',
                                    opacity: status === 'past' && !isDone ? 0.4 : 1,
                                  }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = skin.isDark ? sc.color + '15' : 'rgba(255,255,255,0.6)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                                  {/* Checkbox */}
                                  <button onClick={() => toggleAction(stage.key, cat.key, action.id)}
                                    className="w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all"
                                    style={{
                                      borderColor: isDone ? skin.checkboxDone : (skin.isDark ? '#64748b' : '#c8c4be'),
                                      background: isDone ? skin.checkboxDone : 'transparent',
                                    }}>
                                    {isDone && <span className="text-white text-[9px] font-bold">✓</span>}
                                  </button>
                                  {/* Text */}
                                  <span className={`text-[13px] leading-5 flex-1 ${isDone ? 'line-through' : ''}`}
                                    style={{ color: isDone ? skin.textMuted : skin.textPrimary }}>
                                    {action.text}
                                  </span>
                                  {/* Add to calendar button */}
                                  <button onClick={() => addToCalendar(stage.key, cat.key, action.id)}
                                    className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-full transition-all opacity-0 group-hover:opacity-100 ${isAdded ? 'opacity-100' : ''}`}
                                    style={{
                                      background: isAdded ? skin.plannedBg : skin.planBtnBg,
                                      color: isAdded ? skin.plannedText : skin.textMuted,
                                      border: isAdded ? 'none' : `1px solid ${skin.divider}`,
                                    }}
                                    title={isAdded ? '已加入计划' : '加入我的年历'}>
                                    {isAdded ? '✓ 已计划' : '+ 计划'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom Quote */}
        <div className="mt-4 mb-2 px-4 py-3 rounded-xl text-center"
          style={{ background: skin.cardBg, border: `1px solid ${skin.divider}` }}>
          <p className="text-sm italic" style={{ color: skin.textMuted }}>
            &ldquo;种一棵树最好的时间是十年前，其次是现在。&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
