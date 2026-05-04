'use client';

import { useState, useEffect, useCallback } from 'react';
import { SKINS, NO_SKIN, DEFAULT_SKIN } from '@/lib/skins';
import ParticleEffect from '@/components/particle-effect';

interface LifeCalendarProps {
  birthYear: number;
  setBirthYear: (year: number) => void;
  onClose: () => void;
  skinKey?: string;
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

interface LifeTemplate {
  key: string;
  name: string;
  icon: string;
  description: string;
  tags: string[];
  stages: Record<string, string[]>;
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

// 人生模板数据
const LIFE_TEMPLATES: LifeTemplate[] = [
  {
    key: 'career-first', name: '事业优先型', icon: '💼',
    description: '以职业发展为核心，追求专业成就和财务自由',
    tags: ['职场', '晋升', '财富'],
    stages: {
      'young-adult': ['确定职业方向并深耕', '考取行业核心证书', '3年内晋升一次', '建立个人品牌', '存下第一桶金'],
      'thirties': ['成为团队负责人', '拓展行业人脉', '发展副业收入', '建立被动收入渠道', '积累3年应急金'],
      'forties': ['成为行业意见领袖', '培养核心团队', '评估创业/投资机会', '规划退休金', '建立家族信托'],
      'fifties': ['传承行业经验', '评估事业第二曲线', '逐步放权', '规划退休生活', '完成事业代表作'],
    }
  },
  {
    key: 'family-first', name: '家庭幸福型', icon: '🏠',
    description: '以家庭为重心，追求亲密关系和生活品质',
    tags: ['家庭', '陪伴', '温情'],
    stages: {
      'young-adult': ['学会经营亲密关系', '找到人生伴侣', '建立家庭仪式感', '学会有效沟通', '平衡工作与生活'],
      'thirties': ['每周家庭活动日', '培养亲子关系', '建立家庭传统', '创造高质量陪伴时间', '经营夫妻关系'],
      'forties': ['成为孩子的引路人', '照顾年迈父母', '建立家族文化', '规划子女教育', '维系家庭和谐'],
      'fifties': ['享受天伦之乐', '传承家风家训', '培养共同爱好', '规划家庭旅行', '建立代际连接'],
    }
  },
  {
    key: 'freedom-first', name: '自由探索型', icon: '🌍',
    description: '追求体验和自由，不被传统路径束缚',
    tags: ['自由', '探索', '体验'],
    stages: {
      'young-adult': ['独自长途旅行', '学习2门外语', '尝试3种不同工作', '建立数字游民技能', '积累12个月生活费'],
      'thirties': ['每年去一个新国家', '发展远程工作能力', '建立多元收入', '保持极简生活', '记录旅行故事'],
      'forties': ['实现地理自由', '发展深度兴趣', '建立全球视野', '尝试间隔年', '分享探索经验'],
      'fifties': ['慢旅行生活', '写旅行文学', '建立国际社群', '探索新兴文化', '保持好奇心'],
    }
  },
  {
    key: 'balanced', name: '平衡发展型', icon: '⚖️',
    description: '事业、家庭、个人成长均衡发展，追求全面的人生',
    tags: ['平衡', '全面', '稳健'],
    stages: {
      'young-adult': ['建立职业基础', '培养一段认真的关系', '开始健身习惯', '每月读2本书', '建立理财意识'],
      'thirties': ['职业稳步晋升', '经营家庭关系', '保持运动习惯', '发展深度爱好', '财务稳健增长'],
      'forties': ['事业有所建树', '家庭关系和谐', '身心健康良好', '社交圈优质', '精神世界丰富'],
      'fifties': ['事业稳步收尾', '享受家庭温情', '保持活力健康', '回馈社会', '内心从容平和'],
    }
  },
  {
    key: 'health-first', name: '健康为本型', icon: '🧘',
    description: '以身心健康为根基，一切从健康出发规划人生',
    tags: ['健康', '养生', '长寿'],
    stages: {
      'young-adult': ['建立规律运动习惯', '学会冥想放松', '定期体检', '戒掉熬夜', '学习营养学基础'],
      'thirties': ['每周运动4次', '学会压力管理', '建立健康饮食体系', '关注心理健康', '培养一项户外运动'],
      'forties': ['全面体检每年1次', '调整运动方式', '关注慢性病预防', '建立睡眠仪式', '练习正念冥想'],
      'fifties': ['每日晨练习惯', '心脑血管专项检查', '调整饮食结构', '保持社交活跃', '享受慢生活'],
    }
  },
  {
    key: 'creator', name: '创造者型', icon: '🎨',
    description: '以创造和表达为核心，追求留下作品和影响力',
    tags: ['创造', '艺术', '影响力'],
    stages: {
      'young-adult': ['找到创作方向', '完成第一个作品', '建立创作习惯', '学习一门手艺', '加入创作者社群'],
      'thirties': ['形成个人风格', '产出系列作品', '建立受众群体', '跨界尝试', '开始教授他人'],
      'forties': ['创作代表作', '建立创作体系', '举办展览/出版', '培养年轻创作者', '扩大影响力'],
      'fifties': ['总结创作哲学', '传承创作经验', '持续产出', '探索新媒介', '留下创作遗产'],
    }
  },
];


export default function LifeCalendar({ birthYear, setBirthYear, onClose, skinKey }: LifeCalendarProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [stageData, setStageData] = useState<Record<string, Record<string, Record<string, ActionItem>>>>({});
  const [innerSkin, setInnerSkin] = useState<string>(DEFAULT_SKIN);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [appliedTemplates, setAppliedTemplates] = useState<Record<string, boolean>>({});

  const activeSkinKey = skinKey ?? innerSkin;
  const skin = activeSkinKey ? (SKINS.find(s => s.key === activeSkinKey) ?? NO_SKIN) : NO_SKIN;

  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;

  useEffect(() => {
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
        initData();
      }
    } catch {
      initData();
    }

    // Load applied templates
    try {
      const saved = localStorage.getItem('life-calendar-templates');
      if (saved) setAppliedTemplates(JSON.parse(saved));
    } catch { /* ignore */ }

    const current = STAGES.find(s => currentAge >= s.start && currentAge <= s.end);
    if (current) setExpandedStage(current.key);
  }, [currentAge, skinKey]);

  const initData = () => {
    const data: Record<string, Record<string, Record<string, ActionItem>>> = {};
    STAGES.forEach(stage => {
      data[stage.key] = {};
      stage.categories.forEach(cat => {
        data[stage.key][cat.key] = {};
        cat.actions.forEach(action => { data[stage.key][cat.key][action.id] = { ...action }; });
      });
    });
    setStageData(data);
  };

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

  const applyTemplate = (template: LifeTemplate) => {
    const isApplied = appliedTemplates[template.key];
    const newApplied = { ...appliedTemplates, [template.key]: !isApplied };
    setAppliedTemplates(newApplied);
    try { localStorage.setItem('life-calendar-templates', JSON.stringify(newApplied)); } catch { /* ignore */ }

    if (!isApplied) {
      // Add template items to corresponding stages
      setStageData(prev => {
        const next = { ...prev };
        Object.entries(template.stages).forEach(([stageKey, items]) => {
          if (!next[stageKey]) return;
          next[stageKey] = { ...next[stageKey] };
          // Ensure 'template' category exists
          if (!next[stageKey]['template']) {
            next[stageKey]['template'] = {};
          }
          next[stageKey]['template'] = { ...next[stageKey]['template'] };
          items.forEach((text, idx) => {
            const id = `tpl-${template.key}-${stageKey}-${idx}`;
            if (!next[stageKey]['template'][id]) {
              next[stageKey]['template'][id] = {
                id,
                text: `[${template.name}] ${text}`,
                done: false,
                addedToCalendar: false,
              };
            }
          });
        });
        saveData(next);
        return next;
      });
    }
  };

  const getStageProgress = (stage: Stage) => {
    const stageD = stageData[stage.key];
    if (!stageD) return 0;
    let total = 0, done = 0;
    stage.categories.forEach(cat => {
      cat.actions.forEach(action => { total++; if (stageD[cat.key]?.[action.id]?.done) done++; });
    });
    // Also count template items
    if (stageD['template']) {
      Object.values(stageD['template']).forEach(a => { total++; if (a.done) done++; });
    }
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  const getStageStatus = (stage: Stage): 'past' | 'current' | 'future' => {
    if (currentAge > stage.end) return 'past';
    if (currentAge >= stage.start && currentAge <= stage.end) return 'current';
    return 'future';
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-full animate-slide-in-left shadow-2xl flex transition-colors duration-500"
      style={{ background: skin.panelBg }}>

      {/* Left Panel: Age Stages (fixed width ~480px) */}
      <div className="w-[480px] flex-shrink-0 flex flex-col h-full border-r"
        style={{ borderColor: skin.divider }}>

        {/* Header */}
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
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white/50 hover:text-white transition-colors"
                style={{ background: 'rgba(0,0,0,0.2)' }}>
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
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: sc.color + '40' }}>
                    {stage.emoji}
                  </div>
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
                                    style={{ opacity: status === 'past' && !isDone ? 0.4 : 1 }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = skin.isDark ? sc.color + '15' : 'rgba(255,255,255,0.6)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                                    <button onClick={() => toggleAction(stage.key, cat.key, action.id)}
                                      className="w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all"
                                      style={{
                                        borderColor: isDone ? skin.checkboxDone : (skin.isDark ? '#64748b' : '#c8c4be'),
                                        background: isDone ? skin.checkboxDone : 'transparent',
                                      }}>
                                      {isDone && <span className="text-white text-[9px] font-bold">✓</span>}
                                    </button>
                                    <span className={`text-[13px] leading-5 flex-1 ${isDone ? 'line-through' : ''}`}
                                      style={{ color: isDone ? skin.textMuted : skin.textPrimary }}>
                                      {action.text}
                                    </span>
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

                      {/* Template items for this stage */}
                      {stageD?.['template'] && Object.keys(stageD['template']).length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm">📋</span>
                            <span className="text-sm font-medium" style={{ color: skin.textPrimary }}>模板建议</span>
                          </div>
                          <div className="space-y-1">
                            {Object.values(stageD['template']).map(action => (
                              <div key={action.id}
                                className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors group"
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = skin.isDark ? sc.color + '15' : 'rgba(255,255,255,0.6)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                                <button onClick={() => toggleAction(stage.key, 'template', action.id)}
                                  className="w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all"
                                  style={{
                                    borderColor: action.done ? skin.checkboxDone : (skin.isDark ? '#64748b' : '#c8c4be'),
                                    background: action.done ? skin.checkboxDone : 'transparent',
                                  }}>
                                  {action.done && <span className="text-white text-[9px] font-bold">✓</span>}
                                </button>
                                <span className={`text-[13px] leading-5 flex-1 ${action.done ? 'line-through' : ''}`}
                                  style={{ color: action.done ? skin.textMuted : skin.textPrimary }}>
                                  {action.text}
                                </span>
                                <button onClick={() => addToCalendar(stage.key, 'template', action.id)}
                                  className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-full transition-all opacity-0 group-hover:opacity-100 ${action.addedToCalendar ? 'opacity-100' : ''}`}
                                  style={{
                                    background: action.addedToCalendar ? skin.plannedBg : skin.planBtnBg,
                                    color: action.addedToCalendar ? skin.plannedText : skin.textMuted,
                                    border: action.addedToCalendar ? 'none' : `1px solid ${skin.divider}`,
                                  }}>
                                  {action.addedToCalendar ? '✓ 已计划' : '+ 计划'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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

      {/* Right Panel: Life Templates */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Right Header */}
        <div className="flex-shrink-0 px-8 py-5 border-b" style={{ borderColor: skin.divider }}>
          <h3 className="text-lg font-bold" style={{ color: skin.textPrimary }}>人生模板</h3>
          <p className="text-sm mt-1" style={{ color: skin.textMuted }}>选择适合你的人生路径模板，系统会为对应年龄段添加行动建议</p>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6 sidebar-scroll">
          <div className="grid grid-cols-2 gap-5">
            {LIFE_TEMPLATES.map(tpl => {
              const isApplied = appliedTemplates[tpl.key];
              const isHovered = selectedTemplate === tpl.key;
              const stageCount = Object.keys(tpl.stages).length;

              return (
                <div key={tpl.key}
                  className="rounded-xl p-5 transition-all duration-200 cursor-pointer group"
                  style={{
                    background: skin.cardBg,
                    border: `2px solid ${isApplied ? skin.swatch : isHovered ? skin.swatch + '60' : skin.divider}`,
                    boxShadow: isApplied ? `0 4px 20px ${skin.swatch}30` : 'none',
                  }}
                  onMouseEnter={() => setSelectedTemplate(tpl.key)}
                  onMouseLeave={() => setSelectedTemplate(null)}
                  onClick={() => applyTemplate(tpl)}>
                  {/* Template Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: isApplied ? skin.swatch + '30' : skin.swatch + '15' }}>
                      {tpl.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base" style={{ color: skin.textPrimary }}>{tpl.name}</span>
                        {isApplied && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium" style={{ background: skin.swatch }}>已应用</span>
                        )}
                      </div>
                      <p className="text-xs mt-1 leading-4" style={{ color: skin.textMuted }}>{tpl.description}</p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {tpl.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: skin.swatch + '15', color: skin.swatch }}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Stage Preview */}
                  <div className="space-y-2">
                    {Object.entries(tpl.stages).map(([stageKey, items]) => {
                      const stage = STAGES.find(s => s.key === stageKey);
                      if (!stage) return null;
                      const stageStatus = getStageStatus(stage);
                      return (
                        <div key={stageKey} className="rounded-lg px-3 py-2"
                          style={{ background: skin.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs">{stage.emoji}</span>
                            <span className="text-xs font-medium" style={{ color: skin.textPrimary }}>{stage.label}</span>
                            <span className="text-[10px]" style={{ color: skin.textMuted }}>{stage.range}</span>
                            {stageStatus === 'current' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white" style={{ background: skin.swatch, fontSize: '9px' }}>当前</span>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {items.slice(0, 3).map((item, i) => (
                              <p key={i} className="text-[11px] leading-4 pl-5" style={{ color: skin.textMuted }}>
                                {i < 2 ? '·' : '...'} {item}
                              </p>
                            ))}
                            {items.length > 3 && (
                              <p className="text-[10px] pl-5" style={{ color: skin.textMuted, opacity: 0.6 }}>
                                +{items.length - 2} 项更多建议
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Apply Button */}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: skin.textMuted }}>覆盖 {stageCount} 个年龄段</span>
                    <button className="text-xs px-4 py-1.5 rounded-full font-medium transition-all"
                      style={{
                        background: isApplied ? skin.swatch : 'transparent',
                        color: isApplied ? '#ffffff' : skin.swatch,
                        border: `1.5px solid ${skin.swatch}`,
                      }}>
                      {isApplied ? '取消应用' : '应用模板'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom tip */}
          <div className="mt-6 mb-4 px-5 py-4 rounded-xl text-center"
            style={{ background: skin.cardBg, border: `1px solid ${skin.divider}` }}>
            <p className="text-sm" style={{ color: skin.textMuted }}>
              应用模板后，建议会自动添加到左侧对应年龄段的「模板建议」分类中
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
