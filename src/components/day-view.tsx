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
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

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
    };
    saveEvents([...events, evt]);
    setNewEvent({ time: '09:00', endTime: '10:00', title: '', desc: '' });
    setShowAddEvent(false);
  };

  const removeEvent = (id: string) => {
    saveEvents(events.filter(e => e.id !== id));
  };

  if (!mounted) return null;

  const lunarInfo = getLunarInfo(year, month, day);
  const date = new Date(year, month - 1, day);
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  const daysInMonth = getDaysInMonth(year, month);
  const isToday = (() => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month - 1 && now.getDate() === day;
  })();

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForHour = (h: number) =>
    events.filter(e => {
      const eh = parseInt(e.time.split(':')[0], 10);
      return eh === h;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden flex"
        style={{ width: '860px', height: '680px', maxWidth: '95vw', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Left: Date Info */}
        <div className="w-56 flex-shrink-0 bg-gradient-to-b from-slate-700 to-slate-900 text-white p-6 flex flex-col">
          <button onClick={onClose} className="self-end text-white/60 hover:text-white text-xl mb-4">✕</button>
          <div className="text-6xl font-bold leading-none">{day}</div>
          <div className="text-lg mt-2 font-medium">{year}年{month}月</div>
          <div className="text-sm mt-1 text-white/70">星期{weekDay}</div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-1">农历</div>
            <div className="text-base">{lunarInfo.lunarMonth}月{lunarInfo.lunarDay}</div>
            {lunarInfo.isSolarTerm && <div className="text-sm text-amber-300 mt-1">{lunarInfo.display}</div>}
            {lunarInfo.isFestival && <div className="text-sm text-red-300 mt-1">{lunarInfo.display}</div>}
          </div>
          {isToday && (
            <div className="mt-4 bg-blue-500 text-white text-xs px-3 py-1 rounded-full self-start font-medium">今天</div>
          )}
          <div className="mt-auto">
            <div className="text-xs text-white/40 mb-1">备忘</div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onBlur={saveNote}
              placeholder="写点什么..."
              className="w-full bg-white/10 text-white text-sm rounded-lg p-3 resize-none h-28 placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
            />
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="text-base font-semibold text-gray-800">日程安排</div>
            <button
              onClick={() => setShowAddEvent(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-colors"
            >
              + 添加日程
            </button>
          </div>

          {/* Add Event Form */}
          {showAddEvent && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="time" value={newEvent.time}
                  onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                  className="text-sm border rounded px-2 py-1 w-24"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="time" value={newEvent.endTime}
                  onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  className="text-sm border rounded px-2 py-1 w-24"
                />
                <input
                  type="text" value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="日程标题"
                  className="text-sm border rounded px-3 py-1 flex-1"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text" value={newEvent.desc}
                  onChange={e => setNewEvent({ ...newEvent, desc: e.target.value })}
                  placeholder="描述（可选）"
                  className="text-sm border rounded px-3 py-1 flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') addEvent(); }}
                />
                <button onClick={addEvent} className="bg-blue-500 text-white text-sm px-3 py-1 rounded">确认</button>
                <button onClick={() => setShowAddEvent(false)} className="text-gray-400 text-sm px-2">取消</button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-6 py-2">
            {hours.map(h => {
              const hourEvents = getEventsForHour(h);
              return (
                <div key={h} className="flex group hover:bg-gray-50/50 rounded">
                  <div className="w-14 flex-shrink-0 text-right text-xs text-gray-400 py-3 pr-3 border-r border-gray-100">
                    {String(h).padStart(2, '0')}:00
                  </div>
                  <div className="flex-1 py-2 pl-3 min-h-[44px] relative">
                    {hourEvents.map(evt => (
                      <div
                        key={evt.id}
                        className="rounded-lg px-3 py-2 mb-1 flex items-center justify-between"
                        style={{ backgroundColor: evt.color + '18', borderLeft: `3px solid ${evt.color}` }}
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-800">{evt.title}</div>
                          <div className="text-xs text-gray-500">
                            {evt.time} - {evt.endTime}
                            {evt.desc && <span className="ml-2 text-gray-400">{evt.desc}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => removeEvent(evt.id)}
                          className="text-gray-300 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
