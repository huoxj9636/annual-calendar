/**
 * 皮肤主题系统
 * 8 套皮肤：翡翠绿、海洋蓝、日落橙、紫罗兰、樱花粉、暗夜黑、森林绿、薰衣草
 */

export interface SkinTheme {
  key: string;
  label: string;
  labelEn: string;
  slogan: string;
  /** 皮肤标识色块 */
  swatch: string;
  /** 头部渐变 from→to */
  headerFrom: string;
  headerTo: string;
  /** 面板背景 */
  panelBg: string;
  /** 卡片背景 */
  cardBg: string;
  /** 卡片 hover */
  cardHover: string;
  /** 主文字色 */
  textPrimary: string;
  /** 次文字色 */
  textSecondary: string;
  /** 弱文字色 */
  textMuted: string;
  /** 分割线色 */
  divider: string;
  /** 9 阶段色系 - 每阶段一组 { color, accent, bg, border } */
  stageColors: Array<{
    color: string;   // 浅色标记
    accent: string;  // 主强调色
    bg: string;      // 展开区背景
    border: string;  // 边框色
  }>;
  /** 进度条色 */
  progressTrack: string;
  progressFill: string;
  /** checkbox 已选色 */
  checkboxDone: string;
  /** "加入计划"按钮色 */
  planBtnBg: string;
  planBtnText: string;
  /** "已计划"状态色 */
  plannedBg: string;
  plannedText: string;
  /** 页面背景 */
  bodyBg: string;
  /** 头部遮罩色 */
  headerOverlay: string;
  /** 今天格子环色 */
  todayRing: string;
  /** 格子边框色 */
  cellBorder: string;
  /** 已过格子遮罩 */
  pastBg: string;
  /** 已过周末遮罩 */
  pastWeekendBg: string;
  /** 已过文字色 */
  pastText: string;
  /** 已过次要文字色 */
  pastSubtext: string;
  /** 勾选色 */
  checkColor: string;
  /** 叉选色 */
  crossColor: string;
  /** 蓝点指示色 */
  blueDot: string;
  /** Tab激活色 */
  tabActive: string;
  /** 侧边栏头部渐变 from→to */
  sidebarFrom: string;
  sidebarTo: string;
  /** 暗色模式相关 */
  isDark: boolean;
}

export const SKINS: SkinTheme[] = [
  {
    key: 'emerald',
    label: '翡翠绿',
    labelEn: 'Emerald',
    slogan: '生机勃勃，充满希望',
    swatch: '#34d399',
    headerFrom: '#065f46',
    headerTo: '#059669',
    panelBg: '#f0fdf4',
    cardBg: '#ffffff',
    cardHover: '#f0fdf4',
    textPrimary: '#064e3b',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    divider: '#d1fae5',
    stageColors: [
      { color: '#bbf7d0', accent: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
      { color: '#a7f3d0', accent: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
      { color: '#86efac', accent: '#16a34a', bg: '#f0fdf4', border: '#4ade80' },
      { color: '#6ee7b7', accent: '#047857', bg: '#ecfdf5', border: '#34d399' },
      { color: '#4ade80', accent: '#15803d', bg: '#f0fdf4', border: '#22c55e' },
      { color: '#34d399', accent: '#166534', bg: '#ecfdf5', border: '#16a34a' },
      { color: '#22c55e', accent: '#14532d', bg: '#f0fdf4', border: '#15803d' },
      { color: '#16a34a', accent: '#052e16', bg: '#ecfdf5', border: '#166534' },
      { color: '#15803d', accent: '#052e16', bg: '#f0fdf4', border: '#14532d' },
    ],
    progressTrack: '#d1fae5',
    progressFill: '#34d399',
    checkboxDone: '#16a34a',
    planBtnBg: '#ffffff',
    planBtnText: '#059669',
    plannedBg: '#d1fae5',
    plannedText: '#047857',
    bodyBg: '#f0fdf4',
    headerOverlay: '#faf9f7',
    todayRing: '#059669',
    cellBorder: 'rgba(148,163,184,0.18)',
    pastBg: 'rgba(240,242,245,0.5)',
    pastWeekendBg: 'rgba(228,230,236,0.55)',
    pastText: '#bfbfbf',
    pastSubtext: '#d0d0d0',
    checkColor: '#10b981',
    crossColor: '#ef4444',
    blueDot: '#059669',
    tabActive: '#059669',
    sidebarFrom: '#065f46',
    sidebarTo: '#059669',
    isDark: false,
  },
  {
    key: 'ocean',
    label: '海洋蓝',
    labelEn: 'Ocean',
    slogan: '深邃宁静，心旷神怡',
    swatch: '#3b82f6',
    headerFrom: '#1e3a5f',
    headerTo: '#2563eb',
    panelBg: '#eff6ff',
    cardBg: '#ffffff',
    cardHover: '#eff6ff',
    textPrimary: '#1e3a5f',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    divider: '#bfdbfe',
    stageColors: [
      { color: '#bfdbfe', accent: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
      { color: '#93c5fd', accent: '#1d4ed8', bg: '#eff6ff', border: '#60a5fa' },
      { color: '#60a5fa', accent: '#2563eb', bg: '#dbeafe', border: '#3b82f6' },
      { color: '#3b82f6', accent: '#1d4ed8', bg: '#eff6ff', border: '#2563eb' },
      { color: '#2563eb', accent: '#1e40af', bg: '#dbeafe', border: '#1d4ed8' },
      { color: '#1d4ed8', accent: '#1e3a8a', bg: '#eff6ff', border: '#1e40af' },
      { color: '#1e40af', accent: '#172554', bg: '#dbeafe', border: '#1d4ed8' },
      { color: '#1e3a8a', accent: '#172554', bg: '#eff6ff', border: '#1e40af' },
      { color: '#172554', accent: '#0c1a3a', bg: '#dbeafe', border: '#1e3a8a' },
    ],
    progressTrack: '#bfdbfe',
    progressFill: '#3b82f6',
    checkboxDone: '#2563eb',
    planBtnBg: '#ffffff',
    planBtnText: '#2563eb',
    plannedBg: '#bfdbfe',
    plannedText: '#1d4ed8',
    bodyBg: '#eff6ff',
    headerOverlay: '#f8fafc',
    todayRing: '#2563eb',
    cellBorder: 'rgba(148,163,184,0.18)',
    pastBg: 'rgba(240,242,245,0.5)',
    pastWeekendBg: 'rgba(228,230,236,0.55)',
    pastText: '#bfbfbf',
    pastSubtext: '#d0d0d0',
    checkColor: '#3b82f6',
    crossColor: '#ef4444',
    blueDot: '#2563eb',
    tabActive: '#2563eb',
    sidebarFrom: '#1e3a5f',
    sidebarTo: '#2563eb',
    isDark: false,
  },
  {
    key: 'sunset',
    label: '日落橙',
    labelEn: 'Sunset',
    slogan: '温暖浪漫，岁月静好',
    swatch: '#f97316',
    headerFrom: '#7c2d12',
    headerTo: '#ea580c',
    panelBg: '#fff7ed',
    cardBg: '#ffffff',
    cardHover: '#fff7ed',
    textPrimary: '#7c2d12',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    divider: '#fed7aa',
    stageColors: [
      { color: '#fed7aa', accent: '#ea580c', bg: '#fff7ed', border: '#fdba74' },
      { color: '#fdba74', accent: '#c2410c', bg: '#fff7ed', border: '#fb923c' },
      { color: '#fb923c', accent: '#ea580c', bg: '#ffedd5', border: '#f97316' },
      { color: '#f97316', accent: '#c2410c', bg: '#fff7ed', border: '#ea580c' },
      { color: '#ea580c', accent: '#9a3412', bg: '#ffedd5', border: '#c2410c' },
      { color: '#c2410c', accent: '#7c2d12', bg: '#fff7ed', border: '#9a3412' },
      { color: '#9a3412', accent: '#431407', bg: '#ffedd5', border: '#7c2d12' },
      { color: '#7c2d12', accent: '#431407', bg: '#fff7ed', border: '#9a3412' },
      { color: '#431407', accent: '#2c0a04', bg: '#ffedd5', border: '#7c2d12' },
    ],
    progressTrack: '#fed7aa',
    progressFill: '#f97316',
    checkboxDone: '#ea580c',
    planBtnBg: '#ffffff',
    planBtnText: '#ea580c',
    plannedBg: '#fed7aa',
    plannedText: '#c2410c',
    bodyBg: '#fff7ed',
    headerOverlay: '#fffbf5',
    todayRing: '#ea580c',
    cellBorder: 'rgba(148,163,184,0.18)',
    pastBg: 'rgba(240,242,245,0.5)',
    pastWeekendBg: 'rgba(228,230,236,0.55)',
    pastText: '#bfbfbf',
    pastSubtext: '#d0d0d0',
    checkColor: '#f97316',
    crossColor: '#ef4444',
    blueDot: '#ea580c',
    tabActive: '#ea580c',
    sidebarFrom: '#7c2d12',
    sidebarTo: '#ea580c',
    isDark: false,
  },
  {
    key: 'violet',
    label: '紫罗兰',
    labelEn: 'Violet',
    slogan: '神秘优雅，独具魅力',
    swatch: '#8b5cf6',
    headerFrom: '#3b0764',
    headerTo: '#7c3aed',
    panelBg: '#f5f3ff',
    cardBg: '#ffffff',
    cardHover: '#f5f3ff',
    textPrimary: '#3b0764',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    divider: '#ddd6fe',
    stageColors: [
      { color: '#ddd6fe', accent: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
      { color: '#c4b5fd', accent: '#6d28d9', bg: '#f5f3ff', border: '#a78bfa' },
      { color: '#a78bfa', accent: '#7c3aed', bg: '#ede9fe', border: '#8b5cf6' },
      { color: '#8b5cf6', accent: '#6d28d9', bg: '#f5f3ff', border: '#7c3aed' },
      { color: '#7c3aed', accent: '#5b21b6', bg: '#ede9fe', border: '#6d28d9' },
      { color: '#6d28d9', accent: '#4c1d95', bg: '#f5f3ff', border: '#5b21b6' },
      { color: '#5b21b6', accent: '#3b0764', bg: '#ede9fe', border: '#4c1d95' },
      { color: '#4c1d95', accent: '#2e1065', bg: '#f5f3ff', border: '#5b21b6' },
      { color: '#2e1065', accent: '#1a0440', bg: '#ede9fe', border: '#4c1d95' },
    ],
    progressTrack: '#ddd6fe',
    progressFill: '#8b5cf6',
    checkboxDone: '#7c3aed',
    planBtnBg: '#ffffff',
    planBtnText: '#7c3aed',
    plannedBg: '#ddd6fe',
    plannedText: '#6d28d9',
    bodyBg: '#f5f3ff',
    headerOverlay: '#faf8ff',
    todayRing: '#7c3aed',
    cellBorder: 'rgba(148,163,184,0.18)',
    pastBg: 'rgba(240,242,245,0.5)',
    pastWeekendBg: 'rgba(228,230,236,0.55)',
    pastText: '#bfbfbf',
    pastSubtext: '#d0d0d0',
    checkColor: '#8b5cf6',
    crossColor: '#ef4444',
    blueDot: '#7c3aed',
    tabActive: '#7c3aed',
    sidebarFrom: '#4c1d95',
    sidebarTo: '#7c3aed',
    isDark: false,
  },
  {
    key: 'sakura',
    label: '樱花粉',
    labelEn: 'Sakura',
    slogan: '浪漫温柔，如梦如幻',
    swatch: '#ec4899',
    headerFrom: '#831843',
    headerTo: '#db2777',
    panelBg: '#fdf2f8',
    cardBg: '#ffffff',
    cardHover: '#fdf2f8',
    textPrimary: '#831843',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    divider: '#fbcfe8',
    stageColors: [
      { color: '#fbcfe8', accent: '#db2777', bg: '#fdf2f8', border: '#f9a8d4' },
      { color: '#f9a8d4', accent: '#be185d', bg: '#fdf2f8', border: '#f472b6' },
      { color: '#f472b6', accent: '#db2777', bg: '#fce7f3', border: '#ec4899' },
      { color: '#ec4899', accent: '#be185d', bg: '#fdf2f8', border: '#db2777' },
      { color: '#db2777', accent: '#9d174d', bg: '#fce7f3', border: '#be185d' },
      { color: '#be185d', accent: '#831843', bg: '#fdf2f8', border: '#9d174d' },
      { color: '#9d174d', accent: '#500724', bg: '#fce7f3', border: '#831843' },
      { color: '#831843', accent: '#500724', bg: '#fdf2f8', border: '#9d174d' },
      { color: '#500724', accent: '#2d0415', bg: '#fce7f3', border: '#831843' },
    ],
    progressTrack: '#fbcfe8',
    progressFill: '#ec4899',
    checkboxDone: '#db2777',
    planBtnBg: '#ffffff',
    planBtnText: '#db2777',
    plannedBg: '#fbcfe8',
    plannedText: '#be185d',
    bodyBg: '#fdf2f8',
    headerOverlay: '#fffbfd',
    todayRing: '#db2777',
    cellBorder: 'rgba(148,163,184,0.18)',
    pastBg: 'rgba(240,242,245,0.5)',
    pastWeekendBg: 'rgba(228,230,236,0.55)',
    pastText: '#bfbfbf',
    pastSubtext: '#d0d0d0',
    checkColor: '#ec4899',
    crossColor: '#ef4444',
    blueDot: '#db2777',
    tabActive: '#db2777',
    sidebarFrom: '#831843',
    sidebarTo: '#db2777',
    isDark: false,
  },
  {
    key: 'dark',
    label: '暗夜黑',
    labelEn: 'Dark',
    slogan: '低调沉稳，专注内敛',
    swatch: '#374151',
    headerFrom: '#0f172a',
    headerTo: '#1e293b',
    panelBg: '#0f172a',
    cardBg: '#1e293b',
    cardHover: '#334155',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    divider: '#334155',
    stageColors: [
      { color: '#475569', accent: '#60a5fa', bg: '#1e293b', border: '#475569' },
      { color: '#475569', accent: '#818cf8', bg: '#1e293b', border: '#475569' },
      { color: '#475569', accent: '#34d399', bg: '#1e293b', border: '#475569' },
      { color: '#475569', accent: '#fbbf24', bg: '#1e293b', border: '#475569' },
      { color: '#475569', accent: '#f87171', bg: '#1e293b', border: '#475569' },
      { color: '#475569', accent: '#a78bfa', bg: '#1e293b', border: '#475569' },
      { color: '#475569', accent: '#2dd4bf', bg: '#1e293b', border: '#475569' },
      { color: '#475569', accent: '#fb923c', bg: '#1e293b', border: '#475569' },
      { color: '#475569', accent: '#e879f9', bg: '#1e293b', border: '#475569' },
    ],
    progressTrack: '#334155',
    progressFill: '#60a5fa',
    checkboxDone: '#60a5fa',
    planBtnBg: '#334155',
    planBtnText: '#60a5fa',
    plannedBg: '#1e3a5f',
    plannedText: '#60a5fa',
    bodyBg: '#0f172a',
    headerOverlay: '#1e293b',
    todayRing: '#60a5fa',
    cellBorder: 'rgba(100,116,139,0.25)',
    pastBg: 'rgba(30,41,59,0.6)',
    pastWeekendBg: 'rgba(30,41,59,0.7)',
    pastText: '#64748b',
    pastSubtext: '#475569',
    checkColor: '#34d399',
    crossColor: '#f87171',
    blueDot: '#60a5fa',
    tabActive: '#60a5fa',
    sidebarFrom: '#0f172a',
    sidebarTo: '#1e293b',
    isDark: true,
  },
  {
    key: 'forest',
    label: '森林绿',
    labelEn: 'Forest',
    slogan: '自然清新，返璞归真',
    swatch: '#15803d',
    headerFrom: '#14532d',
    headerTo: '#166534',
    panelBg: '#f0fdf4',
    cardBg: '#ffffff',
    cardHover: '#dcfce7',
    textPrimary: '#14532d',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    divider: '#bbf7d0',
    stageColors: [
      { color: '#dcfce7', accent: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
      { color: '#bbf7d0', accent: '#15803d', bg: '#f0fdf4', border: '#4ade80' },
      { color: '#86efac', accent: '#166534', bg: '#dcfce7', border: '#22c55e' },
      { color: '#4ade80', accent: '#14532d', bg: '#f0fdf4', border: '#16a34a' },
      { color: '#22c55e', accent: '#052e16', bg: '#dcfce7', border: '#15803d' },
      { color: '#16a34a', accent: '#052e16', bg: '#f0fdf4', border: '#166534' },
      { color: '#15803d', accent: '#022c22', bg: '#dcfce7', border: '#14532d' },
      { color: '#166534', accent: '#022c22', bg: '#f0fdf4', border: '#15803d' },
      { color: '#14532d', accent: '#011a12', bg: '#dcfce7', border: '#166534' },
    ],
    progressTrack: '#bbf7d0',
    progressFill: '#15803d',
    checkboxDone: '#16a34a',
    planBtnBg: '#ffffff',
    planBtnText: '#16a34a',
    plannedBg: '#bbf7d0',
    plannedText: '#15803d',
    bodyBg: '#f0fdf4',
    headerOverlay: '#f5faf5',
    todayRing: '#15803d',
    cellBorder: 'rgba(148,163,184,0.18)',
    pastBg: 'rgba(240,242,245,0.5)',
    pastWeekendBg: 'rgba(228,230,236,0.55)',
    pastText: '#bfbfbf',
    pastSubtext: '#d0d0d0',
    checkColor: '#16a34a',
    crossColor: '#ef4444',
    blueDot: '#15803d',
    tabActive: '#15803d',
    sidebarFrom: '#14532d',
    sidebarTo: '#15803d',
    isDark: false,
  },
  {
    key: 'lavender',
    label: '薰衣草',
    labelEn: 'Lavender',
    slogan: '清新淡雅，宁静致远',
    swatch: '#a78bfa',
    headerFrom: '#3b0764',
    headerTo: '#6d28d9',
    panelBg: '#faf5ff',
    cardBg: '#ffffff',
    cardHover: '#f5f3ff',
    textPrimary: '#4c1d95',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    divider: '#e9d5ff',
    stageColors: [
      { color: '#e9d5ff', accent: '#8b5cf6', bg: '#faf5ff', border: '#d8b4fe' },
      { color: '#d8b4fe', accent: '#7c3aed', bg: '#faf5ff', border: '#c084fc' },
      { color: '#c084fc', accent: '#9333ea', bg: '#f3e8ff', border: '#a855f7' },
      { color: '#a855f7', accent: '#7e22ce', bg: '#faf5ff', border: '#9333ea' },
      { color: '#9333ea', accent: '#6b21a8', bg: '#f3e8ff', border: '#7e22ce' },
      { color: '#7e22ce', accent: '#581c87', bg: '#faf5ff', border: '#6b21a8' },
      { color: '#6b21a8', accent: '#3b0764', bg: '#f3e8ff', border: '#581c87' },
      { color: '#581c87', accent: '#2e1065', bg: '#faf5ff', border: '#6b21a8' },
      { color: '#3b0764', accent: '#1a0440', bg: '#f3e8ff', border: '#581c87' },
    ],
    progressTrack: '#e9d5ff',
    progressFill: '#a78bfa',
    checkboxDone: '#8b5cf6',
    planBtnBg: '#ffffff',
    planBtnText: '#8b5cf6',
    plannedBg: '#e9d5ff',
    plannedText: '#7c3aed',
    bodyBg: '#faf5ff',
    headerOverlay: '#fdfbff',
    todayRing: '#9333ea',
    cellBorder: 'rgba(148,163,184,0.18)',
    pastBg: 'rgba(240,242,245,0.5)',
    pastWeekendBg: 'rgba(228,230,236,0.55)',
    pastText: '#bfbfbf',
    pastSubtext: '#d0d0d0',
    checkColor: '#a855f7',
    crossColor: '#ef4444',
    blueDot: '#9333ea',
    tabActive: '#9333ea',
    sidebarFrom: '#581c87',
    sidebarTo: '#9333ea',
    isDark: false,
  },
];

export const DEFAULT_SKIN = 'emerald';
