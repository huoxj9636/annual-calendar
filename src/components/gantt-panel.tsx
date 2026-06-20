'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, Clock, AlertTriangle, Star, ChevronLeft, ChevronRight } from 'lucide-react';

interface GanttEvent {
  id: string;
  startTime: string; // 格式 "HH:MM"
  endTime: string;   // 格式 "HH:MM"
  title: string;
  description?: string;
  priority?: 'urgent' | 'important' | 'normal'; // 最紧急 | 最重要 | 普通
  color?: string;
  done?: boolean;
}

interface GanttPanelProps {
  year: number;
  month: number;
  day: number;
  skin?: {
    panelBg: string;
    cardBg: string;
    cardHover: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    divider: string;
    swatch: string;
    checkColor: string;
    crossColor: string;
    tabActive: string;
    sidebarFrom: string;
    sidebarTo: string;
  };
  onClose: () => void;
}

// 时间范围：6:00 - 23:00
const START_HOUR = 6;
const END_HOUR = 23;
const HOUR_WIDTH = 60; // 每小时的宽度（像素）
const ROW_HEIGHT = 44; // 每行的高度

const priorityColors = {
  urgent: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-500', label: '最紧急' },
  important: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-500', label: '最重要' },
  normal: { bg: 'bg-muted/30', border: 'border-muted-foreground/30', text: 'text-muted-foreground', label: '' },
};

const priorityOrder = { urgent: 0, important: 1, normal: 2 };

export default function GanttPanel({ year, month, day, skin, onClose }: GanttPanelProps) {
  const [events, setEvents] = useState<GanttEvent[]>([]);
  const [mounted, setMounted] = useState(false);
  const [navYear, setNavYear] = useState(year);
  const [navMonth, setNavMonth] = useState(month);
  const [navDay, setNavDay] = useState(day);

  // 添加任务弹框
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addStartTime, setAddStartTime] = useState('09:00');
  const [addEndTime, setAddEndTime] = useState('10:00');
  const [addPriority, setAddPriority] = useState<'urgent' | 'important' | 'normal'>('normal');
  const [addDescription, setAddDescription] = useState('');

  // 编辑任务
  const [editingEvent, setEditingEvent] = useState<GanttEvent | null>(null);

  const storageKey = `gantt-events-${navYear}-${navMonth}-${navDay}`;
  const ganttRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setNavYear(year); setNavMonth(month); setNavDay(day); }, [year, month, day]);
  useEffect(() => { setMounted(true); }, []);

  // 加载事件
  useEffect(() => {
    if (!mounted) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setEvents(JSON.parse(saved));
      } catch {
        setEvents([]);
      }
    } else {
      setEvents([]);
    }
  }, [mounted, storageKey]);

  // 保存事件
  const saveEvents = useCallback((newEvents: GanttEvent[]) => {
    setEvents(newEvents);
    localStorage.setItem(storageKey, JSON.stringify(newEvents));
  }, [storageKey]);

  // 时间字符串转像素位置
  const timeToPosition = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m;
    const startMinutes = START_HOUR * 60;
    const position = ((totalMinutes - startMinutes) / 60) * HOUR_WIDTH;
    return Math.max(0, position);
  };

  // 时间字符串转宽度
  const timeToWidth = (startTime: string, endTime: string): number => {
    const start = timeToPosition(startTime);
    const end = timeToPosition(endTime);
    return Math.max(HOUR_WIDTH / 4, end - start); // 最小宽度15分钟
  };

  // 添加任务
  const handleAddEvent = () => {
    if (!addTitle.trim()) return;
    const newEvent: GanttEvent = {
      id: Date.now().toString(),
      startTime: addStartTime,
      endTime: addEndTime,
      title: addTitle,
      description: addDescription,
      priority: addPriority,
      done: false,
    };
    saveEvents([...events, newEvent]);
    setShowAddModal(false);
    setAddTitle('');
    setAddStartTime('09:00');
    setAddEndTime('10:00');
    setAddPriority('normal');
    setAddDescription('');
  };

  // 删除任务
  const handleDeleteEvent = (id: string) => {
    saveEvents(events.filter(e => e.id !== id));
    if (editingEvent?.id === id) setEditingEvent(null);
  };

  // 更新任务完成状态
  const toggleDone = (id: string) => {
    saveEvents(events.map(e => e.id === id ? { ...e, done: !e.done } : e));
  };

  // 更新任务
  const handleUpdateEvent = () => {
    if (!editingEvent || !editingEvent.title.trim()) return;
    saveEvents(events.map(e => e.id === editingEvent.id ? editingEvent : e));
    setEditingEvent(null);
  };

  // 按优先级排序
  const sortedEvents = [...events].sort((a, b) => {
    const pa = priorityOrder[a.priority || 'normal'];
    const pb = priorityOrder[b.priority || 'normal'];
    if (pa !== pb) return pa - pb;
    return a.startTime.localeCompare(b.startTime);
  });

  // 切换日期
  const changeDay = (delta: number) => {
    const d = new Date(navYear, navMonth - 1, navDay);
    d.setDate(d.getDate() + delta);
    setNavYear(d.getFullYear());
    setNavMonth(d.getMonth() + 1);
    setNavDay(d.getDate());
  };

  // 当前时间指示器
  const now = new Date();
  const isToday = navYear === now.getFullYear() && navMonth === now.getMonth() + 1 && navDay === now.getDate();
  const nowPosition = isToday ? timeToPosition(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`) : null;

  // 生成时间标签
  const hourLabels: string[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hourLabels.push(`${h}:00`);
  }

  // 统计
  const totalHours = events.reduce((sum, e) => {
    const [sh, sm] = e.startTime.split(':').map(Number);
    const [eh, em] = e.endTime.split(':').map(Number);
    return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  }, 0);

  const dateStr = `${navYear}-${navMonth.toString().padStart(2, '0')}-${navDay.toString().padStart(2, '0')}`;
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(navYear, navMonth - 1, navDay).getDay()];

  return (
    <div
      ref={ganttRef}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: skin?.panelBg || '#f8fafc' }}
    >
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: skin?.divider || '#e2e8f0' }}>
        {/* 左侧：关闭 + 日期切换 */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/20 transition-colors"
            style={{ color: skin?.textSecondary || '#64748b' }}
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={() => changeDay(-1)}
            className="p-1.5 rounded hover:bg-muted/20 transition-colors"
            style={{ color: skin?.textSecondary || '#64748b' }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-medium" style={{ color: skin?.textPrimary || '#1e293b' }}>
              {navMonth}月{navDay}日
            </span>
            <span className="text-sm" style={{ color: skin?.textSecondary || '#64748b' }}>
              {weekDay}
            </span>
          </div>
          <button
            onClick={() => changeDay(1)}
            className="p-1.5 rounded hover:bg-muted/20 transition-colors"
            style={{ color: skin?.textSecondary || '#64748b' }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 中间：统计 */}
        <div className="flex items-center gap-4 text-sm" style={{ color: skin?.textSecondary || '#64748b' }}>
          <span>{events.length} 项任务</span>
          <span>{totalHours.toFixed(1)} 小时</span>
        </div>

        {/* 右侧：添加按钮 */}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          style={{ backgroundColor: skin?.swatch + '20', color: skin?.swatch }}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">添加任务</span>
        </button>
      </div>

      {/* 甘特图主体 */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* 时间轴头部 */}
          <div className="sticky top-0 z-10 flex border-b"
            style={{ borderColor: skin?.divider || '#e2e8f0', backgroundColor: skin?.panelBg || '#f8fafc' }}>
            {/* 任务名称列 */}
            <div className="w-48 px-3 py-2 font-medium text-sm"
              style={{ color: skin?.textSecondary || '#64748b' }}>
              任务
            </div>
            {/* 时间格子 */}
            <div className="flex" style={{ width: (END_HOUR - START_HOUR + 1) * HOUR_WIDTH }}>
              {hourLabels.map((label, i) => (
                <div
                  key={label}
                  className="flex-shrink-0 px-1 py-2 text-xs text-center border-l"
                  style={{
                    width: HOUR_WIDTH,
                    borderColor: skin?.divider || '#e2e8f0',
                    color: skin?.textMuted || '#94a3b8',
                    backgroundColor: i % 2 === 0 ? 'transparent' : (skin?.cardBg || '#ffffff') + '40',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* 任务行 */}
          {sortedEvents.length === 0 ? (
            <div className="flex items-center justify-center h-32"
              style={{ color: skin?.textMuted || '#94a3b8' }}>
              <div className="text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">暂无任务，点击右上角添加</p>
              </div>
            </div>
          ) : (
            sortedEvents.map((event, rowIndex) => {
              const priority = priorityColors[event.priority || 'normal'];
              const left = timeToPosition(event.startTime);
              const width = timeToWidth(event.startTime, event.endTime);

              return (
                <div
                  key={event.id}
                  className="flex border-b hover:bg-muted/5 transition-colors cursor-pointer"
                  style={{
                    borderColor: skin?.divider || '#e2e8f0',
                    height: ROW_HEIGHT,
                    backgroundColor: event.done ? 'rgba(0,0,0,0.02)' : undefined,
                  }}
                  onClick={() => setEditingEvent(event)}
                >
                  {/* 任务名称 */}
                  <div className="w-48 px-3 flex items-center gap-2 overflow-hidden">
                    {/* 优先级标记 */}
                    {event.priority === 'urgent' && (
                      <AlertTriangle className="w-3.5 h-3.5" style={{ color: skin?.crossColor || '#ef4444' }} />
                    )}
                    {event.priority === 'important' && (
                      <Star className="w-3.5 h-3.5" style={{ color: skin?.swatch || '#3b82f6' }} />
                    )}
                    <span
                      className="truncate text-sm"
                      style={{
                        color: event.done ? (skin?.textMuted || '#94a3b8') : (skin?.textPrimary || '#1e293b'),
                        textDecoration: event.done ? 'line-through' : undefined,
                      }}
                    >
                      {event.title}
                    </span>
                    {/* 完成勾选 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDone(event.id); }}
                      className="ml-auto p-1 rounded hover:bg-muted/20"
                      style={{ color: event.done ? (skin?.checkColor || '#22c55e') : (skin?.textMuted || '#94a3b8') }}
                    >
                      {event.done ? '✓' : '○'}
                    </button>
                  </div>

                  {/* 时间格子区域 */}
                  <div className="flex relative" style={{ width: (END_HOUR - START_HOUR + 1) * HOUR_WIDTH }}>
                    {/* 网格线 */}
                    {hourLabels.map((_, i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 border-l"
                        style={{
                          width: HOUR_WIDTH,
                          borderColor: skin?.divider || '#e2e8f0',
                          opacity: 0.5,
                        }}
                      />
                    ))}

                    {/* 任务时间块 */}
                    <div
                      className={`absolute top-2 bottom-2 rounded-md border-2 ${priority.bg} flex items-center px-2 overflow-hidden`}
                      style={{
                        left,
                        width,
                        borderColor: event.done ? (skin?.divider || '#e2e8f0') : priority.border,
                        opacity: event.done ? 0.5 : 1,
                      }}
                    >
                      <span
                        className="truncate text-xs"
                        style={{ color: event.done ? (skin?.textMuted || '#94a3b8') : (skin?.textPrimary || '#1e293b') }}
                      >
                        {event.startTime}-{event.endTime}
                      </span>
                    </div>

                    {/* 当前时间指示器 */}
                    {isToday && nowPosition !== null && rowIndex === sortedEvents.length - 1 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                        style={{ left: nowPosition }}
                      >
                        <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-red-500" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* 当前时间指示器（全局） */}
          {isToday && nowPosition !== null && sortedEvents.length > 0 && (
            <div
              className="absolute w-0.5 bg-red-500/50 z-10"
              style={{
                left: 192 + nowPosition, // 48px任务列 + 一些padding
                top: 40, // 头部高度
                height: sortedEvents.length * ROW_HEIGHT,
              }}
            />
          )}
        </div>
      </div>

      {/* 添加任务弹框 */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/30">
          <div
            className="rounded-xl p-5 w-80 shadow-xl"
            style={{ backgroundColor: skin?.cardBg || '#ffffff' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: skin?.textPrimary || '#1e293b' }}>
                添加任务
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ color: skin?.textMuted || '#94a3b8' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="任务名称"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{
                  borderColor: skin?.divider || '#e2e8f0',
                  backgroundColor: skin?.panelBg || '#f8fafc',
                  color: skin?.textPrimary || '#1e293b',
                }}
              />

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs mb-1 block" style={{ color: skin?.textMuted || '#94a3b8' }}>
                    开始时间
                  </label>
                  <input
                    type="time"
                    value={addStartTime}
                    onChange={(e) => setAddStartTime(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border text-sm"
                    style={{
                      borderColor: skin?.divider || '#e2e8f0',
                      backgroundColor: skin?.panelBg || '#f8fafc',
                      color: skin?.textPrimary || '#1e293b',
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs mb-1 block" style={{ color: skin?.textMuted || '#94a3b8' }}>
                    结束时间
                  </label>
                  <input
                    type="time"
                    value={addEndTime}
                    onChange={(e) => setAddEndTime(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border text-sm"
                    style={{
                      borderColor: skin?.divider || '#e2e8f0',
                      backgroundColor: skin?.panelBg || '#f8fafc',
                      color: skin?.textPrimary || '#1e293b',
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: skin?.textMuted || '#94a3b8' }}>
                  优先级
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddPriority('urgent')}
                    className={`flex-1 py-1.5 rounded text-xs font-medium ${
                      addPriority === 'urgent' ? 'bg-red-500/20 border-red-500 text-red-500' : 'border'
                    }`}
                    style={{
                      borderColor: addPriority === 'urgent' ? undefined : (skin?.divider || '#e2e8f0'),
                    }}
                  >
                    最紧急
                  </button>
                  <button
                    onClick={() => setAddPriority('important')}
                    className={`flex-1 py-1.5 rounded text-xs font-medium ${
                      addPriority === 'important' ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'border'
                    }`}
                    style={{
                      borderColor: addPriority === 'important' ? undefined : (skin?.divider || '#e2e8f0'),
                    }}
                  >
                    最重要
                  </button>
                  <button
                    onClick={() => setAddPriority('normal')}
                    className={`flex-1 py-1.5 rounded text-xs font-medium ${
                      addPriority === 'normal' ? 'bg-muted/30 border-muted-foreground text-muted-foreground' : 'border'
                    }`}
                    style={{
                      borderColor: addPriority === 'normal' ? undefined : (skin?.divider || '#e2e8f0'),
                    }}
                  >
                    普通
                  </button>
                </div>
              </div>

              <textarea
                placeholder="备注（可选）"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                rows={2}
                style={{
                  borderColor: skin?.divider || '#e2e8f0',
                  backgroundColor: skin?.panelBg || '#f8fafc',
                  color: skin?.textPrimary || '#1e293b',
                }}
              />

              <button
                onClick={handleAddEvent}
                disabled={!addTitle.trim()}
                className="w-full py-2 rounded-lg font-medium text-sm disabled:opacity-50"
                style={{
                  backgroundColor: skin?.swatch || '#3b82f6',
                  color: '#ffffff',
                }}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑任务弹框 */}
      {editingEvent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/30">
          <div
            className="rounded-xl p-5 w-80 shadow-xl"
            style={{ backgroundColor: skin?.cardBg || '#ffffff' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: skin?.textPrimary || '#1e293b' }}>
                编辑任务
              </h3>
              <button onClick={() => setEditingEvent(null)} style={{ color: skin?.textMuted || '#94a3b8' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="任务名称"
                value={editingEvent.title}
                onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{
                  borderColor: skin?.divider || '#e2e8f0',
                  backgroundColor: skin?.panelBg || '#f8fafc',
                  color: skin?.textPrimary || '#1e293b',
                }}
              />

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs mb-1 block" style={{ color: skin?.textMuted || '#94a3b8' }}>
                    开始时间
                  </label>
                  <input
                    type="time"
                    value={editingEvent.startTime}
                    onChange={(e) => setEditingEvent({ ...editingEvent, startTime: e.target.value })}
                    className="w-full px-2 py-1.5 rounded border text-sm"
                    style={{
                      borderColor: skin?.divider || '#e2e8f0',
                      backgroundColor: skin?.panelBg || '#f8fafc',
                      color: skin?.textPrimary || '#1e293b',
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs mb-1 block" style={{ color: skin?.textMuted || '#94a3b8' }}>
                    结束时间
                  </label>
                  <input
                    type="time"
                    value={editingEvent.endTime}
                    onChange={(e) => setEditingEvent({ ...editingEvent, endTime: e.target.value })}
                    className="w-full px-2 py-1.5 rounded border text-sm"
                    style={{
                      borderColor: skin?.divider || '#e2e8f0',
                      backgroundColor: skin?.panelBg || '#f8fafc',
                      color: skin?.textPrimary || '#1e293b',
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: skin?.textMuted || '#94a3b8' }}>
                  优先级
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingEvent({ ...editingEvent, priority: 'urgent' })}
                    className={`flex-1 py-1.5 rounded text-xs font-medium ${
                      editingEvent.priority === 'urgent' ? 'bg-red-500/20 border-red-500 text-red-500' : 'border'
                    }`}
                    style={{
                      borderColor: editingEvent.priority === 'urgent' ? undefined : (skin?.divider || '#e2e8f0'),
                    }}
                  >
                    最紧急
                  </button>
                  <button
                    onClick={() => setEditingEvent({ ...editingEvent, priority: 'important' })}
                    className={`flex-1 py-1.5 rounded text-xs font-medium ${
                      editingEvent.priority === 'important' ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'border'
                    }`}
                    style={{
                      borderColor: editingEvent.priority === 'important' ? undefined : (skin?.divider || '#e2e8f0'),
                    }}
                  >
                    最重要
                  </button>
                  <button
                    onClick={() => setEditingEvent({ ...editingEvent, priority: 'normal' })}
                    className={`flex-1 py-1.5 rounded text-xs font-medium ${
                      editingEvent.priority === 'normal' ? 'bg-muted/30 border-muted-foreground text-muted-foreground' : 'border'
                    }`}
                    style={{
                      borderColor: editingEvent.priority === 'normal' ? undefined : (skin?.divider || '#e2e8f0'),
                    }}
                  >
                    普通
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleUpdateEvent}
                  className="flex-1 py-2 rounded-lg font-medium text-sm"
                  style={{
                    backgroundColor: skin?.swatch || '#3b82f6',
                    color: '#ffffff',
                  }}
                >
                  保存
                </button>
                <button
                  onClick={() => handleDeleteEvent(editingEvent.id)}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: (skin?.crossColor || '#ef4444') + '20',
                    color: skin?.crossColor || '#ef4444',
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}