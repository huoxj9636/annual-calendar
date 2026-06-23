'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SkinTheme } from '@/lib/skins';

interface AchievementPanelProps {
  year: number;
  month: number;
  day: number;
  skin: SkinTheme;
  onClose: () => void;
}

interface Achievement {
  id: string;
  type: 'document' | 'video' | 'podcast' | 'other';
  title: string;
  description: string;
  url?: string;
  createdAt: string;
}

interface DailyReview {
  completed: string;
  goodThings: string;
  problems: string;
  mood: string;
  reflections: string;
  tomorrowTodo: string;
  moodScore: number;
  energy: number;
}

interface DayData {
  date: Date;
  year: number;
  month: number;
  day: number;
  weekday: string;
  label: string;
  review: DailyReview | null;
  achievements: Achievement[];
  hasData: boolean;
}

const TYPE_CONFIG = {
  document: { icon: '📄', label: '文档', color: '#3b82f6' },
  video: { icon: '🎬', label: '视频', color: '#ef4444' },
  podcast: { icon: '🎙', label: '播客', color: '#10b981' },
  other: { icon: '📦', label: '其他', color: '#f59e0b' },
};

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatDateKey(y: number, m: number, d: number): string {
  return `${y}-${m}-${d}`;
}

function getDateLabel(date: Date, today: Date): string {
  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  if (diff <= 7) return `${diff}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function AchievementPanel({ year, month, day, skin, onClose }: AchievementPanelProps) {
  // 实际的今天（用于判断"今天"标签）
  const realToday = new Date();
  realToday.setHours(0, 0, 0, 0);
  // 日历视图日期（用于默认选中）
  const viewDate = new Date(year, month - 1, day);
  const [selectedDate, setSelectedDate] = useState<Date>(viewDate);
  const [daysData, setDaysData] = useState<Map<string, DayData>>(new Map());
  const [loadedDays, setLoadedDays] = useState(30); // 日期列表长度（不涉及API）
  const [loadingDate, setLoadingDate] = useState<string | null>(null); // 当前正在加载的日期
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<Achievement['type']>('document');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [panelWidth, setPanelWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const s = skin;

  // 生成日期列表（从实际今天开始）
  const generateDateList = useCallback((count: number): Date[] => {
    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(realToday);
      d.setDate(d.getDate() - i);
      dates.push(d);
    }
    return dates;
  }, [realToday]);

  // 快速加载某一天的成果数据（仅 localStorage，不请求 API）
  const loadAchievementsOnly = useCallback((date: Date): DayData => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const key = formatDateKey(y, m, d);

    // 从 localStorage 读取成果
    const storageKey = `achievements-${key}`;
    let achievements: Achievement[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) achievements = JSON.parse(stored);
    } catch {}

    return {
      date,
      year: y,
      month: m,
      day: d,
      weekday: WEEKDAY_NAMES[date.getDay()],
      label: getDateLabel(date, realToday),
      review: null, // 初始不加载复盘，点击时再请求
      achievements,
      hasData: achievements.length > 0,
    };
  }, [realToday]);

  // 请求某一天的复盘 API（点击时调用）
  const fetchReviewData = useCallback(async (date: Date) => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const key = formatDateKey(y, m, d);

    setLoadingDate(key);
    try {
      const res = await fetch(`/api/daily-review?year=${y}&month=${m}&day=${d}`);
      if (res.ok) {
        const data = await res.json();
        const review: DailyReview = {
          completed: data.completed || '',
          goodThings: data.goodThings || '',
          problems: data.problems || '',
          mood: data.mood || '',
          reflections: data.reflections || '',
          tomorrowTodo: data.tomorrowTodo || '',
          moodScore: data.moodScore || 0,
          energy: data.energy || 0,
        };
        // 更新该日期的数据
        setDaysData(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(key);
          if (existing) {
            newMap.set(key, { ...existing, review, hasData: true });
          } else {
            // 如果不存在，创建完整数据
            newMap.set(key, {
              date,
              year: y,
              month: m,
              day: d,
              weekday: WEEKDAY_NAMES[date.getDay()],
              label: getDateLabel(date, realToday),
              review,
              achievements: [],
              hasData: true,
            });
          }
          return newMap;
        });
      }
    } catch {}
    setLoadingDate(null);
  }, [realToday]);

  // 初始化加载（仅成果数据，快速）
  useEffect(() => {
    const dates = generateDateList(loadedDays);
    const newMap = new Map<string, DayData>();
    for (const date of dates) {
      const data = loadAchievementsOnly(date);
      newMap.set(formatDateKey(data.year, data.month, data.day), data);
    }
    setDaysData(newMap);
    // 自动加载今天的复盘数据
    fetchReviewData(realToday);
  }, [loadedDays, generateDateList, loadAchievementsOnly, fetchReviewData, realToday]);

  // 滚动加载更多（仅成果数据，快速）
  const handleSidebarScroll = useCallback(() => {
    if (loadingMoreRef.current || !sidebarRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = sidebarRef.current;
    if (scrollTop < 50) {
      // 接近顶部，加载更多历史
      loadingMoreRef.current = true;
      const newLoadedDays = loadedDays + 30;
      const newDates = generateDateList(newLoadedDays).slice(loadedDays);
      const newMap = new Map(daysData);
      for (const date of newDates) {
        const data = loadAchievementsOnly(date);
        newMap.set(formatDateKey(data.year, data.month, data.day), data);
      }
      setDaysData(newMap);
      setLoadedDays(newLoadedDays);
      loadingMoreRef.current = false;
    }
  }, [loadedDays, daysData, generateDateList, loadAchievementsOnly]);

  // 当前选中日期的数据
  const selectedKey = formatDateKey(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
    selectedDate.getDate()
  );
  const currentData = daysData.get(selectedKey);

  // 保存成果
  const saveAchievement = useCallback((achievement: Achievement) => {
    const key = formatDateKey(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
      selectedDate.getDate()
    );
    const storageKey = `achievements-${key}`;
    const current = currentData?.achievements || [];
    const updated = [...current, achievement];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    
    // 更新状态
    setDaysData(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(key);
      if (existing) {
        newMap.set(key, { ...existing, achievements: updated, hasData: true });
      }
      return newMap;
    });
  }, [selectedDate, currentData]);

  // 删除成果
  const deleteAchievement = useCallback((id: string) => {
    const key = formatDateKey(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
      selectedDate.getDate()
    );
    const storageKey = `achievements-${key}`;
    const updated = (currentData?.achievements || []).filter(a => a.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    
    setDaysData(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(key);
      if (existing) {
        newMap.set(key, { 
          ...existing, 
          achievements: updated, 
          hasData: !!existing.review || updated.length > 0 
        });
      }
      return newMap;
    });
  }, [selectedDate, currentData]);

  // 添加成果
  const handleAddAchievement = () => {
    if (!formTitle.trim()) return;
    const achievement: Achievement = {
      id: Date.now().toString(),
      type: formType,
      title: formTitle.trim(),
      description: formDesc.trim(),
      url: formUrl.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    saveAchievement(achievement);
    setShowForm(false);
    setFormTitle('');
    setFormDesc('');
    setFormUrl('');
    setFormType('document');
  };

  // 拖拽调整宽度
  const handleDragStart = () => setIsDragging(true);
  const handleDrag = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newWidth = window.innerWidth - e.clientX;
    setPanelWidth(Math.max(0, Math.min(500, newWidth)));
  };
  const handleDragEnd = () => setIsDragging(false);

  // 日期列表渲染
  const dateList = generateDateList(loadedDays);

  return (
    <div 
      className="absolute top-0 bottom-0 right-0 z-40 bg-white shadow-2xl flex"
      style={{ 
        width: panelWidth > 0 ? panelWidth : '100%',
        borderLeft: `1px solid ${s.divider}`,
      }}
    >
      {/* 拖拽手柄 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize z-50 hover:bg-black/5 transition-colors"
        onMouseDown={handleDragStart}
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      />

      {/* 左侧时间轴导航 */}
      <div 
        ref={sidebarRef}
        onScroll={handleSidebarScroll}
        className="w-72 flex-shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ borderColor: s.divider, backgroundColor: `${s.sidebarFrom}10` }}
      >
        {/* 标题 */}
        <div className="px-5 pt-4 pb-3 border-b sticky top-0 bg-white/95" style={{ borderColor: s.divider }}>
          <div className="text-lg font-bold" style={{ color: s.textPrimary }}>成果时间轴</div>
          <div className="text-xs font-medium tracking-wider mt-0.5" style={{ color: s.swatch }}>OUTPUT TIMELINE</div>
        </div>

        {/* 日期列表 */}
        <div className="py-2">
          {dateList.map(date => {
            const key = formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
            const data = daysData.get(key);
            const isSelected = selectedDate.getTime() === date.getTime();
            
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedDate(date);
                  // 点击日期时请求复盘数据
                  const y = date.getFullYear();
                  const m = date.getMonth() + 1;
                  const d = date.getDate();
                  const key = formatDateKey(y, m, d);
                  // 如果该日期还没有复盘数据，则请求
                  const existing = daysData.get(key);
                  if (!existing?.review) {
                    fetchReviewData(date);
                  }
                }}
                className={`w-full px-5 py-3 flex items-center gap-3 transition-colors ${
                  isSelected ? 'bg-black/5' : 'hover:bg-black/3'
                }`}
              >
                {/* 左侧圆点指示器 */}
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ 
                    backgroundColor: data?.hasData ? s.swatch : s.divider,
                    boxShadow: isSelected ? `0 0 0 3px ${s.swatch}33` : 'none',
                  }}
                />
                
                {/* 日期信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: isSelected ? s.swatch : s.textPrimary }}>
                      {data?.label || getDateLabel(date, realToday)}
                    </span>
                    <span className="text-xs" style={{ color: s.textMuted }}>
                      {WEEKDAY_NAMES[date.getDay()]}
                    </span>
                  </div>
                  {/* 成果摘要 */}
                  {data?.hasData && (
                    <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: s.textMuted }}>
                      {data.achievements.length > 0 && (
                        <span>{data.achievements.length}项成果</span>
                      )}
                      {data.review?.moodScore && data.review.moodScore > 0 && (
                        <span className="ml-1">心情{data.review.moodScore}⭐</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          
          {/* 加载更多提示 */}
          <div className="px-5 py-3 text-center text-xs" style={{ color: s.textMuted }}>
            向上滚动加载更多...
          </div>
        </div>

        {/* 添加成果按钮 - 左下角 */}
        <div className="p-4 border-t sticky bottom-0 bg-white/95" style={{ borderColor: s.divider }}>
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            style={{ backgroundColor: s.swatch, color: '#fff' }}
          >
            <span>+</span> 添加成果
          </button>
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: s.divider }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="text-xl font-bold" style={{ color: s.textPrimary }}>
                {currentData?.label || getDateLabel(selectedDate, realToday)}
              </div>
              <div className="text-xs" style={{ color: s.textMuted }}>
                {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 · {WEEKDAY_NAMES[selectedDate.getDay()]}
              </div>
            </div>
          </div>
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.textMuted} strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容滚动区 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* 加载中提示 */}
          {loadingDate === selectedKey && (
            <div className="mb-4 p-3 rounded-lg bg-black/5 text-center text-sm" style={{ color: s.textMuted }}>
              <span className="inline-block animate-spin mr-2">⏳</span> 加载复盘数据...
            </div>
          )}
          
          {/* 今日复盘 - 六项框框始终展示 */}
          <section className="mb-6">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: s.textPrimary }}>
              <span>📝</span> 今日复盘
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {/* 完成事项 */}
                <div className="p-3 rounded-lg border" style={{ borderColor: s.divider, backgroundColor: `${s.swatch}05` }}>
                  <div className="text-xs font-medium mb-1" style={{ color: s.swatch }}>✅ 完成事项</div>
                  <div className="text-sm" style={{ color: currentData?.review?.completed ? s.textPrimary : s.textMuted }}>
                    {currentData?.review?.completed || '暂无记录'}
                  </div>
                </div>
                {/* 美好事件 */}
                <div className="p-3 rounded-lg border bg-green-50/30" style={{ borderColor: '#22c55e20' }}>
                  <div className="text-xs font-medium mb-1 text-green-600">😊 美好事件</div>
                  <div className="text-sm" style={{ color: currentData?.review?.goodThings ? s.textPrimary : s.textMuted }}>
                    {currentData?.review?.goodThings || '暂无记录'}
                  </div>
                </div>
                {/* 突发问题 */}
                <div className="p-3 rounded-lg border bg-red-50/30" style={{ borderColor: '#ef444420' }}>
                  <div className="text-xs font-medium mb-1 text-red-500">⚠️ 突发问题</div>
                  <div className="text-sm" style={{ color: currentData?.review?.problems ? s.textPrimary : s.textMuted }}>
                    {currentData?.review?.problems || '暂无记录'}
                  </div>
                </div>
                {/* 心情 */}
                <div className="p-3 rounded-lg border" style={{ borderColor: s.divider, backgroundColor: `${s.swatch}05` }}>
                  <div className="text-xs font-medium mb-1" style={{ color: s.swatch }}>💭 心情</div>
                  <div className="text-sm" style={{ color: currentData?.review?.mood ? s.textPrimary : s.textMuted }}>
                    {currentData?.review?.mood || '暂无记录'}
                  </div>
                </div>
                {/* 感想总结 */}
                <div className="p-3 rounded-lg border" style={{ borderColor: s.divider, backgroundColor: `${s.swatch}05` }}>
                  <div className="text-xs font-medium mb-1" style={{ color: s.swatch }}>💡 感想总结</div>
                  <div className="text-sm" style={{ color: currentData?.review?.reflections ? s.textPrimary : s.textMuted }}>
                    {currentData?.review?.reflections || '暂无记录'}
                  </div>
                </div>
                {/* 明日待办 */}
                <div className="p-3 rounded-lg border bg-blue-50/30" style={{ borderColor: '#3b82f620' }}>
                  <div className="text-xs font-medium mb-1 text-blue-600">📋 明日待办</div>
                  <div className="text-sm" style={{ color: currentData?.review?.tomorrowTodo ? s.textPrimary : s.textMuted }}>
                    {currentData?.review?.tomorrowTodo || '暂无记录'}
                  </div>
                </div>
              </div>
              {/* 分数 - 横向展示 */}
              <div className="flex gap-6 mt-3 p-3 rounded-lg border" style={{ borderColor: s.divider }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: s.textMuted }}>心情分数</span>
                  <span className="text-sm font-bold">
                    {currentData?.review?.moodScore && currentData.review.moodScore > 0 
                      ? Array(currentData.review.moodScore).fill('⭐').join('') 
                      : <span style={{ color: s.textMuted }}>未评分</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: s.textMuted }}>精力分数</span>
                  <span className="text-sm font-bold">
                    {currentData?.review?.energy && currentData.review.energy > 0 
                      ? Array(currentData.review.energy).fill('⚡').join('') 
                      : <span style={{ color: s.textMuted }}>未评分</span>}
                  </span>
                </div>
              </div>
            </section>

          {/* 输出成果 */}
          <section>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: s.textPrimary }}>
              <span>📦</span> 输出成果
              {currentData && currentData.achievements.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: s.swatch, color: '#fff' }}>
                  {currentData.achievements.length}
                </span>
              )}
            </h3>
            {currentData && currentData.achievements.length > 0 ? (
              <div className="grid gap-3">
                {currentData.achievements.map(a => (
                  <div 
                    key={a.id} 
                    className="p-4 rounded-lg border group relative transition-colors hover:bg-black/3"
                    style={{ borderColor: s.divider }}
                  >
                    {/* 类型图标 */}
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{TYPE_CONFIG[a.type].icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium" style={{ color: s.textPrimary }}>{a.title}</div>
                        {a.description && (
                          <div className="text-sm mt-1" style={{ color: s.textMuted }}>{a.description}</div>
                        )}
                        {a.url && (
                          <a 
                            href={a.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm mt-2 inline-flex items-center gap-1 hover:underline"
                            style={{ color: TYPE_CONFIG[a.type].color }}
                          >
                            🔗 查看链接
                          </a>
                        )}
                      </div>
                    </div>
                    {/* 删除按钮 */}
                    <button
                      onClick={() => deleteAchievement(a.id)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/5 hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm py-8 text-center" style={{ color: s.textMuted }}>
                当天暂无输出成果
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 添加成果弹窗 */}
      {showForm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20">
          <div 
            className="w-80 rounded-xl shadow-2xl p-5"
            style={{ backgroundColor: '#fff', border: `1px solid ${s.divider}` }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: s.textPrimary }}>添加成果</h3>
            
            {/* 类型选择 */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setFormType(key as Achievement['type'])}
                  className={`p-2 rounded-lg text-center transition-colors ${
                    formType === key ? 'ring-2 ring-offset-1' : 'hover:bg-black/5'
                  }`}
                  style={{ 
                    boxShadow: formType === key ? `0 0 0 2px ${cfg.color}` : undefined,
                    backgroundColor: formType === key ? `${cfg.color}15` : undefined,
                  }}
                >
                  <div className="text-xl">{cfg.icon}</div>
                  <div className="text-xs mt-1" style={{ color: cfg.color }}>{cfg.label}</div>
                </button>
              ))}
            </div>

            {/* 标题 */}
            <input
              type="text"
              placeholder="成果标题"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border mb-3 text-sm"
              style={{ borderColor: s.divider }}
            />

            {/* 描述 */}
            <textarea
              placeholder="成果描述（可选）"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border mb-3 text-sm resize-none"
              style={{ borderColor: s.divider }}
              rows={2}
            />

            {/* 链接 */}
            <input
              type="url"
              placeholder="链接地址（可选）"
              value={formUrl}
              onChange={e => setFormUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border mb-4 text-sm"
              style={{ borderColor: s.divider }}
            />

            {/* 按钮 */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: s.divider, color: s.textMuted }}
              >
                取消
              </button>
              <button
                onClick={handleAddAchievement}
                disabled={!formTitle.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: s.swatch, color: '#fff' }}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}