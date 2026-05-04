'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface TimelineEvent {
  id: string;
  time: string;
  endTime?: string;
  title: string;
  description?: string;
  color?: string;
  done?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TimelinePanelProps {
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

const EVENT_COLORS = [
  { key: 'work', label: '工作', color: '#3b82f6' },
  { key: 'health', label: '健康', color: '#f59e0b' },
  { key: 'life', label: '生活', color: '#10b981' },
  { key: 'study', label: '学习', color: '#8b5cf6' },
  { key: 'other', label: '其他', color: '#6b7280' },
];

const HOUR_HEIGHT = 80;
const START_HOUR = 0;
const END_HOUR = 24;
const TIME_LABEL_WIDTH = 52;

export default function TimelinePanel({ year, month, day, skin, onClose }: Omit<TimelinePanelProps, 'initialLeft'>) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [mounted, setMounted] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [navYear, setNavYear] = useState(year);
  const [navMonth, setNavMonth] = useState(month);
  const [navDay, setNavDay] = useState(day);
  const [panelLeft, setPanelLeft] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('panel-left-timeline');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });

  // 添加弹框状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalTop, setAddModalTop] = useState(0);
  const [addStartTime, setAddStartTime] = useState('09:00');
  const [addEndTime, setAddEndTime] = useState('09:15');
  const [addTitle, setAddTitle] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addColor, setAddColor] = useState('#3b82f6');

  // 鼠标时间指示器
  const [mouseTime, setMouseTime] = useState<string | null>(null);
  const [mouseY, setMouseY] = useState<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // 编辑弹框
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalTop, setEditModalTop] = useState(0);
  const [editEvent, setEditEvent] = useState<TimelineEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('');

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; event: TimelineEvent } | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const storageKey = `dayview-events-${navYear}-${navMonth}-${navDay}`;

  useEffect(() => { setNavYear(year); setNavMonth(month); setNavDay(day); }, [year, month, day]);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) setEvents(parsed); }
      else setEvents([]);
    } catch { setEvents([]); }
  }, [storageKey, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(storageKey, JSON.stringify(events));
  }, [events, storageKey, mounted]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // 关闭右键菜单
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const minutesToTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

  // 时间轴点击 → 弹框
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    // 忽略来自事件块的点击
    const target = e.target as HTMLElement;
    if (target.closest('[data-event-block]')) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = Math.floor((y / HOUR_HEIGHT) * 60);
    const startMin = Math.max(0, Math.min(totalMinutes, 23 * 60 + 30));
    const endMin = Math.min(startMin + 15, 24 * 60);
    setAddStartTime(minutesToTime(startMin));
    setAddEndTime(minutesToTime(endMin));
    setAddTitle('');
    setAddDescription('');
    setAddColor('#3b82f6');
    // 计算弹框位置：确保不超出可视区域
    const scrollContainer = timelineScrollRef.current;
    const maxTop = scrollContainer ? scrollContainer.scrollTop + scrollContainer.clientHeight - 320 : 800;
    const minTop = scrollContainer ? scrollContainer.scrollTop + 20 : 20;
    setAddModalTop(Math.max(minTop, Math.min(y - 40, maxTop)));
    setShowAddModal(true);
    setShowEditModal(false);
  }, []);

  // 鼠标移动 → 时间指示器
  const handleTimelineMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = Math.floor((y / HOUR_HEIGHT) * 60);
    const clamped = Math.max(0, Math.min(totalMinutes, 24 * 60 - 1));
    setMouseTime(minutesToTime(clamped));
    setMouseY(y);
  }, []);

  const handleTimelineMouseLeave = useCallback(() => { setMouseTime(null); }, []);

  // 添加事件
  const handleAddEvent = useCallback(() => {
    if (!addTitle.trim()) return;
    const ev: TimelineEvent = {
      id: `ev-${Date.now()}`,
      time: addStartTime,
      endTime: addEndTime,
      title: addTitle.trim(),
      description: addDescription.trim(),
      color: addColor,
      done: false,
    };
    setEvents(prev => [...prev, ev].sort((a, b) => a.time.localeCompare(b.time)));
    setShowAddModal(false);
  }, [addTitle, addStartTime, addEndTime, addDescription, addColor]);

  // 切换完成
  const handleToggleDone = useCallback((id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, done: !e.done } : e));
  }, []);

  // 删除事件
  const handleDeleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (selectedEvent?.id === id) setSelectedEvent(null);
    setShowEditModal(false);
  }, [selectedEvent]);

  // 编辑事件
  const handleEditEvent = useCallback(() => {
    if (!editEvent || !editTitle.trim()) return;
    setEvents(prev => prev.map(e => e.id === editEvent.id ? {
      ...e, title: editTitle.trim(), time: editStartTime, endTime: editEndTime, description: editDescription.trim(), color: editColor,
    } : e));
    setShowEditModal(false);
    setEditEvent(null);
  }, [editEvent, editTitle, editStartTime, editEndTime, editDescription, editColor]);

  // 点击事件 → 编辑弹框
  const handleEventClick = useCallback((ev: TimelineEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(ev);
    setEditEvent(ev);
    setEditTitle(ev.title);
    setEditStartTime(ev.time);
    setEditEndTime(ev.endTime || minutesToTime(timeToMinutes(ev.time) + 15));
    setEditDescription(ev.description || '');
    setEditColor(ev.color || '#3b82f6');
    const topMin = timeToMinutes(ev.time);
    const yPos = (topMin / 60) * HOUR_HEIGHT;
    const scrollContainer = timelineScrollRef.current;
    const maxTop = scrollContainer ? scrollContainer.scrollTop + scrollContainer.clientHeight - 320 : 800;
    const minTop = scrollContainer ? scrollContainer.scrollTop + 20 : 20;
    setEditModalTop(Math.max(minTop, Math.min(yPos - 20, maxTop)));
    setShowEditModal(true);
    setShowAddModal(false);
  }, []);

  // 右键事件 → 拆解任务
  const handleEventContextMenu = useCallback((ev: TimelineEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, event: ev });
  }, []);

  // 拆解任务 - AI
  const handleBreakdownTask = useCallback(async (ev: TimelineEvent) => {
    setContextMenu(null);
    setSelectedEvent(ev);
    const userMsg = `拆解任务：${ev.time}${ev.endTime ? `-${ev.endTime}` : ''} ${ev.title}${ev.description ? `\n描述：${ev.description}` : ''}`;
    setChatMessages(prev => [...prev, { role: 'user', content: `拆解: ${ev.title}` }]);
    setChatInput('');
    setIsStreaming(true);
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], selectedEvent: userMsg }),
      });
      if (!res.ok || !res.body) throw new Error('AI请求失败');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                setChatMessages(prev => {
                  const updated = [...prev];
                  if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                    updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  } else {
                    updated.push({ role: 'assistant', content: assistantContent });
                  }
                  return updated;
                });
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `抱歉，AI暂时无法回复。${err instanceof Error ? err.message : ''}` }]);
    } finally { setIsStreaming(false); }
  }, []);

  // 定位到当前时间
  const scrollToNow = useCallback(() => {
    if (!timelineScrollRef.current) return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const y = (nowMin / 60) * HOUR_HEIGHT;
    timelineScrollRef.current.scrollTo({ top: Math.max(0, y - 120), behavior: 'smooth' });
  }, []);

  // 导航日期
  const navigateDate = useCallback((delta: number) => {
    const d = new Date(navYear, navMonth - 1, navDay + delta);
    setNavYear(d.getFullYear());
    setNavMonth(d.getMonth() + 1);
    setNavDay(d.getDate());
    setSelectedEvent(null);
  }, [navYear, navMonth, navDay]);

  // AI Chat
  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() && !selectedEvent) return;
    const userMsg = chatInput.trim() || `分析这个日程：${selectedEvent?.title}`;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsStreaming(true);
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatMessages, selectedEvent: selectedEvent ? `${selectedEvent.time} ${selectedEvent.title}` : userMsg }),
      });
      if (!res.ok || !res.body) throw new Error('AI请求失败');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                setChatMessages(prev => {
                  const updated = [...prev];
                  if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                    updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  } else {
                    updated.push({ role: 'assistant', content: assistantContent });
                  }
                  return updated;
                });
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `抱歉，AI暂时无法回复。${err instanceof Error ? err.message : ''}` }]);
    } finally { setIsStreaming(false); }
  }, [chatInput, chatMessages, selectedEvent]);

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dateObj = new Date(navYear, navMonth - 1, navDay);
  const weekDay = weekDays[dateObj.getDay()];

  const s = skin || {
    panelBg: '#f8fafc', cardBg: '#ffffff', cardHover: '#f1f5f9',
    textPrimary: '#1e293b', textSecondary: '#475569', textMuted: '#94a3b8',
    divider: '#e2e8f0', swatch: '#3b82f6', checkColor: '#22c55e',
    crossColor: '#ef4444', tabActive: '#3b82f6', sidebarFrom: '#3b82f6', sidebarTo: '#1d4ed8',
  };

  const now = new Date();
  const isToday = mounted && navYear === now.getFullYear() && navMonth === now.getMonth() + 1 && navDay === now.getDate();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowY = (nowMinutes / 60) * HOUR_HEIGHT;

  // 计算事件重叠分组
  const getOverlappingGroups = () => {
    const sorted = [...events].sort((a, b) => {
      const aStart = timeToMinutes(a.time);
      const bStart = timeToMinutes(b.time);
      return aStart - bStart || timeToMinutes(a.endTime || a.time) - timeToMinutes(b.endTime || b.time);
    });
    const groups: TimelineEvent[][] = [];
    for (const ev of sorted) {
      const evStart = timeToMinutes(ev.time);
      const evEnd = timeToMinutes(ev.endTime || minutesToTime(evStart + 60));
      let placed = false;
      for (const group of groups) {
        const lastInGroup = group[group.length - 1];
        const lastEnd = timeToMinutes(lastInGroup.endTime || minutesToTime(timeToMinutes(lastInGroup.time) + 60));
        if (evStart < lastEnd) {
          group.push(ev);
          placed = true;
          break;
        }
      }
      if (!placed) groups.push([ev]);
    }
    return groups;
  };

  // 计算事件在时间轴上的位置和宽度
  const getEventLayout = (ev: TimelineEvent, group: TimelineEvent[], indexInGroup: number) => {
    const startMin = timeToMinutes(ev.time);
    const endMin = ev.endTime ? timeToMinutes(ev.endTime) : startMin + 60;
    const top = (startMin / 60) * HOUR_HEIGHT;
    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20);
    const groupSize = group.length;
    if (groupSize <= 1) {
      return { top, height, left: TIME_LABEL_WIDTH + 4, width: undefined, right: 4 };
    }
    const totalWidth = `calc((100% - ${TIME_LABEL_WIDTH + 8}px) / ${groupSize})`;
    const leftOffset = `calc(${TIME_LABEL_WIDTH + 4}px + (100% - ${TIME_LABEL_WIDTH + 8}px) / ${groupSize} * ${indexInGroup})`;
    return { top, height, left: leftOffset as unknown as number, width: totalWidth as unknown as number, right: undefined };
  };

  // 判断事件属于哪个组和组内索引
  const eventLayoutMap = (() => {
    const groups = getOverlappingGroups();
    const map = new Map<string, { group: TimelineEvent[]; index: number }>();
    for (const group of groups) {
      for (let i = 0; i < group.length; i++) {
        map.set(group[i].id, { group, index: i });
      }
    }
    return map;
  })();

  return (
    <div
      className="absolute top-0 bottom-0 z-40 flex flex-col overflow-hidden"
      style={{ backgroundColor: s.panelBg, left: `${panelLeft}px`, right: '-6px' }}
    >
      {/* 左侧拖拽手柄 */}
      <div
        className="absolute top-0 bottom-0 left-0 w-2 cursor-col-resize z-50 hover:bg-black/10 transition-colors group"
        onMouseDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          const startX = e.clientX; const startLeft = panelLeft; let finalLeft = startLeft;
          document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize';
          const onMove = (ev: MouseEvent) => { ev.preventDefault(); const newLeft = Math.max(0, Math.min(startLeft + (ev.clientX - startX), 500)); finalLeft = newLeft; setPanelLeft(newLeft); };
          const onUp = () => { document.body.style.userSelect = ''; document.body.style.cursor = ''; localStorage.setItem('panel-left-timeline', String(finalLeft)); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
          document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-10 rounded-full bg-black/15 group-hover:bg-black/40 transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: s.divider }}>
        <div className="flex items-center gap-2">
          <button onClick={() => navigateDate(-1)} className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-80" style={{ backgroundColor: s.cardHover }}>‹</button>
          <span className="font-semibold text-sm" style={{ color: s.textPrimary }}>
            {navYear}年{navMonth}月{navDay}日 周{weekDay}
          </span>
          <button onClick={() => navigateDate(1)} className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-80" style={{ backgroundColor: s.cardHover }}>›</button>
          <button
            onClick={() => { const d = new Date(); setNavYear(d.getFullYear()); setNavMonth(d.getMonth() + 1); setNavDay(d.getDate()); }}
            className="px-2 py-0.5 rounded text-xs hover:opacity-80" style={{ backgroundColor: s.swatch, color: '#fff' }}
          >今天</button>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:opacity-80" style={{ backgroundColor: s.cardHover }}>✕</button>
      </div>

      {/* Main content - split 1/2 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Timeline */}
        <div className="w-1/2 border-r overflow-y-auto relative" style={{ borderColor: s.divider }} ref={timelineScrollRef}>
          <div
            ref={timelineRef}
            className="relative cursor-crosshair"
            style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}
            onClick={handleTimelineClick}
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
          >
            {/* 小时网格线 + 标签 */}
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR).map(hour => {
              const y = (hour - START_HOUR) * HOUR_HEIGHT;
              return (
                <div key={hour}>
                  {/* 小时线 */}
                  <div className="absolute left-0 right-0" style={{ top: y, height: 1, backgroundColor: s.divider }} />
                  {/* 半小时虚线 */}
                  {hour < END_HOUR && (
                    <div className="absolute left-0 right-0" style={{ top: y + HOUR_HEIGHT / 2, height: 1, backgroundColor: s.divider, opacity: 0.4, borderStyle: 'dashed' }} />
                  )}
                  {/* 小时标签 */}
                  {hour < END_HOUR && (
                    <div className="absolute flex items-start justify-end pr-2" style={{ top: y, left: 0, width: TIME_LABEL_WIDTH, height: 20 }}>
                      <span className="text-[11px] font-medium" style={{ color: s.textMuted }}>{pad(hour)}:00</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 当前时间线 */}
            {isToday && nowMinutes < 24 * 60 && (
              <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowY }}>
                <div className="absolute left-0 right-0 h-[2px]" style={{ backgroundColor: '#ef4444' }} />
                <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                <span className="absolute left-2 -top-4 text-[10px] font-medium px-1 rounded" style={{ color: '#ef4444', backgroundColor: '#fef2f2' }}>
                  {pad(now.getHours())}:{pad(now.getMinutes())}
                </span>
              </div>
            )}

            {/* 鼠标时间指示器 */}
            {mouseTime && (
              <div className="absolute left-0 right-0 z-15 pointer-events-none" style={{ top: mouseY }}>
                <div className="absolute left-0 right-0 h-px border-t border-dashed" style={{ borderColor: s.swatch, opacity: 0.5 }} />
                <span className="absolute text-[10px] font-medium px-1 rounded pointer-events-none" style={{ color: s.swatch, backgroundColor: s.panelBg, left: TIME_LABEL_WIDTH + 4, top: -14 }}>
                  {mouseTime}
                </span>
              </div>
            )}

            {/* 事件块 - 支持重叠并列 */}
            {events.map(ev => {
              const layoutInfo = eventLayoutMap.get(ev.id);
              if (!layoutInfo) return null;
              const { top, height, left, width, right } = getEventLayout(ev, layoutInfo.group, layoutInfo.index);
              const isSingle = layoutInfo.group.length <= 1;
              return (
                <div
                  key={ev.id}
                  data-event-block
                  className="absolute rounded-md px-2 py-1 cursor-pointer hover:brightness-95 transition-all z-10 overflow-hidden"
                  style={{
                    top, height,
                    left: isSingle ? (TIME_LABEL_WIDTH + 4) : left,
                    right: isSingle ? 4 : undefined,
                    width: isSingle ? undefined : width,
                    backgroundColor: `${ev.color || s.swatch}22`,
                    borderLeft: `3px solid ${ev.color || s.swatch}`,
                    border: `1px solid ${ev.color || s.swatch}44`,
                    borderLeftWidth: 3,
                  }}
                  onClick={(e) => handleEventClick(ev, e)}
                  onContextMenu={(e) => handleEventContextMenu(ev, e)}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleDone(ev.id); }}
                      className="w-3.5 h-3.5 flex-shrink-0 rounded-sm border flex items-center justify-center text-[8px]"
                      style={{ borderColor: ev.done ? s.checkColor : s.textMuted, backgroundColor: ev.done ? s.checkColor : 'transparent', color: '#fff' }}
                    >
                      {ev.done ? '✓' : ''}
                    </button>
                    <span className={`text-[11px] truncate font-medium ${ev.done ? 'line-through' : ''}`} style={{ color: ev.done ? s.textMuted : s.textPrimary }}>
                      {ev.title}
                    </span>
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: s.textMuted }}>
                    {ev.time}{ev.endTime ? ` - ${ev.endTime}` : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 定位到当前时间按钮 */}
          {isToday && (
            <button
              onClick={scrollToNow}
              className="absolute bottom-3 right-3 z-30 w-9 h-9 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
              style={{ backgroundColor: s.swatch, color: '#fff', boxShadow: `0 2px 8px ${s.swatch}40` }}
              title="定位到当前时间"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <line x1="8" y1="4.5" x2="8" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="8" y1="8" x2="10.5" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Right: AI Chat */}
        <div className="w-1/2 flex flex-col" style={{ backgroundColor: s.cardBg }}>
          <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: s.divider }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: s.swatch }}>AI</div>
            <span className="text-xs font-medium" style={{ color: s.textPrimary }}>AI日程助手</span>
            {selectedEvent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${selectedEvent.color || s.swatch}18`, color: selectedEvent.color || s.swatch }}>
                {selectedEvent.title}
              </span>
            )}
            {selectedEvent && (
              <button onClick={() => setSelectedEvent(null)} className="text-[10px]" style={{ color: s.textMuted }}>取消</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">🧠</div>
                <p className="text-xs" style={{ color: s.textMuted }}>点击左侧时间轴添加日程</p>
                <p className="text-xs" style={{ color: s.textMuted }}>右键日程可AI拆解任务</p>
                <div className="mt-4 space-y-1.5">
                  {['帮我拆分当前日程', '这个日程如何优化？', '帮我规划明天'].map(q => (
                    <button key={q} onClick={() => setChatInput(q)} className="block mx-auto text-xs px-3 py-1 rounded-full border hover:opacity-80" style={{ borderColor: s.divider, color: s.textSecondary }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] text-sm px-3 py-2 rounded-lg whitespace-pre-wrap" style={{ backgroundColor: msg.role === 'user' ? s.swatch : s.cardHover, color: msg.role === 'user' ? '#fff' : s.textPrimary }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isStreaming && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: s.cardHover, color: s.textMuted }}>思考中...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="px-3 py-2 border-t" style={{ borderColor: s.divider }}>
            <div className="flex items-center gap-1">
              <input
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder={selectedEvent ? `分析: ${selectedEvent.title}` : '输入问题...'}
                className="flex-1 text-xs px-2 py-1.5 border rounded-lg outline-none"
                style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                disabled={isStreaming}
              />
              <button onClick={handleSendChat} disabled={isStreaming || (!chatInput.trim() && !selectedEvent)} className="px-2.5 py-1.5 rounded-lg text-white text-xs disabled:opacity-40" style={{ backgroundColor: s.swatch }}>
                发送
              </button>
            </div>
          </div>
        </div>

        {/* 添加日程弹框 - 简约风格 */}
        {showAddModal && (
          <div
            className="absolute z-50"
            style={{ top: addModalTop, left: TIME_LABEL_WIDTH + 20 }}
          >
            <div
              className="w-[280px] rounded-xl shadow-2xl overflow-hidden"
              style={{
                backgroundColor: s.cardBg,
                border: `1px solid ${s.divider}`,
                boxShadow: `0 12px 32px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)`,
              }}
            >
              {/* 顶部彩色条 */}
              <div className="h-1 w-full" style={{ backgroundColor: addColor }} />

              <div className="px-4 pt-3 pb-2">
                {/* 添加日程标题 */}
                <div className="text-xs font-semibold mb-2.5" style={{ color: s.textMuted }}>添加日程</div>

                {/* 标题输入 - 简约下划线 */}
                <input
                  autoFocus
                  value={addTitle}
                  onChange={e => setAddTitle(e.target.value.slice(0, 50))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddEvent(); if (e.key === 'Escape') setShowAddModal(false); }}
                  placeholder="日程标题"
                  className="w-full text-sm font-medium outline-none bg-transparent border-b pb-1.5 mb-3 placeholder:opacity-35"
                  style={{ color: s.textPrimary, borderColor: s.divider }}
                />

                {/* 时间选择 */}
                <div className="flex items-center gap-2 mb-3">
                  <select
                    value={addStartTime.split(':')[0]}
                    onChange={e => {
                      const mins = timeToMinutes(addStartTime);
                      const newMins = Math.max(0, Math.min(Number(e.target.value) * 60 + (mins % 60), 24 * 60 - 15));
                      const newStart = minutesToTime(newMins);
                      setAddStartTime(newStart);
                      setAddEndTime(minutesToTime(Math.min(newMins + 15, 24 * 60)));
                    }}
                    className="text-sm px-2 py-1 rounded-md border outline-none"
                    style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                  >
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad(i)}</option>)}
                  </select>
                  <span className="text-sm" style={{ color: s.textMuted }}>:</span>
                  <select
                    value={Number(addStartTime.split(':')[1])}
                    onChange={e => {
                      const h = Number(addStartTime.split(':')[0]);
                      const newMins = h * 60 + Number(e.target.value);
                      setAddStartTime(minutesToTime(newMins));
                      setAddEndTime(minutesToTime(Math.min(newMins + 15, 24 * 60)));
                    }}
                    className="text-sm px-2 py-1 rounded-md border outline-none"
                    style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                  >
                    {[0, 15, 30, 45].map(i => <option key={i} value={i}>{pad(i)}</option>)}
                  </select>
                  <span className="text-xs mx-0.5" style={{ color: s.textMuted }}>至</span>
                  <select
                    value={addEndTime.split(':')[0]}
                    onChange={e => {
                      const mins = timeToMinutes(addEndTime);
                      setAddEndTime(minutesToTime(Math.max(Number(e.target.value) * 60 + (mins % 60), timeToMinutes(addStartTime) + 15)));
                    }}
                    className="text-sm px-2 py-1 rounded-md border outline-none"
                    style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                  >
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad(i)}</option>)}
                  </select>
                  <span className="text-sm" style={{ color: s.textMuted }}>:</span>
                  <select
                    value={Number(addEndTime.split(':')[1])}
                    onChange={e => {
                      const h = Number(addEndTime.split(':')[0]);
                      setAddEndTime(minutesToTime(Math.max(h * 60 + Number(e.target.value), timeToMinutes(addStartTime) + 15)));
                    }}
                    className="text-sm px-2 py-1 rounded-md border outline-none"
                    style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                  >
                    {[0, 15, 30, 45].map(i => <option key={i} value={i}>{pad(i)}</option>)}
                  </select>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ color: '#fff', backgroundColor: s.swatch }}>
                    {(() => { const d = timeToMinutes(addEndTime) - timeToMinutes(addStartTime); return d > 0 ? `${d}min` : '15min'; })()}
                  </span>
                </div>

                {/* 详细描述 */}
                <textarea
                  value={addDescription}
                  onChange={e => setAddDescription(e.target.value.slice(0, 200))}
                  placeholder="添加详细描述..."
                  rows={3}
                  className="w-full text-xs outline-none bg-transparent border rounded-md px-2.5 py-2 mb-3 resize-none placeholder:opacity-35"
                  style={{ color: s.textSecondary, borderColor: s.divider, backgroundColor: s.panelBg }}
                />

                {/* 颜色选择 */}
                <div className="flex items-center gap-2 mb-1">
                  {EVENT_COLORS.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setAddColor(c.color)}
                      className="rounded-full transition-all"
                      style={{
                        width: 18, height: 18,
                        backgroundColor: c.color,
                        boxShadow: addColor === c.color ? `0 0 0 2px ${s.cardBg}, 0 0 0 3.5px ${c.color}` : 'none',
                        transform: addColor === c.color ? 'scale(1.15)' : 'scale(1)',
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="flex items-center justify-end gap-2 px-4 py-2.5" style={{ borderTop: `1px solid ${s.divider}` }}>
                <button onClick={() => setShowAddModal(false)} className="text-[11px] px-3 py-1.5 rounded-lg" style={{ color: s.textMuted }}>
                  取消
                </button>
                <button onClick={handleAddEvent} disabled={!addTitle.trim()} className="text-[11px] px-5 py-1.5 rounded-lg text-white disabled:opacity-40 font-medium" style={{ backgroundColor: s.swatch }}>
                  添加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 编辑日程弹框 - 简约风格 */}
        {showEditModal && editEvent && (
          <div
            className="absolute z-50"
            style={{ top: editModalTop, left: TIME_LABEL_WIDTH + 20 }}
          >
            <div
              className="w-[280px] rounded-xl shadow-2xl overflow-hidden"
              style={{
                backgroundColor: s.cardBg,
                border: `1px solid ${s.divider}`,
                boxShadow: `0 12px 32px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)`,
              }}
            >
              {/* 顶部彩色条 */}
              <div className="h-1 w-full" style={{ backgroundColor: editColor }} />

              <div className="px-4 pt-3 pb-2">
                {/* 编辑日程标题 */}
                <div className="text-xs font-semibold mb-2.5" style={{ color: s.textMuted }}>编辑日程</div>

                {/* 标题输入 */}
                <input
                  autoFocus
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value.slice(0, 50))}
                  onKeyDown={e => { if (e.key === 'Enter') handleEditEvent(); if (e.key === 'Escape') { setShowEditModal(false); setEditEvent(null); } }}
                  placeholder="日程标题"
                  className="w-full text-sm font-medium outline-none bg-transparent border-b pb-1.5 mb-3 placeholder:opacity-35"
                  style={{ color: s.textPrimary, borderColor: s.divider }}
                />

                {/* 时间选择 */}
                <div className="flex items-center gap-2 mb-3">
                  <select
                    value={editStartTime.split(':')[0]}
                    onChange={e => {
                      const mins = timeToMinutes(editStartTime);
                      const newMins = Number(e.target.value) * 60 + (mins % 60);
                      setEditStartTime(minutesToTime(newMins));
                    }}
                    className="text-sm px-2 py-1 rounded-md border outline-none"
                    style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                  >
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad(i)}</option>)}
                  </select>
                  <span className="text-sm" style={{ color: s.textMuted }}>:</span>
                  <select
                    value={Number(editStartTime.split(':')[1])}
                    onChange={e => {
                      const h = Number(editStartTime.split(':')[0]);
                      setEditStartTime(minutesToTime(h * 60 + Number(e.target.value)));
                    }}
                    className="text-sm px-2 py-1 rounded-md border outline-none"
                    style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                  >
                    {[0, 15, 30, 45].map(i => <option key={i} value={i}>{pad(i)}</option>)}
                  </select>
                  <span className="text-xs mx-0.5" style={{ color: s.textMuted }}>至</span>
                  <select
                    value={editEndTime.split(':')[0]}
                    onChange={e => {
                      const mins = timeToMinutes(editEndTime);
                      setEditEndTime(minutesToTime(Number(e.target.value) * 60 + (mins % 60)));
                    }}
                    className="text-sm px-2 py-1 rounded-md border outline-none"
                    style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                  >
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad(i)}</option>)}
                  </select>
                  <span className="text-sm" style={{ color: s.textMuted }}>:</span>
                  <select
                    value={Number(editEndTime.split(':')[1])}
                    onChange={e => {
                      const h = Number(editEndTime.split(':')[0]);
                      setEditEndTime(minutesToTime(h * 60 + Number(e.target.value)));
                    }}
                    className="text-sm px-2 py-1 rounded-md border outline-none"
                    style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                  >
                    {[0, 15, 30, 45].map(i => <option key={i} value={i}>{pad(i)}</option>)}
                  </select>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ color: '#fff', backgroundColor: s.swatch }}>
                    {(() => { const d = timeToMinutes(editEndTime) - timeToMinutes(editStartTime); return d > 0 ? `${d}min` : '—'; })()}
                  </span>
                </div>

                {/* 详细描述 */}
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value.slice(0, 200))}
                  placeholder="添加详细描述..."
                  rows={3}
                  className="w-full text-xs outline-none bg-transparent border rounded-md px-2.5 py-2 mb-3 resize-none placeholder:opacity-35"
                  style={{ color: s.textSecondary, borderColor: s.divider, backgroundColor: s.panelBg }}
                />

                {/* 颜色选择 */}
                <div className="flex items-center gap-2 mb-1">
                  {EVENT_COLORS.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setEditColor(c.color)}
                      className="rounded-full transition-all"
                      style={{
                        width: 18, height: 18,
                        backgroundColor: c.color,
                        boxShadow: editColor === c.color ? `0 0 0 2px ${s.cardBg}, 0 0 0 3.5px ${c.color}` : 'none',
                        transform: editColor === c.color ? 'scale(1.15)' : 'scale(1)',
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: `1px solid ${s.divider}` }}>
                <button onClick={() => handleDeleteEvent(editEvent.id)} className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1" style={{ color: '#ef4444', backgroundColor: '#fef2f2' }}>
                  删除
                </button>
                <div className="flex gap-2">
                  <button onClick={() => { setShowEditModal(false); setEditEvent(null); }} className="text-[11px] px-3 py-1.5 rounded-lg" style={{ color: s.textMuted }}>
                    取消
                  </button>
                  <button onClick={handleEditEvent} disabled={!editTitle.trim()} className="text-[11px] px-5 py-1.5 rounded-lg text-white disabled:opacity-40 font-medium" style={{ backgroundColor: s.swatch }}>
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 右键菜单 */}
        {contextMenu && (
          <div
            className="fixed z-[100] rounded-lg shadow-xl overflow-hidden py-1"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              backgroundColor: s.cardBg,
              border: `1px solid ${s.divider}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              minWidth: 140,
            }}
          >
            <button
              onClick={() => handleBreakdownTask(contextMenu.event)}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:opacity-80 transition-colors"
              style={{ color: s.textPrimary, backgroundColor: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = s.cardHover)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke={s.swatch} strokeWidth="1.5" strokeLinecap="round" />
                <rect x="3" y="3" width="3" height="3" rx="0.5" fill={`${s.swatch}40`} stroke={s.swatch} strokeWidth="0.75" />
                <rect x="8" y="3" width="3" height="3" rx="0.5" fill={`${s.swatch}40`} stroke={s.swatch} strokeWidth="0.75" />
                <rect x="3" y="8" width="3" height="3" rx="0.5" fill={`${s.swatch}40`} stroke={s.swatch} strokeWidth="0.75" />
              </svg>
              拆解任务
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
