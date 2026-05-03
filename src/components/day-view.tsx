'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getLunarInfo } from '@/lib/lunar';
import { NO_SKIN } from '@/lib/skins';
import type { SkinTheme } from '@/lib/skins';

interface DayViewProps {
  year: number;
  month: number;
  day: number;
  onClose: () => void;
  embedded?: boolean;
  skin?: SkinTheme;
}

interface TimeEvent {
  id: string;
  time: string;
  endTime: string;
  title: string;
  desc: string;
  color: string;
  done: boolean;
}

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  color: string;
}

const COLORS = ['#6366f1', '#f45b69', '#15c7a0', '#f5a623', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c'];

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

function createRecognition(): SpeechRecognitionLike | null {
  const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new (SpeechRecognition as new () => SpeechRecognitionLike)();
  return recognition;
}

interface EventLayout {
  columnIndex: number;
  totalColumns: number;
}

function computeEventLayout(events: TimeEvent[]): Map<string, EventLayout> {
  const layout = new Map<string, EventLayout>();
  if (events.length === 0) return layout;

  const sorted = [...events].sort((a, b) => {
    const startDiff = a.time.localeCompare(b.time);
    if (startDiff !== 0) return startDiff;
    return b.endTime.localeCompare(a.endTime);
  });

  const groups: TimeEvent[][] = [];
  let currentGroup: TimeEvent[] = [sorted[0]];
  let groupEnd = sorted[0].endTime;

  for (let i = 1; i < sorted.length; i++) {
    const evt = sorted[i];
    if (evt.time < groupEnd) {
      currentGroup.push(evt);
      if (evt.endTime > groupEnd) groupEnd = evt.endTime;
    } else {
      groups.push(currentGroup);
      currentGroup = [evt];
      groupEnd = evt.endTime;
    }
  }
  groups.push(currentGroup);

  for (const group of groups) {
    const columns: string[][] = [];
    for (const evt of group) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1];
        const lastEvt = group.find(e => e.id === lastInCol);
        if (lastEvt && lastEvt.endTime <= evt.time) {
          columns[c].push(evt.id);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([evt.id]);
      }
    }
    const totalColumns = columns.length;
    for (let c = 0; c < columns.length; c++) {
      for (const id of columns[c]) {
        layout.set(id, { columnIndex: c, totalColumns });
      }
    }
  }

  return layout;
}

type TabType = 'schedule' | 'memo';

export default function DayView({ year, month, day, onClose, embedded, skin: skinProp }: DayViewProps) {
  const skin = skinProp ?? NO_SKIN;
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<TimeEvent[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [noteText, setNoteText] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ time: '09:00', endTime: '10:00', title: '', desc: '' });
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [newTodoText, setNewTodoText] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoText, setEditingTodoText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceTextRef = useRef('');
  const addTodoInputRef = useRef<HTMLInputElement>(null);

  const storageKey = `dayview-events-${year}-${month}-${day}`;
  const todoKey = `dayview-todos-${year}-${month}-${day}`;
  const noteKey = `${year}-${month}-${day}`;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setEvents(JSON.parse(stored));
    } catch { /* empty */ }
    try {
      const storedTodos = localStorage.getItem(todoKey);
      if (storedTodos) setTodos(JSON.parse(storedTodos));
    } catch { /* empty */ }
    try {
      const notesRaw = localStorage.getItem(`calendar-notes-${year}`);
      if (notesRaw) {
        const parsed = JSON.parse(notesRaw);
        setNoteText(parsed[noteKey] || '');
      }
    } catch { /* empty */ }
  }, [storageKey, todoKey, noteKey, year]);

  const saveEvents = useCallback((evts: TimeEvent[]) => {
    setEvents(evts);
    try { localStorage.setItem(storageKey, JSON.stringify(evts)); } catch { /* empty */ }
  }, [storageKey]);

  const saveTodos = useCallback((items: TodoItem[]) => {
    setTodos(items);
    try { localStorage.setItem(todoKey, JSON.stringify(items)); } catch { /* empty */ }
  }, [todoKey]);

  const saveNote = useCallback(() => {
    try {
      const raw = localStorage.getItem(`calendar-notes-${year}`);
      const existing = raw ? JSON.parse(raw) : {};
      existing[noteKey] = noteText;
      localStorage.setItem(`calendar-notes-${year}`, JSON.stringify(existing));
    } catch { /* empty */ }
  }, [noteText, noteKey, year]);

  const addEvent = () => {
    if (!newEvent.title.trim()) return;
    const evt: TimeEvent = {
      id: Date.now().toString(),
      time: newEvent.time,
      endTime: newEvent.endTime,
      title: newEvent.title,
      desc: newEvent.desc,
      color: COLORS[events.length % COLORS.length],
      done: false,
    };
    saveEvents([...events, evt].sort((a, b) => a.time.localeCompare(b.time)));
    setNewEvent({ time: '09:00', endTime: '10:00', title: '', desc: '' });
    setShowAddEvent(false);
  };

  const toggleDone = (id: string) => {
    saveEvents(events.map(e => e.id === id ? { ...e, done: !e.done } : e));
  };

  const removeEvent = (id: string) => {
    saveEvents(events.filter(e => e.id !== id));
  };

  const toggleTodo = (id: string) => {
    saveTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const removeTodo = (id: string) => {
    saveTodos(todos.filter(t => t.id !== id));
  };

  const updateTodoText = (id: string, text: string) => {
    saveTodos(todos.map(t => t.id === id ? { ...t, text } : t));
  };

  const addTodoInline = () => {
    if (!newTodoText.trim()) return;
    saveTodos([...todos, {
      id: Date.now().toString(),
      text: newTodoText.trim(),
      done: false,
      color: COLORS[todos.length % COLORS.length],
    }]);
    setNewTodoText('');
  };

  // Voice parsing: time detected → schedule; no time → todo
  const parseVoiceToEvents = (text: string) => {
    const foundTimes: { hour: number; minute: number }[] = [];
    let match: RegExpExecArray | null;

    const afternoonPattern = /下午\s*(\d{1,2})\s*点半?/g;
    while ((match = afternoonPattern.exec(text)) !== null) {
      const h = parseInt(match[1]);
      foundTimes.push({ hour: h + 12 <= 23 ? h + 12 : h, minute: text.includes('半') ? 30 : 0 });
    }

    const morningPattern = /(?<!下午)(?:上午|早上|早晨|晚上|傍晚)?\s*(\d{1,2})\s*点半?/g;
    while ((match = morningPattern.exec(text)) !== null) {
      const h = parseInt(match[1]);
      if (h >= 0 && h <= 23) {
        foundTimes.push({ hour: h, minute: text.slice(match.index).includes('半') ? 30 : 0 });
      }
    }

    const hhmmPattern = /(\d{1,2}):(\d{2})/g;
    while ((match = hhmmPattern.exec(text)) !== null) {
      foundTimes.push({ hour: parseInt(match[1]), minute: parseInt(match[2]) });
    }

    const cleanText = text
      .replace(/(上午|下午|早上|早晨|晚上|傍晚)\s*/g, '')
      .replace(/\d{1,2}点半?/g, '')
      .replace(/\d{1,2}:\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (foundTimes.length > 0 && cleanText) {
      // Has time → add to schedule
      const newEvts: TimeEvent[] = foundTimes.map((t, i) => {
        const startH = t.hour.toString().padStart(2, '0');
        const startM = t.minute.toString().padStart(2, '0');
        const endH = (t.hour + 1 > 23 ? 23 : t.hour + 1).toString().padStart(2, '0');
        return {
          id: `${Date.now()}-${i}`,
          time: `${startH}:${startM}`,
          endTime: `${endH}:${startM}`,
          title: cleanText,
          desc: '',
          color: COLORS[(events.length + i) % COLORS.length],
          done: false,
        };
      });
      saveEvents([...events, ...newEvts].sort((a, b) => a.time.localeCompare(b.time)));
      setActiveTab('schedule');
    } else if (cleanText) {
      // No time → add to todos
      saveTodos([...todos, {
        id: Date.now().toString(),
        text: cleanText,
        done: false,
        color: COLORS[todos.length % COLORS.length],
      }]);
      setActiveTab('memo');
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = createRecognition();
    if (!recognition) {
      alert('您的浏览器不支持语音识别，请使用Chrome浏览器');
      return;
    }

    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      voiceTextRef.current = transcript;
      setVoiceText(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      const finalText = voiceTextRef.current.trim();
      if (finalText) {
        parseVoiceToEvents(finalText);
        setVoiceText('');
        voiceTextRef.current = '';
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const eventLayout = useMemo(() => computeEventLayout(events), [events]);

  if (!mounted) return null;

  const lunarInfo = getLunarInfo(year, month, day);
  const date = new Date(year, month - 1, day);
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  const isToday = (() => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month - 1 && now.getDate() === day;
  })();

  const now = new Date();
  const currentHour = isToday ? now.getHours() : -1;

  const getEventStyle = (evt: TimeEvent, layout: EventLayout) => {
    const [startH, startM] = evt.time.split(':').map(Number);
    const [endH, endM] = evt.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const HOUR_HEIGHT = 36;
    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max(20, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT);
    const widthPercent = 100 / layout.totalColumns;
    const leftPercent = layout.columnIndex * widthPercent;

    return { top, height, left: `${leftPercent}%`, width: `${widthPercent}%` };
  };

  // Accent color for header

  // ========== Sidebar Panel Content ==========
  const panelContent = (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: skin.panelBg }}>
      {/* Header with gradient */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 relative overflow-hidden" style={{ backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${skin.sidebarFrom}cc, ${skin.sidebarTo}bb)` }} />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl font-bold text-white">{day}号</span>
                <span className="text-sm text-white/70 font-medium">{weekDay}</span>
                {isToday && (
                  <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">今天</span>
                )}
              </div>
              <div className="text-xs text-white/50">{year}年{month}月</div>
              <div className="text-xs text-white/50 mt-0.5">
                农历{lunarInfo.lunarMonth}月{lunarInfo.lunarDay}
                {lunarInfo.isSolarTerm && <span className="text-amber-300 ml-1">{lunarInfo.display}</span>}
                {lunarInfo.isFestival && !lunarInfo.isSolarTerm && <span className="text-red-300 ml-1">{lunarInfo.display}</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Switcher + Voice Button */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 pt-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('schedule')}
            className="relative px-4 py-2 text-sm font-medium rounded-t-lg transition-all"
            style={{ color: activeTab === 'schedule' ? skin.tabActive : skin.textSecondary, backgroundColor: activeTab === 'schedule' ? skin.tabActive + '0a' : 'transparent' }}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              日程
            </span>
            {activeTab === 'schedule' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: `linear-gradient(90deg, ${skin.tabActive}, ${skin.swatch})` }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('memo')}
            className="relative px-4 py-2 text-sm font-medium rounded-t-lg transition-all"
            style={{ color: activeTab === 'memo' ? skin.tabActive : skin.textSecondary, backgroundColor: activeTab === 'memo' ? skin.tabActive + '0a' : 'transparent' }}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              备忘
            </span>
            {activeTab === 'memo' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: `linear-gradient(90deg, ${skin.tabActive}, ${skin.swatch})` }} />
            )}
          </button>

          {/* Voice button on the right side */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleVoice}
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
                isListening
                  ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm shadow-red-100'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {isListening ? '聆听中...' : '语音'}
            </button>
          </div>
        </div>
        {/* Voice text preview */}
        {voiceText && (
          <div className="mt-1 mb-1 text-xs px-3 py-1.5 rounded-lg break-all"
          style={{ color: skin.tabActive, backgroundColor: skin.tabActive + "10" }}>
            {voiceText}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'schedule' ? (
          /* ===== Schedule Tab ===== */
          <div className="h-full flex flex-col" style={{ backgroundColor: skin.cardBg }}>
            {/* Add Event Bar */}
            <div className="flex-shrink-0 px-4 py-2 border-b border-gray-50 flex items-center gap-2">
              <button
                onClick={() => setShowAddEvent(!showAddEvent)}
                className="flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-all hover:shadow-sm"
                style={{ background: `linear-gradient(90deg, ${skin.tabActive}, ${skin.swatch})` }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                添加日程
              </button>
              {todos.length > 0 && (
                <span className="text-[10px] text-gray-300 bg-gray-50 px-2 py-1 rounded-full">{todos.length}项待办</span>
              )}
            </div>

            {/* Add Event Form - TickTick style: no border, inline */}
            {showAddEvent && (
              <div className="flex-shrink-0 px-4 py-3 border-b"
              style={{ backgroundColor: skin.tabActive + "08", borderColor: skin.tabActive + "20" }}>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="日程标题"
                  className="w-full text-sm font-medium text-gray-800 placeholder-gray-300 focus:outline-none mb-2 bg-transparent border-b border-transparent  pb-1 transition-colors"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') addEvent(); }}
                />
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <input
                    type="time" value={newEvent.time}
                    onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="border-0 rounded px-2 py-1 focus:outline-none bg-white/60 text-[11px]"
                  />
                  <span className="text-gray-300">-</span>
                  <input
                    type="time" value={newEvent.endTime}
                    onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    className="border-0 rounded px-2 py-1 focus:outline-none bg-white/60 text-[11px]"
                  />
                  <input
                    type="text"
                    value={newEvent.desc}
                    onChange={e => setNewEvent({ ...newEvent, desc: e.target.value })}
                    placeholder="备注"
                    className="flex-1 border-0 rounded px-2 py-1 focus:outline-none bg-white/60 text-[11px]"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setShowAddEvent(false)} className="text-xs px-3 py-1 transition-colors"
                  style={{color: skin.textSecondary}}>取消</button>
                  <button onClick={addEvent} disabled={!newEvent.title.trim()} className="text-xs font-medium text-white px-3 py-1 rounded-lg transition-all disabled:opacity-40" style={{ background: `linear-gradient(90deg, ${skin.tabActive}, ${skin.swatch})` }}>添加</button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
              <div className="flex relative" style={{ minHeight: `${24 * 36}px` }}>
                {/* Time Column */}
                <div className="w-12 flex-shrink-0 border-r border-gray-50">
                  {hours.map(h => (
                    <div key={h} className="flex items-start justify-end pr-1.5" style={{ height: 36 }}>
                      <span className="text-[10px] pt-0" style={h === currentHour ? { color: skin.tabActive, fontWeight: 600 } : { color: skin.textMuted }}>
                        {h.toString().padStart(2, '0')}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* Events Column */}
                <div className="flex-1 relative">
                  {hours.map(h => (
                    <div key={h} className="border-b border-gray-50/80 relative" style={{ height: 36 }}>
                      {h === currentHour && (
                        <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-red-400 z-10">
                          <div className="absolute -left-1 -top-[3px] w-2 h-2 bg-red-400 rounded-full" />
                        </div>
                      )}
                    </div>
                  ))}

                  {events.map(evt => {
                    const layout = eventLayout.get(evt.id) || { columnIndex: 0, totalColumns: 1 };
                    const style = getEventStyle(evt, layout);
                    return (
                      <div
                        key={evt.id}
                        className={`absolute rounded-lg px-2 py-1 z-5 transition-all group overflow-hidden ${evt.done ? 'opacity-50' : ''}`}
                        style={{ ...style, backgroundColor: `${evt.color}10`, borderLeft: `3px solid ${evt.color}` }}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleDone(evt.id)}
                            className="flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                            style={{ borderColor: evt.color, backgroundColor: evt.done ? evt.color : 'transparent' }}
                          >
                            {evt.done && (
                              <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <span className={`text-[11px] font-medium truncate ${evt.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                            {evt.title}
                          </span>
                          {layout.totalColumns <= 2 && (
                            <span className="text-[9px] text-gray-400 ml-auto flex-shrink-0">{evt.time}-{evt.endTime}</span>
                          )}
                          <button onClick={() => removeEvent(evt.id)} className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ===== Memo Tab - TickTick style ===== */
          <div className="h-full flex flex-col" style={{ backgroundColor: skin.cardBg }}>
            {/* Todo Section - Inline editing, no borders */}
            <div className="flex-shrink-0 border-b border-gray-100/80">
              <div className="flex items-center justify-between px-5 pt-3 pb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">待办事项</span>
              </div>
              <div className="px-4 pb-2">
                {todos.map(todo => (
                  <div key={todo.id} className="flex items-center gap-2.5 py-1.5 group">
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className="flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all hover:shadow-sm"
                      style={{ borderColor: todo.color, backgroundColor: todo.done ? todo.color : 'transparent' }}
                    >
                      {todo.done && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    {editingTodoId === todo.id ? (
                      <input
                        type="text"
                        value={editingTodoText}
                        onChange={e => setEditingTodoText(e.target.value)}
                        onBlur={() => { updateTodoText(todo.id, editingTodoText); setEditingTodoId(null); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateTodoText(todo.id, editingTodoText); setEditingTodoId(null); }
                          if (e.key === 'Escape') setEditingTodoId(null);
                        }}
                        className="flex-1 text-sm text-gray-700 focus:outline-none border-b pb-0.5 bg-transparent"
                        style={{ borderColor: skin.tabActive + "60" }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`text-sm flex-1 cursor-text ${todo.done ? 'line-through text-gray-300' : 'text-gray-600'}`}
                        onClick={() => { setEditingTodoId(todo.id); setEditingTodoText(todo.text); }}
                      >
                        {todo.text}
                      </span>
                    )}
                    <button
                      onClick={() => removeTodo(todo.id)}
                      className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {/* Add todo - inline input, TickTick style */}
                <div className="flex items-center gap-2.5 py-1.5 mt-1">
                  <div className="flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 border-gray-200 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <input
                    ref={addTodoInputRef}
                    type="text"
                    value={newTodoText}
                    onChange={e => setNewTodoText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTodoInline(); }}
                    onBlur={() => { if (newTodoText.trim()) addTodoInline(); }}
                    placeholder="添加待办..."
                    className="flex-1 text-sm text-gray-600 placeholder-gray-300 focus:outline-none bg-transparent border-b border-transparent  pb-0.5 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Notes - full remaining space, TickTick style */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-5 pt-3 pb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">备忘录</span>
                <span className="text-[10px] text-gray-300">{noteText.length > 0 ? `${noteText.length}字` : ''}</span>
              </div>
              <div className="flex-1 min-h-0 px-4 pb-4">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onBlur={saveNote}
                  placeholder="在这里记录想法、笔记、灵感..."
                  className="w-full h-full text-sm text-gray-600 placeholder-gray-300 focus:outline-none bg-indigo-50/10 rounded-xl p-4 resize-none leading-relaxed border border-transparent  transition-colors"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return panelContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-white shadow-2xl animate-slide-in-panel overflow-hidden"
        style={{ width: '480px', maxWidth: '90vw', height: '100vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {panelContent}
      </div>
    </div>
  );
}
