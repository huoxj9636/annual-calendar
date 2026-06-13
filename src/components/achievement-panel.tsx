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
  score: number; // 0-4, 用于格子颜色深度
}

const TYPE_CONFIG = {
  document: { icon: '📄', label: '文档', color: '#3b82f6' },
  video: { icon: '🎬', label: '视频', color: '#ef4444' },
  podcast: { icon: '🎙', label: '播客', color: '#10b981' },
  other: { icon: '📦', label: '其他', color: '#f59e0b' },
};

const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

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

// 计算格子颜色深度 (0-4)
function calculateScore(review: DailyReview | null, achievements: Achievement[]): number {
  if (!review && achievements.length === 0) return 0;
  let score = 0;
  // 有复盘 +1
  if (review) score += 1;
  // 心情分数高 +1
  if (review && review.moodScore >= 4) score += 1;
  // 有成果 +1
  if (achievements.length > 0) score += 1;
  // 成果数量多 +1
  if (achievements.length >= 2) score += 1;
  return Math.min(score, 4);
}

export default function AchievementPanel({ year, month, day, skin, onClose }: AchievementPanelProps) {
  const today = new Date(year, month - 1, day);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [daysData, setDaysData] = useState<Map<string, DayData>>(new Map());
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<Achievement['type']>('document');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [panelWidth, setPanelWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const gridRef = useRef<HTMLDivElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const s = skin;

  // 生成格子网格数据
  const generateGridData = useCallback((weeksBack: number = 16) => {
    const grid: { date: Date; key: string; score: number; isToday: boolean; isSelected: boolean }[][] = [];
    
    // 计算起始日期：从今天往前推 weeksBack 周，然后定位到那一周的周日
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - weeksBack * 7);
    // 调整到周日
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    for (let week = 0; week < weeksBack; week++) {
      const weekColumn: { date: Date; key: string; score: number; isToday: boolean; isSelected: boolean }[] = [];
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(cellDate.getDate() + week * 7 + dayOfWeek);
        
        const key = formatDateKey(cellDate.getFullYear(), cellDate.getMonth() + 1, cellDate.getDate());
        const data = daysData.get(key);
        const score = data ? calculateScore(data.review, data.achievements) : 0;
        const isToday = cellDate.getTime() === today.getTime();
        const isSelected = selectedDate.getTime() === cellDate.getTime();
        
        weekColumn.push({ date: cellDate, key, score, isToday, isSelected });
      }
      grid.push(weekColumn);
    }
    
    return grid;
  }, [today, daysData, selectedDate]);

  // 计算月份标签位置
  const getMonthLabels = useCallback((grid: ReturnType<typeof generateGridData>) => {
    const labels: { month: number; year: number; position: number }[] = [];
    let lastMonth = -1;
    
    grid.forEach((week, weekIndex) => {
      // 取这一周的周一（index=1）来判断月份
      const monday = week[1]?.date;
      if (!monday) return;
      const m = monday.getMonth() + 1;
      const y = monday.getFullYear();
      
      if (m !== lastMonth) {
        labels.push({ month: m, year: y, position: weekIndex });
        lastMonth = m;
      }
    });
    
    return labels;
  }, []);

  // 加载某一天的数据
  const loadDayData = useCallback(async (date: Date): Promise<DayData> => {
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

    // 从 API 读取复盘
    let review: DailyReview | null = null;
    try {
      const res = await fetch(`/api/daily-review?year=${y}&month=${m}&day=${d}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.review) {
          review = {
            completed: data.review.completed || '',
            goodThings: data.review.good_things || '',
            problems: data.review.problems || '',
            mood: data.review.mood || '',
            reflections: data.review.reflections || '',
            tomorrowTodo: data.review.tomorrow_todo || '',
            moodScore: data.review.mood_score || 0,
            energy: data.review.energy || 0,
          };
        }
      }
    } catch {}

    const score = calculateScore(review, achievements);

    return {
      date,
      year: y,
      month: m,
      day: d,
      weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()],
      label: getDateLabel(date, today),
      review,
      achievements,
      hasData: !!review || achievements.length > 0,
      score,
    };
  }, [today]);

  // 初始化加载所有格子数据
  useEffect(() => {
    const initLoad = async () => {
      // 加载16周的数据
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 16 * 7 + 7); // 从上周日开始
      
      const newMap = new Map<string, DayData>();
      
      // 批量加载
      const datesToLoad: Date[] = [];
      for (let i = 0; i < 16 * 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() - i);
        datesToLoad.push(d);
      }
      
      for (const date of datesToLoad) {
        const data = await loadDayData(date);
        newMap.set(formatDateKey(data.year, data.month, data.day), data);
      }
      
      setDaysData(newMap);
    };
    initLoad();
  }, [loadDayData, today]);

  // 滚动加载更多历史
  const handleGridScroll = useCallback(async () => {
    if (!gridRef.current || loadTimeoutRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = gridRef.current;
    
    // 滚动到底部时加载更多（这里底部是更早的历史）
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      loadTimeoutRef.current = setTimeout(async () => {
        // 加载额外4周
        const oldestDate = Array.from(daysData.values())
          .reduce((oldest, d) => d.date < oldest ? d.date : oldest, today);
        
        const newDates: Date[] = [];
        for (let i = 1; i <= 4 * 7; i++) {
          const d = new Date(oldestDate);
          d.setDate(d.getDate() - i);
          newDates.push(d);
        }
        
        const newMap = new Map(daysData);
        for (const date of newDates) {
          const data = await loadDayData(date);
          newMap.set(formatDateKey(data.year, data.month, data.day), data);
        }
        
        setDaysData(newMap);
        loadTimeoutRef.current = null;
      }, 300);
    }
  }, [daysData, loadDayData, today]);

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
    const newMap = new Map(daysData);
    const newData: DayData = {
      ...currentData!,
      achievements: updated,
      hasData: true,
      score: calculateScore(currentData?.review || null, updated),
    };
    newMap.set(key, newData);
    setDaysData(newMap);
  }, [selectedDate, currentData, daysData]);

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
    
    const newMap = new Map(daysData);
    const newData: DayData = {
      ...currentData!,
      achievements: updated,
      hasData: !!currentData?.review || updated.length > 0,
      score: calculateScore(currentData?.review || null, updated),
    };
    newMap.set(key, newData);
    setDaysData(newMap);
  }, [selectedDate, currentData, daysData]);

  // 提交表单
  const handleSubmitForm = useCallback(() => {
    if (!formTitle.trim()) return;
    const achievement: Achievement = {
      id: Date.now().toString(),
      type: formType,
      title: formTitle,
      description: formDesc,
      url: formUrl || undefined,
      createdAt: new Date().toISOString(),
    };
    saveAchievement(achievement);
    setShowForm(false);
    setFormTitle('');
    setFormDesc('');
    setFormUrl('');
  }, [formType, formTitle, formDesc, formUrl, saveAchievement]);

  // 拖拽调整宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = panelWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.max(0, Math.min(500, startWidth + delta));
      setPanelWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  // 格子颜色映射
  const getCellColor = useCallback((score: number, isSelected: boolean) => {
    const baseColor = s.swatch; // 使用皮肤主题色
    const opacityMap = [0, 0.15, 0.35, 0.55, 0.75];
    const opacity = opacityMap[score];
    
    if (isSelected) {
      return { bg: baseColor, border: baseColor, opacity: 1 };
    }
    return { bg: baseColor, border: score > 0 ? baseColor : 'transparent', opacity };
  }, [s.swatch]);

  const grid = generateGridData(16);
  const monthLabels = getMonthLabels(grid);

  return (
    <div 
      className="absolute top-0 bottom-0 right-0 z-40 flex bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)]"
      style={{ width: `calc(100% - ${panelWidth}px)` }}
    >
      {/* 左侧格子时间轴 */}
      <div className="w-[140px] border-r border-black/10 flex flex-col">
        {/* 顶部标题 */}
        <div className="p-3 border-b border-black/10">
          <div className="text-sm font-medium text-black/70">成果时间轴</div>
        </div>
        
        {/* 格子网格区域 */}
        <div 
          ref={gridRef}
          onScroll={handleGridScroll}
          className="flex-1 overflow-x-hidden overflow-y-auto p-2"
        >
          {/* 月份标签 */}
          <div className="flex mb-1 pl-[14px]">
            {monthLabels.map((label, i) => (
              <div 
                key={`${label.year}-${label.month}`}
                className="text-xs text-black/40"
                style={{ 
                  position: 'relative',
                  left: label.position * 14 - (i > 0 ? monthLabels[i-1].position * 14 : 0),
                  width: `${(monthLabels[i+1]?.position || grid.length) - label.position}em`
                }}
              >
                {label.month}月
              </div>
            ))}
          </div>
          
          {/* 格子网格 */}
          <div className="flex flex-col-reverse"> {/* reverse 让历史日期在底部 */}
            {/* 周几标签 */}
            <div className="flex pl-[14px]">
              {WEEKDAY_SHORT.map((w, i) => (
                <div key={i} className="w-[14px] text-center">
                  <span className="text-xs text-black/30 block">{i % 2 === 1 ? w : ''}</span>
                </div>
              ))}
            </div>
            
            {/* 格子 - 横向滚动 */}
            <div className="flex overflow-x-auto pb-2">
              {grid.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col mr-0.5">
                  {week.map((cell, dayIdx) => {
                    const colorInfo = getCellColor(cell.score, cell.isSelected);
                    const isFuture = cell.date > today;
                    
                    return (
                      <div
                        key={dayIdx}
                        className={`w-[12px] h-[12px] rounded-sm cursor-pointer transition-all ${
                          cell.isSelected ? 'ring-2 ring-offset-1' : ''
                        } ${isFuture ? 'opacity-30' : ''}`}
                        style={{
                          backgroundColor: colorInfo.bg,
                          opacity: colorInfo.opacity,
                          boxShadow: cell.isSelected ? `0 0 0 2px ${colorInfo.border}` : undefined,
                        }}
                        onClick={() => setSelectedDate(cell.date)}
                        title={`${cell.date.getFullYear()}-${cell.date.getMonth()+1}-${cell.date.getDate()}${cell.score > 0 ? ` (得分:${cell.score})` : ''}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          
          {/* 加载提示 */}
          <div className="text-xs text-black/30 text-center mt-2">
            向下滚动加载更多历史
          </div>
        </div>
        
        {/* 底部添加按钮 */}
        <div className="p-2 border-t border-black/10">
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-1 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors text-sm text-black/60"
          >
            <span className="text-base">+</span>
            <span>添加成果</span>
          </button>
        </div>
      </div>
      
      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
          <div>
            <div className="text-lg font-medium">
              {getDateLabel(selectedDate, today)}
            </div>
            <div className="text-sm text-black/50">
              {selectedDate.getFullYear()}年{selectedDate.getMonth()+1}月{selectedDate.getDate()}日 · {['周日','周一','周二','周三','周四','周五','周六'][selectedDate.getDay()]}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black/50">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </button>
        </div>
        
        {/* 内容滚动区 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* 今日复盘 */}
          {currentData?.review && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-black/70 mb-3 flex items-center gap-2">
                <span>📋</span> 今日复盘
              </h3>
              <div className="space-y-3 text-sm">
                {currentData.review.completed && (
                  <div>
                    <div className="text-black/40 mb-1">完成事项</div>
                    <div className="text-black/80 whitespace-pre-wrap">{currentData.review.completed}</div>
                  </div>
                )}
                {currentData.review.goodThings && (
                  <div>
                    <div className="text-black/40 mb-1">美好事件</div>
                    <div className="text-black/80 whitespace-pre-wrap">{currentData.review.goodThings}</div>
                  </div>
                )}
                {currentData.review.problems && (
                  <div>
                    <div className="text-black/40 mb-1">突发问题</div>
                    <div className="text-black/80 whitespace-pre-wrap">{currentData.review.problems}</div>
                  </div>
                )}
                {currentData.review.mood && (
                  <div>
                    <div className="text-black/40 mb-1">心情</div>
                    <div className="text-black/80 whitespace-pre-wrap">{currentData.review.mood}</div>
                  </div>
                )}
                {currentData.review.reflections && (
                  <div>
                    <div className="text-black/40 mb-1">感想总结</div>
                    <div className="text-black/80 whitespace-pre-wrap">{currentData.review.reflections}</div>
                  </div>
                )}
                {currentData.review.tomorrowTodo && (
                  <div>
                    <div className="text-black/40 mb-1">明日待办</div>
                    <div className="text-black/80 whitespace-pre-wrap">{currentData.review.tomorrowTodo}</div>
                  </div>
                )}
                {/* 分数展示 */}
                {(currentData.review.moodScore > 0 || currentData.review.energy > 0) && (
                  <div className="flex gap-4 pt-2 border-t border-black/5">
                    {currentData.review.moodScore > 0 && (
                      <div>
                        <div className="text-black/40 text-xs">心情分数</div>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <span key={i} className={i <= (currentData.review?.moodScore ?? 0) ? 'text-yellow-400' : 'text-black/20'}>★</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {currentData.review.energy > 0 && (
                      <div>
                        <div className="text-black/40 text-xs">精力分数</div>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <span key={i} className={i <= (currentData.review?.energy ?? 0) ? 'text-green-400' : 'text-black/20'}>⚡</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 无复盘提示 */}
          {!currentData?.review && (
            <div className="mb-6 text-center py-4 text-black/30 text-sm">
              当日暂无复盘记录
            </div>
          )}
          
          {/* 输出成果 */}
          <div>
            <h3 className="text-sm font-medium text-black/70 mb-3 flex items-center gap-2">
              <span>🏆</span> 输出成果
              {currentData?.achievements && currentData.achievements.length > 0 && (
                <span className="text-xs text-black/40 ml-1">({currentData.achievements.length})</span>
              )}
            </h3>
            
            {currentData?.achievements && currentData.achievements.length > 0 ? (
              <div className="space-y-2">
                {currentData.achievements.map(a => {
                  const cfg = TYPE_CONFIG[a.type];
                  return (
                    <div 
                      key={a.id}
                      className="group flex items-start gap-3 p-3 rounded-lg border border-black/5 hover:border-black/10 transition-colors"
                      style={{ backgroundColor: `${cfg.color}08` }}
                    >
                      <span className="text-xl">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-black/80">{a.title}</div>
                        {a.description && (
                          <div className="text-sm text-black/50 mt-1">{a.description}</div>
                        )}
                        {a.url && (
                          <a 
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline mt-1 block truncate"
                          >
                            {a.url}
                          </a>
                        )}
                      </div>
                      {/* 删除按钮 */}
                      <button
                        onClick={() => deleteAchievement(a.id)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500/20 transition-all text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-black/30 text-sm">
                暂无输出成果
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 添加成果表单弹窗 */}
      {showForm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-xl shadow-lg w-[320px] max-w-[90%] overflow-hidden">
            <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between">
              <div className="font-medium">添加成果</div>
              <button
                onClick={() => setShowForm(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              {/* 类型选择 */}
              <div className="flex gap-2">
                {(Object.entries(TYPE_CONFIG) as [Achievement['type'], { icon: string; label: string; color: string }][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setFormType(key)}
                    className={`p-2 rounded-lg text-center transition-colors ${
                      formType === key ? 'ring-2 ring-offset-1' : 'hover:bg-black/5'
                    }`}
                    style={{ 
                      boxShadow: formType === key ? `0 0 0 2px ${cfg.color}` : undefined,
                      backgroundColor: formType === key ? `${cfg.color}15` : undefined,
                    }}
                  >
                    <span className="text-lg">{cfg.icon}</span>
                    <span className="text-xs block mt-1">{cfg.label}</span>
                  </button>
                ))}
              </div>
              
              {/* 标题 */}
              <div>
                <div className="text-xs text-black/50 mb-1">标题</div>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-black/10 focus:border-black/30 focus:outline-none text-sm"
                  placeholder="成果名称"
                />
              </div>
              
              {/* 描述 */}
              <div>
                <div className="text-xs text-black/50 mb-1">描述</div>
                <textarea
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-black/10 focus:border-black/30 focus:outline-none text-sm resize-none"
                  placeholder="简要描述"
                  rows={2}
                />
              </div>
              
              {/* 链接 */}
              <div>
                <div className="text-xs text-black/50 mb-1">链接（可选）</div>
                <input
                  type="text"
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-black/10 focus:border-black/30 focus:outline-none text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
            
            <div className="px-4 py-3 border-t border-black/10 flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg bg-black/5 hover:bg-black/10 text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSubmitForm}
                disabled={!formTitle.trim()}
                className="flex-1 py-2 rounded-lg bg-black text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/80"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 拖拽手柄 */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-black/10 transition-colors ${isDragging ? 'bg-black/10' : ''}`}
      />
    </div>
  );
}