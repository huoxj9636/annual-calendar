'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getLunarInfo } from '@/lib/lunar';

interface DayViewProps {
  year: number;
  month: number;
  day: number;
  onClose: () => void;
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

const COLORS = ['#4f8ff7', '#f45b69', '#15c7a0', '#f5a623', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c'];

export default function DayView({ year, month, day, onClose }: DayViewProps) {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<TimeEvent[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [noteText, setNoteText] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ time: '09:00', endTime: '10:00', title: '', desc: '' });
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);

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
      const notesRaw = localStorage.getItem('calendar-notes');
      if (notesRaw) {
        const parsed = JSON.parse(notesRaw);
        setNoteText(parsed[noteKey] || '');
      }
    } catch { /* empty */ }
  }, [storageKey, todoKey, noteKey]);

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
      const raw = localStorage.getItem('calendar-notes');
      const existing = raw ? JSON.parse(raw) : {};
      existing[noteKey] = noteText;
      localStorage.setItem('calendar-notes', JSON.stringify(existing));
    } catch { /* empty */ }
  }, [noteText, noteKey]);

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

  // Voice recognition
  function createRecognition() {
    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new (SpeechRecognition as new () => SpeechRecognition)();
    return recognition;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
  }

  interface SpeechRecognitionEvent {
    results: {
      length: number;
      [index: number]: {
        isFinal: boolean;
        [index: number]: { transcript: string };
      };
    };
  }

  const parseVoiceToEvents = (text: string) => {
    // Try to extract time patterns like "9点", "9点半", "上午10点", "下午3点", "15点", "3点半"
    const timePatterns = [
      /(?:上午|早上|早晨)?(\d{1,2})点半?/g,
      /下午(\d{1,2})点半?/g,
      /(\d{1,2}):(\d{2})/g,
    ];

    const foundTimes: { hour: number; minute: number }[] = [];

    // Match "下午X点" → X+12
    let match: RegExpExecArray | null;
    const afternoonPattern = /下午\s*(\d{1,2})\s*点半?/g;
    while ((match = afternoonPattern.exec(text)) !== null) {
      const h = parseInt(match[1]);
      foundTimes.push({ hour: h + 12 <= 23 ? h + 12 : h, minute: text.includes('半') ? 30 : 0 });
    }

    // Match "上午X点" or "X点" (not afternoon)
    const morningPattern = /(?<!下午)(?:上午|早上|早晨)?\s*(\d{1,2})\s*点半?/g;
    while ((match = morningPattern.exec(text)) !== null) {
      const h = parseInt(match[1]);
      if (h >= 0 && h <= 23) {
        foundTimes.push({ hour: h, minute: text.slice(match.index).includes('半') ? 30 : 0 });
      }
    }

    // Match HH:MM format
    const hhmmPattern = /(\d{1,2}):(\d{2})/g;
    while ((match = hhmmPattern.exec(text)) !== null) {
      foundTimes.push({ hour: parseInt(match[1]), minute: parseInt(match[2]) });
    }

    // Clean title: remove time patterns
    let cleanText = text
      .replace(/(上午|下午|早上|早晨|晚上|傍晚)\s*/g, '')
      .replace(/\d{1,2}点半?/g, '')
      .replace(/\d{1,2}:\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (foundTimes.length > 0 && cleanText) {
      // Create timed events
      const newEvents: TimeEvent[] = foundTimes.map((t, i) => {
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
      saveEvents([...events, ...newEvents].sort((a, b) => a.time.localeCompare(b.time)));
    } else if (cleanText) {
      // No time found → add as todo
      saveTodos([...todos, {
        id: Date.now().toString(),
        text: cleanText,
        done: false,
        color: COLORS[todos.length % COLORS.length],
      }]);
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

    const rec = recognition as unknown as SpeechRecognition;
    rec.lang = 'zh-CN';
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setVoiceText(transcript);
    };

    rec.onerror = () => {
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
      if (voiceText.trim()) {
        parseVoiceToEvents(voiceText.trim());
        setVoiceText('');
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  if (!mounted) return null;

  const lunarInfo = getLunarInfo(year, month, day);
  const date = new Date(year, month - 1, day);
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  const isToday = (() => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month - 1 && now.getDate() === day;
  })();

  // Build timeline: 0-23 hours
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const now = new Date();
  const currentHour = isToday ? now.getHours() : -1;

  // Get events for a specific hour
  const getEventsForHour = (h: number) => {
    return events.filter(e => {
      const startH = parseInt(e.time.split(':')[0]);
      return startH === h;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden flex"
        style={{ width: '900px', height: '720px', maxWidth: '96vw', maxHeight: '94vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Left Sidebar - Date Info */}
        <div className="w-56 flex-shrink-0 flex flex-col" style={{ background: 'linear-gradient(160deg, #4f8ff7 0%, #6c5ce7 100%)' }}>
          <div className="p-5 flex-1 flex flex-col">
            <button onClick={onClose} className="self-end text-white/50 hover:text-white text-lg mb-3 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-white/60 text-sm font-medium">{year}年{month}月</div>
            <div className="text-white text-7xl font-extralight leading-none mt-1">{day}</div>
            <div className="text-white/80 text-sm mt-2">{weekDay}</div>

            {isToday && (
              <span className="mt-3 self-start bg-white/20 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm font-medium">
                今天
              </span>
            )}

            <div className="mt-6 pt-4 border-t border-white/15">
              <div className="text-white/40 text-xs uppercase tracking-widest mb-2">农历</div>
              <div className="text-white text-base font-light">{lunarInfo.lunarMonth}月{lunarInfo.lunarDay}</div>
              {lunarInfo.isSolarTerm && (
                <div className="text-amber-300 text-sm mt-1 font-medium">{lunarInfo.display}</div>
              )}
              {lunarInfo.isFestival && !lunarInfo.isSolarTerm && (
                <div className="text-red-300 text-sm mt-1 font-medium">{lunarInfo.display}</div>
              )}
            </div>

            {/* Voice Input */}
            <div className="mt-auto">
              <button
                onClick={toggleVoice}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                  isListening
                    ? 'bg-red-400/90 text-white animate-pulse'
                    : 'bg-white/15 text-white/80 hover:bg-white/25'
                } backdrop-blur-sm`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {isListening ? '正在聆听...' : '语音添加'}
              </button>
              {voiceText && (
                <div className="mt-2 text-white/70 text-xs text-center break-all">{voiceText}</div>
              )}

              {/* Stats */}
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm mt-3">
                <div className="text-white/50 text-xs mb-1">今日进度</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/60 rounded-full transition-all"
                      style={{ width: `${events.length > 0 ? (events.filter(e => e.done).length / events.length * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-white/60 text-xs">
                    {events.length > 0 ? `${events.filter(e => e.done).length}/${events.length}` : '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100/80">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-gray-800">日程安排</span>
              <span className="text-xs text-gray-300 bg-gray-50 px-2 py-0.5 rounded">{events.length}项日程</span>
              {todos.length > 0 && (
                <span className="text-xs text-gray-300 bg-gray-50 px-2 py-0.5 rounded">{todos.length}项待办</span>
              )}
            </div>
            <button
              onClick={() => setShowAddEvent(!showAddEvent)}
              className="flex items-center gap-1.5 text-sm font-medium text-white px-4 py-2 rounded-xl transition-all hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #4f8ff7, #6c5ce7)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              添加日程
            </button>
          </div>

          {/* Add Event Form */}
          {showAddEvent && (
            <div className="px-6 py-3 bg-gradient-to-r from-blue-50/80 to-purple-50/80 border-b border-gray-100/60">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="日程标题"
                  className="w-full text-sm font-medium text-gray-800 placeholder-gray-300 focus:outline-none mb-3"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') addEvent(); }}
                />
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <input
                    type="time" value={newEvent.time}
                    onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-300"
                  />
                  <span className="text-gray-300">至</span>
                  <input
                    type="time" value={newEvent.endTime}
                    onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    className="border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-300"
                  />
                  <input
                    type="text"
                    value={newEvent.desc}
                    onChange={e => setNewEvent({ ...newEvent, desc: e.target.value })}
                    placeholder="备注"
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-300"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => setShowAddEvent(false)}
                    className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={addEvent}
                    disabled={!newEvent.title.trim()}
                    className="text-sm font-medium text-white px-4 py-1.5 rounded-lg transition-all disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #4f8ff7, #6c5ce7)' }}
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Timeline + Events */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="flex">
              {/* Time Column */}
              <div className="w-16 flex-shrink-0 border-r border-gray-100">
                {hours.map(h => (
                  <div
                    key={h}
                    className="h-10 flex items-start justify-end pr-2 pt-0"
                    style={h === currentHour ? { color: '#4f8ff7', fontWeight: 600 } : undefined}
                  >
                    <span className="text-[11px] text-gray-400" style={h === currentHour ? { color: '#4f8ff7', fontWeight: 600 } : undefined}>
                      {h.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Events Column */}
              <div className="flex-1 relative">
                {/* Hour grid lines */}
                {hours.map(h => (
                  <div key={h} className="h-10 border-b border-gray-50 relative">
                    {h === currentHour && (
                      <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-red-400 z-10">
                        <div className="absolute -left-1 -top-[3px] w-2 h-2 bg-red-400 rounded-full" />
                      </div>
                    )}
                    {/* Events in this hour */}
                    {getEventsForHour(h).map(evt => (
                      <div
                        key={evt.id}
                        className={`absolute left-2 right-2 rounded-lg px-3 py-1.5 z-5 transition-all group ${evt.done ? 'opacity-50' : ''}`}
                        style={{
                          backgroundColor: `${evt.color}15`,
                          borderLeft: `3px solid ${evt.color}`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleDone(evt.id)}
                            className="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                            style={{ borderColor: evt.color, backgroundColor: evt.done ? evt.color : 'transparent' }}
                          >
                            {evt.done && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <span className={`text-xs font-medium ${evt.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                            {evt.title}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-auto">
                            {evt.time}-{evt.endTime}
                          </span>
                          <button
                            onClick={() => removeEvent(evt.id)}
                            className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: Todos + Notes */}
          <div className="border-t border-gray-200">
            {/* Todos */}
            {todos.length > 0 && (
              <div className="px-6 py-2 border-b border-gray-100">
                <div className="text-xs font-medium text-gray-400 mb-1.5">待办事项</div>
                {todos.map(todo => (
                  <div key={todo.id} className="flex items-center gap-2 py-1 group">
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: todo.color, backgroundColor: todo.done ? todo.color : 'transparent' }}
                    >
                      {todo.done && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`text-sm ${todo.done ? 'line-through text-gray-300' : 'text-gray-600'}`}>
                      {todo.text}
                    </span>
                    <button
                      onClick={() => removeTodo(todo.id)}
                      className="ml-auto text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Note */}
            <div className="px-6 py-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onBlur={saveNote}
                  placeholder="备忘录..."
                  className="flex-1 text-sm text-gray-600 placeholder-gray-300 focus:outline-none bg-transparent resize-none"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
