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
import { SKINS, DEFAULT_SKIN, generateMonthColors } from '@/lib/skins';

import {
  precomputeYearData,
  getTwelveWeekBlocks,
  isDatePast,
  isToday,
  MONTH_NAMES,
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
  const [skinKey, setSkinKey] = useState<string>(DEFAULT_SKIN);
  const [showSkinPicker, setShowSkinPicker] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [motto, setMotto] = useState('永远不要放弃');
  const [editingMotto, setEditingMotto] = useState(false);
  const [mottoDraft, setMottoDraft] = useState('');
  const [mottoSize, setMottoSize] = useState(20);

  // Resize handler for side panels
  const handlePanelResize = useCallback((setter: React.Dispatch<React.SetStateAction<number>>, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
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
  const skin = useMemo(() => SKINS.find(s => s.key === skinKey) ?? SKINS[0], [skinKey]);
  const skinMonthColors = useMemo(() => generateMonthColors(skin), [skin]);

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

      // Load skin preference
      const savedSkin = localStorage.getItem('life-calendar-skin');
      if (savedSkin && SKINS.find(s => s.key === savedSkin)) setSkinKey(savedSkin);

      // Load motto & size
      const savedMotto = localStorage.getItem('calendar-motto');
      if (savedMotto) setMotto(savedMotto);
      const savedSize = localStorage.getItem('calendar-motto-size');
      if (savedSize) setMottoSize(parseInt(savedSize, 10));
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
      // Track page for back-to-top button
      const currentScroll = container.scrollTop;
      const pageH = container.clientHeight;
      const page = Math.round(currentScroll / pageH);
      setShowBackToTop(page > 0);

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

  const colTemplate = `64px repeat(31, minmax(28px, 1fr))`;

  // Build SVG wave border paths for quarter blocks



  return (
    <div ref={scrollContainerRef} className="h-screen overflow-y-scroll" style={{ scrollbarWidth: 'none' }}>
      {/* Page 1: Calendar */}
      <div className="h-screen print:bg-white print:h-auto flex flex-col overflow-hidden relative"
      style={{ backgroundColor: skin.bodyBg }}>
      {/* Header */}
      <header className="flex-shrink-0 print:static print:border-b z-20 relative overflow-hidden" style={mounted ? { backgroundColor: skin.bodyBg } : undefined}>
        {mounted && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
        {mounted && <div className="absolute inset-0" style={{ background: skin.headerBgOverlay }} />}
        {mounted && <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.12) 50%, rgba(0,0,0,0.03) 100%)" }} />}


        <div className="relative z-10 px-8 py-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 px-5 py-2.5">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="w-12 h-12 flex items-center justify-center rounded-lg transition-colors text-2xl font-bold"
              style={mounted ? { color: skin.textMuted } : undefined}
              onMouseEnter={mounted ? (e => { e.currentTarget.style.color = skin.swatch; e.currentTarget.style.backgroundColor = skin.cardHover; }) : undefined}
              onMouseLeave={mounted ? (e => { e.currentTarget.style.color = skin.textMuted; e.currentTarget.style.backgroundColor = 'transparent'; }) : undefined}
              aria-label="上一年"
            >
              ‹
            </button>
            <div className="flex items-center">
              <h1 className="text-7xl font-black tracking-tighter leading-none"
              style={mounted ? { color: skin.textPrimary, textShadow: `0 1px 2px ${skin.swatch}15` } : undefined}>
                {year}
              </h1>
              <div className="flex flex-col ml-4">
                <div className="flex items-center gap-2 leading-tight">
                  <span className="text-lg font-medium"
                    style={mounted ? { color: skin.textSecondary } : undefined}>
                    {ganZhi}（{animal}）
                  </span>
                  <button
                    onClick={() => setYear(new Date().getFullYear())}
                    className="px-3 py-1 text-xs font-medium rounded-full transition-all leading-tight cursor-pointer hover:opacity-80"
                    style={mounted ? { color: skin.textPrimary, backgroundColor: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.15)" } : undefined}
                  >
                    今年
                  </button>
                  {/* Skin picker toggle */}
                  <button
                    onClick={() => setShowSkinPicker(v => !v)}
                    className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90"
                    style={mounted ? {
                      backgroundColor: skin.swatch,
                      border: '2px solid rgba(255,255,255,0.5)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    } : undefined}
                    onMouseEnter={mounted ? (e => {
                      e.currentTarget.style.transform = 'scale(1.15)';
                      e.currentTarget.style.boxShadow = `0 2px 12px ${skin.swatch}60`;
                    }) : undefined}
                    onMouseLeave={mounted ? (e => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
                    }) : undefined}
                    title="切换皮肤"
                  />
                </div>
                {mounted && clockStr && (
                  <div className="text-xl font-mono tracking-wider tabular-nums leading-tight mt-1"
                    style={{ color: skin.textPrimary, opacity: 0.6 }}>
                    {clockStr}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-lg font-bold"
              style={{ color: skin.textMuted }}
              onMouseEnter={e => { e.currentTarget.style.color = skin.swatch; e.currentTarget.style.backgroundColor = skin.cardHover; }}
              onMouseLeave={e => { e.currentTarget.style.color = skin.textMuted; e.currentTarget.style.backgroundColor = 'transparent'; }}
              aria-label="下一年"
            >
              ›
            </button>
          </div>

          {/* 居中标语 */}
          <div className="absolute inset-x-0 flex justify-center">
            <span
              className="font-light select-none cursor-pointer hover:opacity-70 transition-opacity"
              style={mounted ? { color: skin.textMuted, fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif', letterSpacing: '0.6em', fontSize: `${mottoSize}px` } : undefined}
              onClick={() => { setMottoDraft(motto); setEditingMotto(true); }}
              title="点击修改标语"
            >
              {mounted ? motto : ''}
            </span>
          </div>

          {/* Legend & Stats */}
          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex items-center gap-3 text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-flex w-[23px] h-[23px] rounded-md items-center justify-center text-[17px] font-bold"
                style={{ backgroundColor: skin.checkColor + "10", color: skin.checkColor }}>
                  ✓
                </span>
                <span>满意</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex w-[23px] h-[23px] rounded-md items-center justify-center text-[17px] font-bold"
                style={{ backgroundColor: skin.crossColor + "10", color: skin.crossColor }}>
                  ✗
                </span>
                <span>不满意</span>
              </span>
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"
                  style={{ color: skin.swatch }}>
                  <path d="M3 3.5A1.5 1.5 0 014.5 2h7A1.5 1.5 0 0113 3.5v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 12.5v-9zM4.5 3a.5.5 0 00-.5.5v9a.5.5 0 00.5.5h7a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5h-7z"/>
                  <path d="M6 7.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5z"/>
                </svg>
                <span>备注</span>
              </span>
            </div>
            {mounted && stats.total > 0 && (
              <div className="flex items-center gap-2 pl-3 ml-1 border-l border-gray-200">
                <span className="text-gray-400">已过 <strong className="text-gray-700 font-semibold">{stats.total}</strong> 天</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold"
                    style={{ backgroundColor: skin.checkColor + "10", color: skin.checkColor }}>
                  ✓{stats.checked}
                </span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold"
                    style={{ backgroundColor: skin.crossColor + "10", color: skin.crossColor }}>
                  ✗{stats.crossed}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs text-white"
                    style={{ backgroundColor: skin.swatch }}>
                  {stats.rate}%
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Skin Picker Dropdown - fixed to avoid overflow-hidden clipping */}
      {showSkinPicker && (
        <div className="fixed inset-0 z-[100] animate-fade-in" onClick={() => setShowSkinPicker(false)}>
          <div className="mx-auto max-w-3xl px-6 pt-2 pb-4" onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}>
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: skin.panelBg + 'f5', backdropFilter: 'blur(24px)', border: `1px solid ${skin.divider}` }}>
              <div className="px-4 pt-3 pb-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${skin.divider}` }}>
                <h3 className="text-sm font-semibold tracking-wide" style={{ color: skin.textSecondary }}>选择皮肤</h3>
                <button onClick={() => setShowSkinPicker(false)} className="w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer text-sm" style={{ color: skin.textMuted, backgroundColor: skin.divider + '60' }}>&times;</button>
              </div>
              <div className="grid grid-cols-4 gap-3 p-4">
                {SKINS.map(s => {
                  const isActive = skinKey === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => { setSkinKey(s.key); setShowSkinPicker(false); }}
                      className="relative rounded-xl overflow-hidden transition-all cursor-pointer group"
                      style={{
                        border: isActive ? `2px solid ${s.swatch}` : `1px solid ${s.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
                        boxShadow: isActive ? `0 4px 16px ${s.swatch}30` : 'none',
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = s.swatch + '50'; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = s.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'; } }}
                    >
                      {/* Preview image from headerBgImage */}
                      <div className="h-20 bg-cover bg-center relative" style={{ backgroundImage: `url(${s.headerBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                        <div className="absolute inset-0" style={{ background: s.headerBgOverlay }} />
                        {isActive && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: s.swatch }}>
                            ✓
                          </div>
                        )}
                      </div>
                      {/* Label with subtle top border for dark skins */}
                      <div className="px-2 py-1.5 text-center" style={{ backgroundColor: s.isDark ? 'rgba(240,240,245,0.95)' : s.panelBg, borderTop: s.isDark ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                        <span className="text-xs font-semibold" style={{ color: s.isDark ? '#1a1a2e' : s.textPrimary }}>{s.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Calendar Grid - fills remaining viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left arrow for Life Calendar */}
        <button
          onClick={() => setShowLifeCalendar(true)}
          className="flex-shrink-0 w-14 flex items-center justify-center transition-all group cursor-pointer z-10"
          style={{ background: `linear-gradient(to right, ${skin.swatch}18, transparent)` }}
          title="人生旅途"
        >
          <span className="transition-colors text-4xl font-bold tracking-tight group-hover:opacity-100 opacity-40 transition-opacity inline-block group-hover:translate-x-1 transform" style={{ color: `${skin.swatch}bb` }}>
            »
          </span>
        </button>

        <div
          ref={gridContainerRef}
          className="flex-1 px-8 pb-2 pt-1 overflow-x-auto min-h-0 flex justify-center"
        >
        <div ref={gridInnerRef} className="h-full relative rounded-lg"
          style={{ borderTop: `0.5px solid ${skin.cellBorder}`, borderLeft: `0.5px solid ${skin.cellBorder}`, minWidth: '1200px' }}>


          {/* Month rows */}
          {yearData.map((monthRow, monthIdx) => {
            const monthColor = skinMonthColors[monthIdx];
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
                        style={{ height: cellHeight, backgroundColor: skin.divider + "40" }}
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
                        ${isTodayCell ? 'ring-2 ring-inset z-[5]' : ''}
                      `}
                      style={{
                        height: cellHeight,
                        borderBottom: `0.5px solid ${skin.cellBorder}`,
                        borderRight: `0.5px solid ${skin.cellBorder}`,
                        backgroundColor: weekendBg,
                        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                        ...(isTodayCell ? { '--tw-ring-color': skin.todayRing + 'b3', boxShadow: `0 0 12px ${skin.todayRing}40` } as React.CSSProperties : {}),
                      }}
                    >
                      {/* Past overlay: covers inner area only, borders stay consistent */}
                      {isPast && (
                        <div
                          className="absolute inset-0 rounded-md pointer-events-none"
                          style={{ backgroundColor: cell.isWeekend ? skin.pastWeekendBg : skin.pastBg }}
                        />
                      )}
                      {/* Content wrapper above overlay */}
                      <div className="relative z-10 h-full flex flex-col">
                      {/* Top zone (1/3): day+lunar+check, click to toggle ✓/✗ */}
                      <div
                        className="flex flex-col items-start pl-1.5 pt-1 cursor-pointer  transition-colors rounded-t-md"
                        style={{ height: '33%' }}
                        onClick={() => toggleDay(cell.month, cell.day)}
                        title="切换满意/不满意"
                      >
                        <span
                          className="text-[15px] font-bold leading-none"
                          style={{
                            color: isPast
                              ? skin.pastText
                              : cell.isWeekend
                                ? monthColor.text
                                : skin.textPrimary
                          }}
                        >
                          {cell.day}
                        </span>
                        <span
                          className="text-[9px] leading-tight mt-0.5 whitespace-nowrap font-medium"
                          style={{
                            color: isPast
                              ? skin.pastSubtext
                              : cell.isSolarTerm
                                ? skin.swatch
                                : cell.isFestival
                                  ? skin.crossColor
                                  : cell.isLunarFirstDay
                                    ? skin.tabActive
                                    : cell.isWeekend
                                      ? monthColor.accent
                                      : skin.textMuted
                          }}
                        >
                          {cell.lunarDisplay}
                        </span>
                      </div>
                      {/* Centered check/cross watermark overlay - above past overlay */}
                      {mounted && status !== 'none' && (
                        <span
                          className="absolute inset-0 flex items-center justify-center text-[22px] font-bold leading-none pointer-events-none z-20"
                          style={{ color: status === 'crossed' ? skin.crossColor : skin.checkColor }}
                        >
                          {status === 'crossed' ? '✗' : '✓'}
                        </span>
                      )}
                      {/* Bottom zone (2/3): click to open day view */}
                      <div
                        className="cursor-pointer  transition-all duration-200 rounded-b-sm"
                        style={{ height: '67%' }}
                        onClick={() => setDayViewDate({ year, month: cell.month, day: cell.day })}
                      />
                      {/* Blue dot indicator at top-right of entire cell */}
                      {hasAnyNote && (
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full z-20"
                      style={{ background: `linear-gradient(135deg, ${skin.blueDot}cc, ${skin.blueDot})`, boxShadow: `0 0 6px ${skin.blueDot}80` }} />
                      )}
                      </div>{/* end content wrapper */}
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
            background: `linear-gradient(135deg, ${skin.sidebarFrom}, ${skin.sidebarTo})`,
          }}
        >
          {/* Header */}
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-white text-2xl font-bold">{notePopup.day}日</span>
                <span className="text-xs" style={{ color: skin.textSecondary }}>{year}年{notePopup.month}月</span>
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
                <div className="text-[15px] font-medium mb-1.5 tracking-wide"
                style={{ color: skin.textMuted }}>已记录</div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: skin.textPrimary }}>
                  {notes[`${year}-${notePopup.month}-${notePopup.day}`]}
                </div>
              </div>
            ) : null}
            <textarea
              className="w-full flex-1 min-h-[80px] text-sm border-0 border-b border-gray-100 p-0 pb-3 resize-none focus:outline-none  leading-relaxed text-gray-800 placeholder:text-gray-300"
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
              <span className="text-[15px]"
              style={{ color: skin.textMuted }}>Enter 保存 · Shift+Enter 换行</span>
              <button
                className="px-5 py-1.5 rounded-full text-xs font-semibold text-white transition-all hover:shadow-md active:scale-95"
                style={{ background: `linear-gradient(135deg, ${skin.sidebarFrom}, ${skin.sidebarTo})` }}
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
          <div className="relative h-full backdrop-blur-xl shadow-2xl border-l animate-slide-in-panel overflow-hidden flex"
          style={{ width: dayViewWidth, maxWidth: '92vw', background: skin.panelBg + 'f2', borderColor: skin.divider }}>
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
                skin={skin}
              />
            </div>
          </div>
        </div>
      )}

      {/* 月度复盘侧边栏 - TickTick风格 */}
      {selectedMonth !== null && mounted && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelectedMonth(null)} />
          <div className="relative h-full backdrop-blur-xl shadow-2xl border-l flex flex-col animate-slide-in"
          style={{ width: reviewWidth, maxWidth: '92vw', background: skin.panelBg + 'f2', borderColor: skin.divider }}>
            {/* Left resize handle */}
            <div
              className="w-1.5 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-400/50 flex-shrink-0 transition-colors z-10 absolute left-0 top-0 bottom-0"
              onMouseDown={(e) => handlePanelResize(setReviewWidth, e)}
            />
            {/* 头部 - 背景图+渐变 */}
            <div className="px-6 pt-6 pb-5 relative overflow-hidden" style={{ backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: "cover", backgroundPosition: "center" }}>
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${skin.sidebarFrom}dd, ${skin.sidebarTo}cc)` }} />
              <div className="relative z-10 flex items-center justify-between">
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
                        <span className="text-gray-900 text-sm">✓</span>
                        <span className="text-gray-700 text-xs font-medium">{satisfied}天满意</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-900 text-sm">✗</span>
                        <span className="text-gray-700 text-xs font-medium">{crossed}天不满意</span>
                      </div>
                      <div className="flex-1" />
                      <span className="text-gray-500 text-xs">{effectiveDays}天</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                        <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-gray-700 text-xs font-semibold">{rate}%</span>
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
                      <span className="text-sm font-semibold text-gray-700">{section.label}</span>
                    </div>
                    <textarea
                      className="w-full bg-gray-50/60 rounded-2xl px-5 py-4 text-sm text-gray-700 resize-none focus:outline-none focus:bg-gray-50 transition-all placeholder:text-gray-300 leading-relaxed min-h-[160px]"
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
          skinKey={skinKey}
        />
      )}
      </div>

      {/* Page 2: Monthly Review */}
      <section className="h-screen overflow-y-auto">
        <MonthlyReview year={year} skin={skin} />
      </section>

      {/* Back to Top floating button */}
      {mounted && showBackToTop && (
        <button
          onClick={() => {
            const container = scrollContainerRef.current;
            if (container) {
              isSnapping.current = true;
              const startY = container.scrollTop;
              const duration = 600;
              const startTime = performance.now();
              const animate = (now: number) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                container.scrollTop = startY * (1 - eased);
                if (progress < 1) {
                  requestAnimationFrame(animate);
                } else {
                  isSnapping.current = false;
                  setShowBackToTop(false);
                }
              };
              requestAnimationFrame(animate);
            }
          }}
          className="fixed bottom-8 right-8 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 cursor-pointer z-50"
          style={{
            background: `linear-gradient(135deg, ${skin.swatch}, ${skin.swatch}cc)`,
            color: 'white',
            boxShadow: `0 4px 20px ${skin.swatch}40`,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6"/>
          </svg>
        </button>
      )}

      {/* Motto Edit Modal */}
      {mounted && editingMotto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[100]"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => setEditingMotto(false)}
        >
          <div
            className="rounded-2xl shadow-2xl p-8 w-[600px] max-w-[92vw] flex flex-col"
            style={{ backgroundColor: skin.panelBg, border: `1px solid ${skin.divider}`, height: '380px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold" style={{ color: skin.textPrimary }}>编辑标语</span>
              <button
                onClick={() => setEditingMotto(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
                style={{ backgroundColor: skin.cardBg, color: skin.textMuted }}
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={mottoDraft}
              onChange={(e) => {
                if (e.target.value.length <= 15) setMottoDraft(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && mottoDraft.trim()) {
                  setMotto(mottoDraft.trim());
                  localStorage.setItem('calendar-motto', mottoDraft.trim());
                  setEditingMotto(false);
                } else if (e.key === 'Escape') {
                  setEditingMotto(false);
                }
              }}
              maxLength={15}
              autoFocus
              className="w-full rounded-lg px-4 py-3 text-lg outline-none transition-all"
              style={{
                backgroundColor: skin.cardBg,
                color: skin.textPrimary,
                border: `1.5px solid ${skin.divider}`,
                fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
              }}
              placeholder="输入标语（最多15字）"
            />
            <div className="flex justify-end mt-1 mb-4">
              <span className="text-xs" style={{ color: skin.textMuted }}>{mottoDraft.length}/15</span>
            </div>

            {/* Font size slider */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: skin.textSecondary }}>字体大小</span>
                <span className="text-sm font-mono" style={{ color: skin.textMuted }}>{mottoSize}px</span>
              </div>
              <input
                type="range"
                min={12}
                max={40}
                value={mottoSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value, 10);
                  setMottoSize(newSize);
                  localStorage.setItem('calendar-motto-size', String(newSize));
                }}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${skin.swatch} 0%, ${skin.swatch} ${((mottoSize - 12) / 28) * 100}%, ${skin.divider} ${((mottoSize - 12) / 28) * 100}%, ${skin.divider} 100%)`,
                  accentColor: skin.swatch,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: skin.textMuted }}>小</span>
                <span className="text-[10px]" style={{ color: skin.textMuted }}>大</span>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg mb-5 text-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: skin.cardBg, height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span
                className="font-light whitespace-nowrap inline-block leading-tight"
                style={{
                  color: skin.textMuted,
                  fontSize: `${mottoSize}px`,
                  letterSpacing: '0.5em',
                  fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
                }}
              >
                {mottoDraft || motto}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setEditingMotto(false)}
                className="flex-1 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
                style={{ backgroundColor: skin.cardBg, color: skin.textSecondary, border: `1px solid ${skin.divider}` }}
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (mottoDraft.trim()) {
                    setMotto(mottoDraft.trim());
                    localStorage.setItem('calendar-motto', mottoDraft.trim());
                  }
                  localStorage.setItem('calendar-motto-size', String(mottoSize));
                  setEditingMotto(false);
                }}
                className="flex-1 py-2 rounded-lg text-sm text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: skin.swatch }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
