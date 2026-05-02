'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { getLunarInfo, getYearAnimal, getGanZhiYear } from '@/lib/lunar';
import DayView from '@/components/day-view';
import MonthlyReview from '@/components/monthly-review';
import LifeCalendar from '@/components/life-calendar';
import {
  precomputeYearData,
  getTwelveWeekBlocks,
  isDatePast,
  isToday,
  MONTH_COLORS,
  MONTH_NAMES,
  getDaysInMonth,
  getDayOfWeek,
  isWeekend,
  type CellData,
} from '@/lib/calendar-utils';

type DayOverride = 'checked' | 'crossed';
type DayOverrides = Record<string, DayOverride>;
type DayNotes = Record<string, string>;

interface NotePopup {
  month: number;
  day: number;
  x: number;
  y: number;
}


export default function YearCalendar() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [overrides, setOverrides] = useState<DayOverrides>({});
  const [notes, setNotes] = useState<DayNotes>({});
  const [mounted, setMounted] = useState(false);
  const [todayStr, setTodayStr] = useState('');
  const [notePopup, setNotePopup] = useState<NotePopup | null>(null);
  const [popupSize, setPopupSize] = useState({ w: 400, h: 320 });
  const [noteDraft, setNoteDraft] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [dayViewDate, setDayViewDate] = useState<{ year: number; month: number; day: number } | null>(null);
  const [clockStr, setClockStr] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridInnerRef = useRef<HTMLDivElement>(null);
  const [cellHeight, setCellHeight] = useState(66);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isSnapping = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const [dayViewWidth, setDayViewWidth] = useState(480);
  const [reviewWidth, setReviewWidth] = useState(440);
  const [showLifeCalendar, setShowLifeCalendar] = useState(false);
  const [birthYear, setBirthYear] = useState(1990);

  // Resize handler for side panels
  const handlePanelResize = useCallback((setter: React.Dispatch<React.SetStateAction<number>>, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = 0; // will be read from current state via closure
    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX; // dragging left = increasing width
      setter(w => Math.min(Math.max(w + delta, 360), window.innerWidth * 0.92));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Real-time clock with centiseconds (2-digit)
  useEffect(() => {
    if (!mounted) return;
    const pad2 = (n: number) => (n < 10 ? '0' : '') + n;
    const tick = () => {
      const d = new Date();
      const cs = Math.floor(d.getMilliseconds() / 10);
      setClockStr(`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad2(cs)}`);
    };
    tick();
    const id = setInterval(tick, 53);
    return () => clearInterval(id);
  }, [mounted]);

  const blocks = useMemo(() => getTwelveWeekBlocks(year), [year]);

  const yearData = useMemo(
    () => precomputeYearData(year, blocks, getLunarInfo),
    [year, blocks],
  );

  // Calculate cell height to fill viewport
  useEffect(() => {
    const calculateHeight = () => {
      if (!gridContainerRef.current) return;
      const containerHeight = gridContainerRef.current.clientHeight;
      const gapsH = 11 * 2;
      const available = containerHeight - gapsH;
      const h = Math.max(24, Math.floor(available / 12));
      setCellHeight(h);
    };
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, [mounted]);

  // Load data from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const now = new Date();
    setTodayStr(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    );
    try {
      const savedOverrides = localStorage.getItem(`calendar-overrides-${year}`);
      if (savedOverrides) setOverrides(JSON.parse(savedOverrides));
      else setOverrides({});

      const savedNotes = localStorage.getItem(`calendar-notes-${year}`);
      if (savedNotes) setNotes(JSON.parse(savedNotes));
      else setNotes({});
    } catch {
      setOverrides({});
      setNotes({});
    }
  }, [year]);

  // Save overrides to localStorage
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(
        `calendar-overrides-${year}`,
        JSON.stringify(overrides),
      );
    } catch {
      // Ignore
    }
  }, [overrides, year, mounted]);

  // Save notes to localStorage
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(`calendar-notes-${year}`, JSON.stringify(notes));
    } catch {
      // Ignore
    }
  }, [notes, year, mounted]);

  const saveNote = useCallback(() => {
    if (!notePopup) return;
    const key = `${year}-${notePopup.month}-${notePopup.day}`;
    setNotes((prev) => {
      const next = { ...prev };
      if (noteDraft.trim()) {
        next[key] = noteDraft.trim();
      } else {
        delete next[key];
      }
      return next;
    });
    setNotePopup(null);
    setNoteDraft('');
  }, [notePopup, noteDraft, year]);

  // Close popup on outside click
  useEffect(() => {
    if (!notePopup) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        saveNote();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') saveNote();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notePopup, saveNote]);

  // Custom scroll snap with controlled animation speed
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isSnapping.current) return;
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        const scrollTop = container.scrollTop;
        const pageHeight = container.clientHeight;
        const currentPage = Math.round(scrollTop / pageHeight);
        const targetScroll = currentPage * pageHeight;
        if (Math.abs(scrollTop - targetScroll) > 5) {
          isSnapping.current = true;
          const startY = scrollTop;
          const diff = targetScroll - startY;
          const duration = 600; // ms - slow animation
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            container.scrollTop = startY + diff * eased;
            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              isSnapping.current = false;
            }
          };
          requestAnimationFrame(animate);
        }
      }, 150); // wait 150ms after scroll stops
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  const getDayStatus = useCallback(
    (month: number, day: number): 'checked' | 'crossed' | 'auto' | 'none' => {
      const key = `${year}-${month}-${day}`;
      if (overrides[key]) return overrides[key];
      if (isDatePast(year, month, day) || isToday(year, month, day))
        return 'auto';
      return 'none';
    },
    [year, overrides],
  );

  const toggleDay = useCallback(
    (month: number, day: number) => {
      const key = `${year}-${month}-${day}`;
      const current = overrides[key];

      if (!current) {
        setOverrides((prev) => ({ ...prev, [key]: 'crossed' }));
      } else if (current === 'crossed') {
        setOverrides((prev) => ({ ...prev, [key]: 'checked' }));
      } else {
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [year, overrides],
  );

  // Calculate completion stats
  const stats = useMemo(() => {
    if (!mounted) return { checked: 0, crossed: 0, total: 0, rate: 0 };
    let checked = 0;
    let crossed = 0;
    let total = 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 31; d++) {
        const date = new Date(year, m - 1, d);
        date.setHours(0, 0, 0, 0);
        if (date > now) break;
        if (year < now.getFullYear() || (year === now.getFullYear() && (m - 1 < now.getMonth() || (m - 1 === now.getMonth() && d <= now.getDate())))) {
          total++;
          const status = getDayStatus(m, d);
          if (status === 'checked' || status === 'auto') checked++;
          if (status === 'crossed') crossed++;
        }
      }
    }

    const rate = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { checked, crossed, total, rate };
  }, [year, mounted, getDayStatus]);

  const animal = getYearAnimal(year);
  const ganZhi = getGanZhiYear(year);

  const colTemplate = `52px repeat(31, minmax(28px, 1fr))`;

  // Build SVG wave border paths for quarter blocks
  // Simplified approach: draw a wavy rectangle around each quarter
  // Calculate 12-week block start/end days for star markers
  const blockMarkerDays = useMemo(() => {
    if (!blocks || blocks.length === 0) return new Map<string, 'start' | 'end' | 'both'>();
    const markers = new Map<string, 'start' | 'end' | 'both'>();
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const start = block.startDate;
      const end = block.endDate;
      const startKey = `${start.getMonth() + 1}-${start.getDate()}`;
      const endKey = `${end.getMonth() + 1}-${end.getDate()}`;
      const existingStart = markers.get(startKey);
      const existingEnd = markers.get(endKey);
      if (startKey === endKey) {
        markers.set(startKey, 'both');
      } else {
        markers.set(startKey, existingStart === 'end' || existingStart === 'both' ? 'both' : 'start');
        markers.set(endKey, existingEnd === 'start' || existingEnd === 'both' ? 'both' : 'end');
      }
    }
    return markers;
  }, [blocks]);



  return (
    <div ref={scrollContainerRef} className="h-screen overflow-y-scroll" style={{ scrollbarWidth: 'none' }}>
      {/* Page 1: Calendar */}
      <div className="h-screen bg-gradient-to-br from-slate-50/80 via-gray-50 to-stone-100/80 print:bg-white print:h-auto flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 print:static print:border-b z-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/header-bg.jpeg')" }} />
        <div className="absolute inset-0 glass-dark" />
        <div className="relative px-8 py-1.5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 rounded-2xl px-4 py-2">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors text-2xl font-bold text-white/70 hover:text-white"
              aria-label="上一年"
            >
              ‹
            </button>
            <div className="flex items-center">
              <h1 className="text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 leading-none">
                {year}
              </h1>
              <div className="flex flex-col ml-4">
                <div className="flex items-center gap-2 leading-tight">
                  <span className="text-lg text-white/60 font-medium">
                    {ganZhi}（{animal}）
                  </span>
                  <button
                    onClick={() => setYear(new Date().getFullYear())}
                    className="px-2.5 py-0.5 text-sm rounded-md bg-white/15 text-white/90 hover:bg-white/25 border border-white/10 transition-colors leading-tight"
                  >
                    今年
                  </button>
                </div>
                {mounted && clockStr && (
                  <div className="text-2xl text-amber-200/40 font-mono tracking-wider tabular-nums leading-tight mt-0.5">
                    {clockStr}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors text-lg font-bold text-white/70 hover:text-white"
              aria-label="下一年"
            >
              ›
            </button>
          </div>

          {/* 居中标语 */}
          <div className="absolute inset-x-0 flex justify-center pointer-events-none">
            <span className="text-4xl font-bold tracking-[0.5em] text-transparent bg-clip-text bg-gradient-to-r from-amber-300/80 via-yellow-200 to-amber-300/80 select-none drop-shadow-[0_0_30px_rgba(217,170,80,0.3)]" style={{ fontFamily: '"STKaiti", "KaiTi", "楷体", serif' }}>
              永远不要放弃
            </span>
          </div>

          {/* Legend & Stats */}
          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex items-center gap-3 text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-flex w-[23px] h-[23px] bg-emerald-500/20 rounded-md items-center justify-center text-emerald-400 text-[17px] font-bold">
                  ✓
                </span>
                <span>满意</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex w-[23px] h-[23px] bg-rose-500/20 rounded-md items-center justify-center text-rose-400 text-[17px] font-bold">
                  ✗
                </span>
                <span>不满意</span>
              </span>
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-emerald-500">
                  <path d="M3 3.5A1.5 1.5 0 014.5 2h7A1.5 1.5 0 0113 3.5v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 12.5v-9zM4.5 3a.5.5 0 00-.5.5v9a.5.5 0 00.5.5h7a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5h-7z"/>
                  <path d="M6 7.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5z"/>
                </svg>
                <span>备注</span>
              </span>
            </div>
            {mounted && stats.total > 0 && (
              <div className="flex items-center gap-2 pl-3 ml-1 border-l border-gray-200">
                <span className="text-white/50">已过 <strong className="text-white/80 font-semibold">{stats.total}</strong> 天</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 rounded-md text-emerald-700 font-semibold">
                  ✓{stats.checked}
                </span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-50 rounded-md text-rose-600 font-semibold">
                  ✗{stats.crossed}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 bg-gray-900 text-white rounded-md font-bold text-xs">
                  {stats.rate}%
                </span>
              </div>
            )}
          </div>
        </div>
      </header>


      {/* Calendar Grid - fills remaining viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left arrow for Life Calendar */}
        <button
          onClick={() => setShowLifeCalendar(true)}
          className="flex-shrink-0 w-8 flex items-center justify-center bg-gradient-to-r from-indigo-50/80 to-transparent hover:from-indigo-100 transition-all group cursor-pointer z-10"
          title="4000周人生"
        >
          <span className="text-indigo-300 group-hover:text-indigo-500 transition-colors text-2xl">‹</span>
        </button>

        <div
          ref={gridContainerRef}
          className="flex-1 px-8 pb-2 pt-1 overflow-x-auto min-h-0 flex justify-center"
        >
        <div ref={gridInnerRef} className="h-full relative border-t border-l border-gray-100 rounded-lg" style={{ minWidth: '1100px' }}>


          {/* Month rows */}
          {yearData.map((monthRow, monthIdx) => {
            const monthColor = MONTH_COLORS[monthIdx];
            return (
              <div
                key={monthIdx}
                data-month-row={monthIdx}
                className="grid gap-0"
                style={{
                  gridTemplateColumns: colTemplate,
                  marginBottom: monthIdx < 11 ? 2 : 0,
                }}
              >
                {/* Month label */}
                <div
                  className="flex items-center justify-center text-[17px] font-extrabold sticky left-0 z-10 rounded-xl mx-0.5 cursor-pointer hover:scale-110 transition-all duration-300 shadow-sm hover:shadow-lg backdrop-blur-md"
                  style={{
                    height: cellHeight,
                    color: monthColor.text,
                    border: `1px solid ${monthColor.text}20`,
                    backgroundColor: `${monthColor.bg}60`,
                  }}
                  onClick={() => setSelectedMonth(monthIdx + 1)}
                  title={`点击查看${monthIdx + 1}月详细视图`}
                >
                  {MONTH_NAMES[monthIdx]}
                </div>

                {/* Day cells - no CSS block borders, SVG overlay handles that */}
                {monthRow.map((cell: CellData) => {
                  if (!cell.exists) {
                    return (
                      <div
                        key={cell.day}
                        data-day={cell.day}
                        className="bg-gray-50/30"
                        style={{ height: cellHeight }}
                      />
                    );
                  }

                  const status = mounted ? getDayStatus(cell.month, cell.day) : 'none';
                  const isTodayCell =
                    mounted &&
                    todayStr === `${year}-${String(cell.month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                  const weekendBg = cell.isWeekend ? monthColor.bg : undefined;
                  const noteKey = `${year}-${cell.month}-${cell.day}`;
                  const hasNote = mounted && notes[noteKey];
                  const hasDayViewData = mounted && (() => {
                    try {
                      const evts = localStorage.getItem(`dayview-events-${year}-${cell.month}-${cell.day}`);
                      const todos = localStorage.getItem(`dayview-todos-${year}-${cell.month}-${cell.day}`);
                      const hasEvts = evts && JSON.parse(evts).length > 0;
                      const hasTodos = todos && JSON.parse(todos).length > 0;
                      return hasEvts || hasTodos;
                    } catch { return false; }
                  })();
                  // Also check day-view memo text stored in calendar-notes-${year}
                  const hasDayViewMemo = mounted && (() => {
                    try {
                      const raw = localStorage.getItem(`calendar-notes-${year}`);
                      if (!raw) return false;
                      const parsed = JSON.parse(raw);
                      const memoKey = `${year}-${cell.month}-${cell.day}`;
                      return !!parsed[memoKey] && parsed[memoKey].trim().length > 0;
                    } catch { return false; }
                  })();
                  const hasAnyNote = hasNote || hasDayViewData || hasDayViewMemo;
                  const cellDateStr = `${year}-${String(cell.month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                  const isPast = mounted && (() => {
                    if (!todayStr) return false;
                    const cellYear = parseInt(cellDateStr.slice(0, 4));
                    const todayYear = parseInt(todayStr.slice(0, 4));
                    if (cellYear < todayYear) return true;
                    if (cellYear > todayYear) return false;
                    return cellDateStr < todayStr;
                  })();

                  return (
                    <div
                      key={cell.day}
                      data-day={cell.day}
                      className={`
                        relative rounded-md overflow-hidden
                        ${isTodayCell ? 'ring-2 ring-indigo-400/80 ring-inset z-[5] shadow-[0_0_12px_rgba(99,102,241,0.25)]' : ''}
                        ${!cell.isWeekend ? 'bg-white/90' : ''}
                      `}
                      style={{
                        height: cellHeight,
                        borderBottom: '1px solid rgba(148,163,184,0.12)',
                        borderRight: '1px solid rgba(148,163,184,0.12)',
                        backgroundColor: isPast ? 'rgba(250,250,252,0.55)' : weekendBg,
                        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                      }}
                    >
                      {/* Top zone (1/3): day+lunar+check, click to toggle ✓/✗ */}
                      <div
                        className="flex flex-col items-start pl-1.5 pt-1 cursor-pointer hover:bg-indigo-100/40 active:bg-indigo-200/40 transition-colors rounded-t-md"
                        style={{ height: '33%' }}
                        onClick={() => toggleDay(cell.month, cell.day)}
                        title="切换满意/不满意"
                      >
                        <span
                          className={`text-[15px] font-bold leading-none ${
                            isPast
                              ? ''
                              : cell.isWeekend ? '' : 'text-gray-800'
                          }`}
                          style={
                            isPast
                              ? { color: '#e0e0e0' }
                              : cell.isWeekend
                                ? { color: monthColor.text }
                                : undefined
                          }
                        >
                          {cell.day}
                        </span>
                        <span
                          className={`text-[9px] leading-tight mt-0.5 whitespace-nowrap ${
                            isPast
                              ? ''
                              : cell.isSolarTerm
                                ? 'text-orange-600 font-medium'
                                : cell.isFestival
                                  ? 'text-red-500 font-medium'
                                  : cell.isLunarFirstDay
                                    ? 'text-purple-600 font-medium'
                                    : cell.isWeekend
                                      ? ''
                                      : 'text-white/50'
                          }`}
                          style={
                            isPast
                              ? { color: '#e5e5e5' }
                              : cell.isWeekend &&
                                !cell.isSolarTerm &&
                                !cell.isFestival &&
                                !cell.isLunarFirstDay
                                  ? { color: monthColor.accent }
                                  : undefined
                          }
                        >
                          {cell.lunarDisplay}
                        </span>
                      </div>
                      {/* Centered check/cross watermark overlay */}
                      {mounted && status !== 'none' && (
                        <span
                          className={`absolute inset-0 flex items-center justify-center text-[22px] font-bold leading-none pointer-events-none ${
                            status === 'crossed'
                              ? 'text-red-400/40'
                              : 'text-green-500/40'
                          }`}
                        >
                          {status === 'crossed' ? '✗' : '✓'}
                        </span>
                      )}
                      {/* Bottom zone (2/3): click to open day view */}
                      <div
                        className="cursor-pointer hover:bg-gradient-to-b hover:from-indigo-50/20 hover:to-violet-50/30 transition-all duration-200 rounded-b-sm"
                        style={{ height: '67%' }}
                        onClick={() => setDayViewDate({ year, month: cell.month, day: cell.day })}
                      />
                      {/* Blue dot indicator at top-right of entire cell */}
                      {hasAnyNote && (
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}


        </div>
        </div>
        </div>{/* end gridContainerRef + flex container */}

      {/* Note Popup - TickTick inspired */}
      {notePopup && mounted && (
        <div
          ref={popupRef}
          className="fixed z-50 rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col"
          style={{
            left: notePopup.x,
            top: notePopup.y,
            width: popupSize.w,
            height: popupSize.h,
            minWidth: 280,
            minHeight: 200,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          {/* Header */}
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-white text-2xl font-bold">{notePopup.day}日</span>
                <span className="text-white/80 text-xs">{year}年{notePopup.month}月</span>
              </div>
              <button
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white/70 hover:text-white transition-colors"
                onClick={() => {
                  setNotePopup(null);
                  setNoteDraft('');
                }}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="bg-white px-5 pb-4 pt-3 flex-1 flex flex-col min-h-0 overflow-auto">
            {notes[`${year}-${notePopup.month}-${notePopup.day}`] && !noteDraft ? (
              <div className="mb-3">
                <div className="text-[15px] text-white/50 font-medium mb-1.5 tracking-wide">已记录</div>
                <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                  {notes[`${year}-${notePopup.month}-${notePopup.day}`]}
                </div>
              </div>
            ) : null}
            <textarea
              className="w-full flex-1 min-h-[80px] text-sm border-0 border-b border-gray-100 p-0 pb-3 resize-none focus:outline-none focus:border-indigo-300 leading-relaxed text-gray-800 placeholder:text-gray-300"
              placeholder="记录今日事项与行程..."
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  saveNote();
                }
              }}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[15px] text-gray-300">Enter 保存 · Shift+Enter 换行</span>
              <button
                className="px-5 py-1.5 rounded-full text-xs font-semibold text-white transition-all hover:shadow-md active:scale-95"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                onClick={saveNote}
              >
                保存
              </button>
            </div>
          </div>
          {/* Resize handle */}
          <div
            className="absolute right-1 bottom-1 w-4 h-4 cursor-se-resize flex items-end justify-end"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const startX = e.clientX;
              const startY = e.clientY;
              const startW = popupSize.w;
              const startH = popupSize.h;
              const onMove = (me: MouseEvent) => {
                setPopupSize({
                  w: Math.max(280, startW + me.clientX - startX),
                  h: Math.max(200, startH + me.clientY - startY),
                });
              };
              const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-white/40">
              <path d="M9 1L1 9M9 4L4 9M9 7L7 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}
      {dayViewDate && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setDayViewDate(null)} />
          <div className="relative h-full bg-white/95 backdrop-blur-xl shadow-2xl border-l border-white/30 animate-slide-in-panel overflow-hidden flex" style={{ width: dayViewWidth, maxWidth: '92vw' }}>
            {/* Left resize handle */}
            <div
              className="w-1.5 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-400/50 flex-shrink-0 transition-colors z-10"
              onMouseDown={(e) => handlePanelResize(setDayViewWidth, e)}
            />
            <div className="flex-1 overflow-hidden">
              <DayView
                year={dayViewDate.year}
                month={dayViewDate.month}
                day={dayViewDate.day}
                onClose={() => setDayViewDate(null)}
                embedded
              />
            </div>
          </div>
        </div>
      )}

      {/* 月度复盘侧边栏 - TickTick风格 */}
      {selectedMonth !== null && mounted && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelectedMonth(null)} />
          <div className="relative h-full bg-white/95 backdrop-blur-xl shadow-2xl border-l border-white/30 flex flex-col animate-slide-in" style={{ width: reviewWidth, maxWidth: '92vw' }}>
            {/* Left resize handle */}
            <div
              className="w-1.5 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-400/50 flex-shrink-0 transition-colors z-10 absolute left-0 top-0 bottom-0"
              onMouseDown={(e) => handlePanelResize(setReviewWidth, e)}
            />
            {/* 头部 - 渐变 */}
            <div className="px-6 pt-6 pb-5" style={{ background: `linear-gradient(135deg, ${MONTH_COLORS[selectedMonth - 1].accent}dd, ${MONTH_COLORS[selectedMonth - 1].accent}88)` }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white/60 text-xs font-medium tracking-wider mb-1">MONTHLY REVIEW</div>
                  <div className="text-white text-xl font-bold">{selectedMonth}月复盘</div>
                  <div className="text-white/50 text-xs mt-0.5">{year}年{selectedMonth}月</div>
                </div>
                <button onClick={() => setSelectedMonth(null)} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              {/* 迷你统计条 */}
              {(() => {
                const daysInMonth = new Date(year, selectedMonth, 0).getDate();
                const today = new Date();
                const isCurrentYear = year === today.getFullYear();
                const isCurrentMonth = isCurrentYear && selectedMonth === today.getMonth() + 1;
                const effectiveDays = isCurrentMonth ? today.getDate() : daysInMonth;
                const storageKey = `calendar-overrides-${year}`;
                let overrides: Record<string, string> = {};
                try { overrides = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { /* empty */ }
                let satisfied = 0;
                let crossed = 0;
                for (let d = 1; d <= effectiveDays; d++) {
                  const key = `${year}-${selectedMonth}-${d}`;
                  const status = overrides[key];
                  if (status === 'crossed') crossed++;
                  else satisfied++;
                }
                const rate = effectiveDays > 0 ? Math.round((satisfied / effectiveDays) * 100) : 0;
                return (
                  <div className="mt-4 space-y-2.5">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/90 text-sm">✓</span>
                        <span className="text-white/80 text-xs font-medium">{satisfied}天满意</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/90 text-sm">✗</span>
                        <span className="text-white/80 text-xs font-medium">{crossed}天不满意</span>
                      </div>
                      <div className="flex-1" />
                      <span className="text-white/60 text-xs">{effectiveDays}天</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                        <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-white/80 text-xs font-semibold">{rate}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 复盘内容 - 现代卡片 */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {([
                { key: 'goals', label: '本月目标', icon: '🎯', color: '#8b5cf6', placeholder: '这个月想要达成什么？' },
                { key: 'done', label: '完成情况', icon: '✅', color: '#22c55e', placeholder: '实际完成了哪些？' },
                { key: 'reflect', label: '反思改进', icon: '💡', color: '#f59e0b', placeholder: '有什么可以改进？' },
                { key: 'plan', label: '下月计划', icon: '🚀', color: '#3b82f6', placeholder: '下个月有什么计划？' },
              ] as const).map((section) => {
                const storageKey = `month-review-${section.key}-${year}-${selectedMonth}`;
                const savedValue = (() => { try { return localStorage.getItem(storageKey) || ''; } catch { return ''; } })();
                return (
                  <div key={section.key} className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs" style={{ backgroundColor: section.color + '15', color: section.color }}>
                        {section.icon}
                      </span>
                      <span className="text-sm font-semibold text-white/80">{section.label}</span>
                    </div>
                    <textarea
                      className="w-full bg-gray-50/60 rounded-2xl px-5 py-4 text-sm text-white/80 resize-none focus:outline-none focus:bg-gray-50 transition-all placeholder:text-gray-300 leading-relaxed min-h-[160px]"
                      placeholder={section.placeholder}
                      defaultValue={savedValue}
                      onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => { try { localStorage.setItem(storageKey, e.target.value); } catch { /* empty */ } }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 人生日历侧边栏 */}
      {showLifeCalendar && (
        <LifeCalendar
          birthYear={birthYear}
          setBirthYear={setBirthYear}
          onClose={() => setShowLifeCalendar(false)}
        />
      )}
      </div>

      {/* Page 2: Monthly Review */}
      <section className="h-screen overflow-y-auto">
        <MonthlyReview year={year} />
      </section>
    </div>
  );
}
