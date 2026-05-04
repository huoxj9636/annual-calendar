'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface TimelineEvent {
  id: string;
  time: string;
  endTime?: string;
  title: string;
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

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => i);
const EVENT_COLORS = [
  { key: 'work', label: '工作', color: '#3b82f6' },
  { key: 'health', label: '健康', color: '#f59e0b' },
  { key: 'life', label: '生活', color: '#10b981' },
  { key: 'study', label: '学习', color: '#8b5cf6' },
  { key: 'other', label: '其他', color: '#6b7280' },
];

export default function TimelinePanel({ year, month, day, skin, onClose }: TimelinePanelProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [mounted, setMounted] = useState(false);
  const [addingSlot, setAddingSlot] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [navYear, setNavYear] = useState(year);
  const [navMonth, setNavMonth] = useState(month);
  const [navDay, setNavDay] = useState(day);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const storageKey = `dayview-events-${navYear}-${navMonth}-${navDay}`;

  useEffect(() => {
    setNavYear(year);
    setNavMonth(month);
    setNavDay(day);
  }, [year, month, day]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setEvents(parsed);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    }
  }, [storageKey, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(storageKey, JSON.stringify(events));
  }, [events, storageKey, mounted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const pad = (n: number) => String(n).padStart(2, '0');

  const handleAddEvent = useCallback(() => {
    if (!newTitle.trim() || addingSlot === null) return;
    const ev: TimelineEvent = {
      id: `ev-${Date.now()}`,
      time: pad(addingSlot) + ':00',
      endTime: pad(addingSlot + 1) + ':00',
      title: newTitle.trim(),
      color: newColor,
      done: false,
    };
    setEvents(prev => [...prev, ev].sort((a, b) => a.time.localeCompare(b.time)));
    setNewTitle('');
    setAddingSlot(null);
  }, [newTitle, addingSlot, newColor]);

  const handleToggleDone = useCallback((id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, done: !e.done } : e));
  }, []);

  const handleDeleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (selectedEvent?.id === id) setSelectedEvent(null);
  }, [selectedEvent]);

  const navigateDate = useCallback((delta: number) => {
    const d = new Date(navYear, navMonth - 1, navDay + delta);
    setNavYear(d.getFullYear());
    setNavMonth(d.getMonth() + 1);
    setNavDay(d.getDate());
    setAddingSlot(null);
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
        body: JSON.stringify({
          messages: chatMessages,
          selectedEvent: selectedEvent ? `${selectedEvent.time} ${selectedEvent.title}` : userMsg,
        }),
      });

      if (!res.ok || !res.body) throw new Error('AI请求失败');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
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
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `抱歉，AI暂时无法回复。${err instanceof Error ? err.message : ''}`,
      }]);
    } finally {
      setIsStreaming(false);
    }
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

  return (
    <div
      className="absolute top-0 bottom-0 z-40 flex flex-col overflow-hidden"
      style={{ backgroundColor: s.panelBg, left: '51px', right: '-4px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: s.divider }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-80"
            style={{ backgroundColor: s.cardHover }}
          >
            ‹
          </button>
          <span className="font-semibold text-sm" style={{ color: s.textPrimary }}>
            {navYear}年{navMonth}月{navDay}日 周{weekDay}
          </span>
          <button
            onClick={() => navigateDate(1)}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-80"
            style={{ backgroundColor: s.cardHover }}
          >
            ›
          </button>
          <button
            onClick={() => { const d = new Date(); setNavYear(d.getFullYear()); setNavMonth(d.getMonth() + 1); setNavDay(d.getDate()); }}
            className="px-2 py-0.5 rounded text-xs hover:opacity-80"
            style={{ backgroundColor: s.swatch, color: '#fff' }}
          >
            今天
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:opacity-80"
          style={{ backgroundColor: s.cardHover }}
        >
          ✕
        </button>
      </div>

      {/* Main content - split 1/2 */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Timeline */}
        <div className="w-1/2 border-r overflow-y-auto" style={{ borderColor: s.divider }}>
          <div className="relative">
            {TIME_SLOTS.map(hour => {
              const slotEvents = events.filter(e => {
                const eHour = parseInt(e.time.split(':')[0], 10);
                return eHour === hour;
              });

              const now = new Date();
              const isCurrentHour = mounted && navYear === now.getFullYear() && navMonth === now.getMonth() + 1 && navDay === now.getDate() && hour === now.getHours();

              return (
                <div key={hour} className="flex border-b" style={{ borderColor: s.divider, minHeight: 48 }}>
                  {/* Time label */}
                  <div className="w-14 flex-shrink-0 flex items-start justify-end pr-2 pt-1">
                    <span className="text-xs" style={{ color: s.textMuted }}>{pad(hour)}:00</span>
                  </div>
                  {/* Events area */}
                  <div
                    className="flex-1 p-1 cursor-pointer hover:opacity-90 relative"
                    style={{ backgroundColor: isCurrentHour ? `${s.swatch}08` : 'transparent' }}
                    onClick={() => { setAddingSlot(hour); setNewTitle(''); }}
                  >
                    {isCurrentHour && (
                      <div className="absolute left-0 right-0 h-0.5" style={{ backgroundColor: '#ef4444', top: `${((now.getMinutes() / 60) * 100)}%` }}>
                        <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                      </div>
                    )}
                    {slotEvents.map(ev => (
                      <div
                        key={ev.id}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs mb-0.5 group cursor-pointer"
                        style={{ backgroundColor: `${ev.color || s.swatch}18`, borderLeft: `3px solid ${ev.color || s.swatch}` }}
                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleDone(ev.id); }}
                          className="w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center text-[10px]"
                          style={{ borderColor: ev.done ? s.checkColor : s.textMuted, backgroundColor: ev.done ? s.checkColor : 'transparent', color: '#fff' }}
                        >
                          {ev.done ? '✓' : ''}
                        </button>
                        <span className={`flex-1 truncate ${ev.done ? 'line-through' : ''}`} style={{ color: ev.done ? s.textMuted : s.textPrimary }}>
                          {ev.title}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 text-[10px]" style={{ color: s.textMuted }}>
                          {ev.time}{ev.endTime ? `-${ev.endTime}` : ''}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                          className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded hover:bg-red-100 text-red-400 text-[10px]"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {/* Add event inline */}
                    {addingSlot === hour && (
                      <div className="flex items-center gap-1 p-1 rounded" style={{ backgroundColor: s.cardBg }}>
                        <div className="flex gap-0.5">
                          {EVENT_COLORS.map(c => (
                            <button
                              key={c.key}
                              className="w-4 h-4 rounded-full border-2"
                              style={{ backgroundColor: c.color, borderColor: newColor === c.color ? s.textPrimary : 'transparent' }}
                              onClick={() => setNewColor(c.color)}
                            />
                          ))}
                        </div>
                        <input
                          autoFocus
                          value={newTitle}
                          onChange={e => setNewTitle(e.target.value.slice(0, 50))}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddEvent(); if (e.key === 'Escape') setAddingSlot(null); }}
                          placeholder={`${pad(hour)}:00 添加日程...`}
                          className="flex-1 text-xs px-1 py-0.5 border rounded outline-none"
                          style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                        />
                        <button onClick={handleAddEvent} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: s.swatch }}>✓</button>
                        <button onClick={() => setAddingSlot(null)} className="text-xs px-1" style={{ color: s.textMuted }}>✕</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: AI Chat */}
        <div className="w-1/2 flex flex-col" style={{ backgroundColor: s.cardBg }}>
          {/* Chat header */}
          <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: s.divider }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: s.swatch }}>AI</div>
            <span className="text-xs font-medium" style={{ color: s.textPrimary }}>AI日程助手</span>
            {selectedEvent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${selectedEvent.color || s.swatch}18`, color: selectedEvent.color || s.swatch }}>
                {selectedEvent.title}
              </span>
            )}
            {selectedEvent && (
              <button onClick={() => setSelectedEvent(null)} className="text-[10px]" style={{ color: s.textMuted }}>取消选择</button>
            )}
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">🧠</div>
                <p className="text-xs" style={{ color: s.textMuted }}>选择左侧日程，或输入问题</p>
                <p className="text-xs" style={{ color: s.textMuted }}>AI帮你拆分任务、分析日程</p>
                <div className="mt-4 space-y-1.5">
                  {['帮我拆分当前日程', '这个日程如何优化？', '帮我规划明天'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setChatInput(q); }}
                      className="block mx-auto text-xs px-3 py-1 rounded-full border hover:opacity-80"
                      style={{ borderColor: s.divider, color: s.textSecondary }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] text-xs px-3 py-2 rounded-lg whitespace-pre-wrap"
                  style={{
                    backgroundColor: msg.role === 'user' ? s.swatch : s.cardHover,
                    color: msg.role === 'user' ? '#fff' : s.textPrimary,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isStreaming && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: s.cardHover, color: s.textMuted }}>
                  思考中...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="px-3 py-2 border-t" style={{ borderColor: s.divider }}>
            <div className="flex items-center gap-1">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder={selectedEvent ? `分析: ${selectedEvent.title}` : '输入问题...'}
                className="flex-1 text-xs px-2 py-1.5 border rounded-lg outline-none"
                style={{ borderColor: s.divider, color: s.textPrimary, backgroundColor: s.panelBg }}
                disabled={isStreaming}
              />
              <button
                onClick={handleSendChat}
                disabled={isStreaming || (!chatInput.trim() && !selectedEvent)}
                className="px-2.5 py-1.5 rounded-lg text-white text-xs disabled:opacity-40"
                style={{ backgroundColor: s.swatch }}
              >
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
