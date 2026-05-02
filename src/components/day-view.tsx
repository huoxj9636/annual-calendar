'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getLunarInfo } from '@/lib/lunar';

interface DayViewProps {
  year: number;
  month: number;
  day: number;
  onClose: () => void;
  embedded?: boolean;
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

export default function DayView({ year, month, day, onClose, embedded }: DayViewProps) {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<TimeEvent[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [noteText, setNoteText] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ time: '09:00', endTime: '10:00', title: '', desc: '' });
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceTextRef = useRef('');

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

  const parseVoiceToEvents = (text: string) => {
    const foundTimes: { hour: number; minute: number }[] = [];
    let match: RegExpExecArray | null;

    const afternoonPattern = /下午\s*(\d{1,2})\s*点半?/g;
    while ((match = afternoonPattern.exec(text)) !== null) {
      const h = parseInt(match[1]);
      foundTimes.push({ hour: h + 12 <= 23 ? h + 12 : h, minute: text.includes('半') ? 30 : 0 });
    }

    const morningPattern = /(?<!下午)(?:上午|早上|早晨)?\s*(\d{1,2})\s*点半?/g;
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

    let cleanText = text
      .replace(/(上午|下午|早上|早晨|晚上|傍晚)\s*/g, '')
      .replace(/\d{1,2}点半?/g, '')
      .replace(/\d{1,2}:\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (foundTimes.length > 0 && cleanText) {
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
    } else if (cleanText) {
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

  if (!mounted) return null;

  const lunarInfo = getLunarInfo(year, month, day);
  const date = new Date(year, month - 1, day);
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  const isToday = (() => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month - 1 && now.getDate() === day;
  })();

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const now = new Date();
  const currentHour = isToday ? now.getHours() : -1;

  const getEventsForHour = (h: number) => {
    return events.filter(e => {
      const startH = parseInt(e.time.split(':')[0]);
      return startH === h;
    });
  };

  // ========== Sidebar Panel Content ==========
  const panelContent = (
    <div className="h-full flex flex-col bg-white">
      {/* Header - Date Info */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl font-bold text-gray-900">{day}</span>
              <span className="text-sm text-gray-400 font-medium">{weekDay}</span>
              {isToday && (
                <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium">今天</span>
              )}
            </div>
            <div className="text-xs text-gray-400">{year}年{month}月</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {lunarInfo.lunarMonth}月{lunarInfo.lunarDay}
              {lunarInfo.isSolarTerm && <span className="text-amber-500 ml-1">{lunarInfo.display}</span>}
              {lunarInfo.isFestival && !lunarInfo.isSolarTerm && <span className="text-red-400 ml-1">{lunarInfo.display}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Voice + Add buttons row */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setShowAddEvent(!showAddEvent)}
            className="flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-all hover:shadow-sm"
            style={{ background: 'linear-gradient(135deg, #4f8ff7, #6c5ce7)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            添加日程
          </button>
          <button
            onClick={toggleVoice}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
              isListening
                ? 'bg-red-50 text-red-500 border border-red-200'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {isListening ? '聆听中...' : '语音添加'}
          </button>
          {events.length > 0 && (
            <span className="text-[10px] text-gray-300 bg-gray-50 px-2 py-1 rounded-full ml-auto">{events.length}项日程</span>
          )}
        </div>

        {/* Voice text preview */}
        {voiceText && (
          <div className="mt-2 text-xs text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg break-all">
            {voiceText}
          </div>
        )}

        {/* Add Event Form */}
        {showAddEvent && (
          <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
            <input
              type="text"
              value={newEvent.title}
              onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
              placeholder="日程标题"
              className="w-full text-sm font-medium text-gray-800 placeholder-gray-300 focus:outline-none mb-2 bg-transparent"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addEvent(); }}
            />
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="time" value={newEvent.time}
                onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                className="border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-300 bg-white text-[11px]"
              />
              <span className="text-gray-300">-</span>
              <input
                type="time" value={newEvent.endTime}
                onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })}
                className="border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-300 bg-white text-[11px]"
              />
              <input
                type="text"
                value={newEvent.desc}
                onChange={e => setNewEvent({ ...newEvent, desc: e.target.value })}
                placeholder="备注"
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-300 bg-white text-[11px]"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowAddEvent(false)}
                className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1 transition-colors"
              >
                取消
              </button>
              <button
                onClick={addEvent}
                disabled={!newEvent.title.trim()}
                className="text-xs font-medium text-white px-3 py-1 rounded-lg transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #4f8ff7, #6c5ce7)' }}
              >
                添加
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="flex">
          {/* Time Column */}
          <div className="w-12 flex-shrink-0 border-r border-gray-50">
            {hours.map(h => (
              <div
                key={h}
                className="h-9 flex items-start justify-end pr-1.5 pt-0"
              >
                <span
                  className="text-[10px]"
                  style={h === currentHour ? { color: '#4f8ff7', fontWeight: 600 } : { color: '#c4c4c4' }}
                >
                  {h.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Events Column */}
          <div className="flex-1 relative">
            {hours.map(h => (
              <div key={h} className="h-9 border-b border-gray-50/80 relative">
                {h === currentHour && (
                  <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-red-400 z-10">
                    <div className="absolute -left-1 -top-[3px] w-2 h-2 bg-red-400 rounded-full" />
                  </div>
                )}
                {getEventsForHour(h).map(evt => (
                  <div
                    key={evt.id}
                    className={`absolute left-1 right-1 rounded-lg px-2.5 py-1 z-5 transition-all group ${evt.done ? 'opacity-50' : ''}`}
                    style={{
                      backgroundColor: `${evt.color}12`,
                      borderLeft: `3px solid ${evt.color}`,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
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
                      <span className="text-[9px] text-gray-400 ml-auto flex-shrink-0">
                        {evt.time}-{evt.endTime}
                      </span>
                      <button
                        onClick={() => removeEvent(evt.id)}
                        className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
      <div className="flex-shrink-0 border-t border-gray-200">
        {/* Todos */}
        {todos.length > 0 && (
          <div className="px-5 py-2 border-b border-gray-100">
            <div className="text-[10px] font-medium text-gray-400 mb-1">待办事项</div>
            {todos.map(todo => (
              <div key={todo.id} className="flex items-center gap-2 py-0.5 group">
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className="flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: todo.color, backgroundColor: todo.done ? todo.color : 'transparent' }}
                >
                  {todo.done && (
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className={`text-xs ${todo.done ? 'line-through text-gray-300' : 'text-gray-600'}`}>
                  {todo.text}
                </span>
                <button
                  onClick={() => removeTodo(todo.id)}
                  className="ml-auto text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Note */}
        <div className="px-5 py-2.5">
          <div className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onBlur={saveNote}
              placeholder="备忘录..."
              className="flex-1 text-xs text-gray-600 placeholder-gray-300 focus:outline-none bg-transparent resize-none"
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return panelContent;
  }

  // Non-embedded: standalone overlay mode (fallback)
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
