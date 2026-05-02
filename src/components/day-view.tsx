'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLunarInfo } from '@/lib/lunar';
import { getDaysInMonth } from '@/lib/calendar-utils';

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

const COLORS = ['#4f8ff7', '#f45b69', '#15c7a0', '#f5a623', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c'];

export default function DayView({ year, month, day, onClose }: DayViewProps) {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<TimeEvent[]>([]);
  const [noteText, setNoteText] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ time: '09:00', endTime: '10:00', title: '', desc: '' });

  const storageKey = `dayview-events-${year}-${month}-${day}`;
  const noteKey = `${year}-${month}-${day}`;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setEvents(JSON.parse(stored));
    } catch {}
    try {
      const notesRaw = localStorage.getItem('calendar-notes');
      if (notesRaw) {
        const parsed = JSON.parse(notesRaw);
        setNoteText(parsed[noteKey] || '');
      }
    } catch {}
  }, [storageKey, noteKey]);

  const saveEvents = useCallback((evts: TimeEvent[]) => {
    setEvents(evts);
    try { localStorage.setItem(storageKey, JSON.stringify(evts)); } catch {}
  }, [storageKey]);

  const saveNote = useCallback(() => {
    try {
      const raw = localStorage.getItem('calendar-notes');
      const existing = raw ? JSON.parse(raw) : {};
      existing[noteKey] = noteText;
      localStorage.setItem('calendar-notes', JSON.stringify(existing));
    } catch {}
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
    saveEvents([...events, evt]);
    setNewEvent({ time: '09:00', endTime: '10:00', title: '', desc: '' });
    setShowAddEvent(false);
  };

  const toggleDone = (id: string) => {
    saveEvents(events.map(e => e.id === id ? { ...e, done: !e.done } : e));
  };

  const removeEvent = (id: string) => {
    saveEvents(events.filter(e => e.id !== id));
  };

  if (!mounted) return null;

  const lunarInfo = getLunarInfo(year, month, day);
  const date = new Date(year, month - 1, day);
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  const isToday = (() => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month - 1 && now.getDate() === day;
  })();

  // Group events by time periods
  const morningEvents = events.filter(e => parseInt(e.time) < 12);
  const afternoonEvents = events.filter(e => parseInt(e.time) >= 12 && parseInt(e.time) < 18);
  const eveningEvents = events.filter(e => parseInt(e.time) >= 18);

  const EventItem = ({ evt }: { evt: TimeEvent }) => (
    <div
      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-gray-50 group ${evt.done ? 'opacity-50' : ''}`}
    >
      <button
        onClick={() => toggleDone(evt.id)}
        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
        style={{ borderColor: evt.color, backgroundColor: evt.done ? evt.color : 'transparent' }}
      >
        {evt.done && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${evt.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {evt.title}
        </div>
        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
          <span>{evt.time} - {evt.endTime}</span>
          {evt.desc && <span className="text-gray-300">|</span>}
          {evt.desc && <span>{evt.desc}</span>}
        </div>
      </div>
      <button
        onClick={() => removeEvent(evt.id)}
        className="flex-shrink-0 text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );

  const TimeSection = ({ title, icon, items }: { title: string; icon: string; items: TimeEvent[] }) => {
    if (items.length === 0 && title !== '上午') return null;
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 px-3 mb-1">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-medium text-gray-400 tracking-wide">{title}</span>
          {items.length > 0 && (
            <span className="text-xs text-gray-300">{items.filter(e => e.done).length}/{items.length}</span>
          )}
        </div>
        {items.length > 0 ? (
          items.map(evt => <EventItem key={evt.id} evt={evt} />)
        ) : (
          <div className="px-3 py-2 text-xs text-gray-200">暂无日程</div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl overflow-hidden flex"
        style={{ width: '780px', height: '640px', maxWidth: '95vw', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Left Sidebar - Date Info */}
        <div className="w-52 flex-shrink-0 flex flex-col" style={{ background: 'linear-gradient(160deg, #4f8ff7 0%, #6c5ce7 100%)' }}>
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

            {/* Stats */}
            <div className="mt-auto">
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
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
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100/80">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-gray-800">日程</span>
              <span className="text-xs text-gray-300 bg-gray-50 px-2 py-0.5 rounded">{events.length}项</span>
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
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50/80 to-purple-50/80 border-b border-gray-100/60">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="日程标题"
                  className="w-full text-sm font-medium text-gray-800 placeholder-gray-300 focus:outline-none mb-3"
                  autoFocus
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

          {/* Event List by Time Period */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TimeSection title="上午" icon="🌅" items={morningEvents} />
            <TimeSection title="下午" icon="☀️" items={afternoonEvents} />
            <TimeSection title="晚上" icon="🌙" items={eveningEvents} />

            {events.length === 0 && !showAddEvent && (
              <div className="flex flex-col items-center justify-center h-full text-gray-200">
                <svg className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="text-sm">今天还没有日程</div>
                <div className="text-xs mt-1">点击上方按钮添加</div>
              </div>
            )}
          </div>

          {/* Bottom Notes */}
          <div className="border-t border-gray-100/80 px-6 py-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <input
                type="text"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onBlur={saveNote}
                placeholder="备忘录..."
                className="flex-1 text-sm text-gray-600 placeholder-gray-300 focus:outline-none bg-transparent"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
