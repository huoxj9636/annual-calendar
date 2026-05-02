'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { getLunarInfo, getYearAnimal, getGanZhiYear } from '@/lib/lunar';
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
  type TwelveWeekBlock,
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

/* ===== Month View Component ===== */
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

interface MonthViewProps {
  year: number;
  month: number;
  mounted: boolean;
  todayStr: string;
  overrides: Record<string, 'checked' | 'crossed'>;
  notes: Record<string, string>;
  getDayStatus: (month: number, day: number) => 'checked' | 'crossed' | 'auto' | 'none';
  toggleDay: (month: number, day: number) => void;
  openNotePopup: (month: number, day: number, e: ReactMouseEvent) => void;
  onBack: () => void;
}

function MonthView({
  year,
  month,
  mounted,
  todayStr,
  overrides,
  notes,
  getDayStatus,
  toggleDay,
  openNotePopup,
  onBack,
}: MonthViewProps) {
  const monthColor = MONTH_COLORS[month - 1];
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getDayOfWeek(year, month, 1);

  // Get lunar info for each day
  const dayData = useMemo(() => {
    const result: { day: number; display: string; isSolarTerm: boolean; isFestival: boolean; isLunarFirstDay: boolean; isWeekendDay: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const info = getLunarInfo(year, month, d);
      result.push({
        day: d,
        display: info.display,
        isSolarTerm: info.isSolarTerm,
        isFestival: info.isFestival,
        isLunarFirstDay: info.isLunarFirstDay,
        isWeekendDay: isWeekend(year, month, d),
      });
    }
    return result;
  }, [year, month, daysInMonth]);

  // Build calendar grid rows (weeks)
  const weeks = useMemo(() => {
    const rows: (number | null)[][] = [];
    let currentRow: (number | null)[] = [];
    // Fill leading blanks
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentRow.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      currentRow.push(d);
      if (currentRow.length === 7) {
        rows.push(currentRow);
        currentRow = [];
      }
    }
    // Fill trailing blanks
    if (currentRow.length > 0) {
      while (currentRow.length < 7) currentRow.push(null);
      rows.push(currentRow);
    }
    return rows;
  }, [daysInMonth, firstDayOfWeek]);

  return (
    <div className="flex flex-col items-center w-full h-full">
      {/* Month header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-4 px-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-lg text-gray-600 font-medium"
        >
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 3L5 8l5 5" />
          </svg>
          返回年历
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-4xl font-bold" style={{ color: monthColor.text }}>
            {month}月
          </h2>
          <span className="text-xl text-gray-400">{year}年</span>
        </div>
        <div className="w-28" /> {/* Spacer for centering */}
      </div>

      {/* Weekday header */}
      <div className="w-full max-w-4xl grid grid-cols-7 gap-2 mb-2 px-2">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={`text-center text-lg font-semibold py-2 rounded-md ${
              i === 0 || i === 6 ? 'text-red-400' : 'text-gray-400'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="w-full max-w-4xl grid grid-cols-7 gap-2 px-2 flex-1">
        {weeks.flatMap((week, wi) =>
          week.map((day, di) => {
            if (day === null) {
              return <div key={`${wi}-${di}`} className="rounded-lg" />;
            }

            const data = dayData[day - 1];
            const status = mounted ? getDayStatus(month, day) : 'none';
            const isTodayCell = mounted && todayStr === `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cellDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isPastDay = mounted && todayStr && year < parseInt(todayStr.substring(0, 4)) || (year === parseInt(todayStr.substring(0, 4)) && cellDateStr < todayStr);
            const noteKey = `${year}-${month}-${day}`;
            const hasNote = mounted && notes[noteKey];

            return (
              <div
                key={day}
                className={`
                  rounded-lg border transition-colors relative
                  ${isTodayCell ? 'ring-2 ring-blue-500 z-[5]' : 'border-gray-100'}
                  ${data.isWeekendDay ? '' : 'bg-white'}
                  hover:shadow-sm
                `}
                style={{
                  backgroundColor: isPastDay ? '#fafafa' : data.isWeekendDay ? monthColor.bg : undefined,
                }}
              >
                {/* Top zone: day + lunar + check */}
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => toggleDay(month, day)}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-2xl font-bold ${
                        isPastDay ? 'text-gray-200' : data.isWeekendDay ? '' : 'text-gray-800'
                      }`}
                      style={isPastDay ? undefined : data.isWeekendDay ? { color: monthColor.text } : undefined}
                    >
                      {day}
                    </span>
                      {mounted && status !== 'none' && (
                      <span
                        className={`absolute inset-0 flex items-center justify-center text-5xl font-bold pointer-events-none ${
                          status === 'crossed' ? 'text-red-400/30' : 'text-green-500/30'
                        }`}
                      >
                        {status === 'crossed' ? '✗' : '✓'}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-base leading-tight block mt-1 ${
                      isPastDay
                        ? 'text-gray-100'
                        : data.isSolarTerm
                          ? 'text-orange-600 font-medium'
                          : data.isFestival
                            ? 'text-red-500 font-medium'
                            : data.isLunarFirstDay
                              ? 'text-purple-600 font-medium'
                              : data.isWeekendDay
                                ? ''
                                : 'text-gray-400'
                    }`}
                    style={
                      isPastDay
                        ? undefined
                        : data.isWeekendDay && !data.isSolarTerm && !data.isFestival && !data.isLunarFirstDay
                          ? { color: monthColor.accent }
                          : undefined
                    }
                  >
                    {data.display}
                  </span>
                </div>
                {/* Bottom zone: note */}
                <div
                  className="px-3 pb-3 cursor-pointer min-h-[40px]"
                  onClick={(e) => openNotePopup(month, day, e)}
                >
                  {hasNote && (
                    <div className="text-sm text-gray-400 truncate leading-tight">
                      {notes[noteKey].split('\n')[0]}
                    </div>
                  )}
                  {hasNote && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-sky-400 rounded-full" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
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
  const popupRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridInnerRef = useRef<HTMLDivElement>(null);
  const [cellHeight, setCellHeight] = useState(66);

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

  const openNotePopup = useCallback(
    (month: number, day: number, e: ReactMouseEvent) => {
      const key = `${year}-${month}-${day}`;
      setNoteDraft(notes[key] || '');
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const popW = 530;
      const popH = 320;
      let x = rect.left + rect.width / 2 - popW / 2;
      let y = rect.bottom + 4;
      if (x + popW > window.innerWidth - 16) x = window.innerWidth - popW - 16;
      if (x < 16) x = 16;
      if (y + popH > window.innerHeight - 16) y = rect.top - popH - 4;
      setNotePopup({ month, day, x, y });
      setPopupSize({ w: 530, h: 320 });
    },
    [year, notes],
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
  const [waveBorders, setWaveBorders] = useState<{ d: string; color: string; blockIdx: number }[]>([]);

  useEffect(() => {
    if (!mounted || !gridInnerRef.current) {
      setWaveBorders([]);
      return;
    }

    const computeBorders = () => {
      const gridEl = gridInnerRef.current;
      if (!gridEl) return;
      const gridRect = gridEl.getBoundingClientRect();
      const monthRows = gridEl.querySelectorAll<HTMLElement>('[data-month-row]');

      const paths: { d: string; color: string; blockIdx: number }[] = [];
      const amplitude = 0.3;
      const wavelength = 4;

      const makeWavyLine = (x1: number, y1: number, x2: number, y2: number): string => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 2) return '';
        const steps = Math.max(1, Math.round(len / (wavelength / 2)));
        const ux = dx / len;
        const uy = dy / len;
        const px = -uy;
        const py = ux;
        let d = `M ${x1} ${y1}`;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const bx = x1 + dx * t;
          const by = y1 + dy * t;
          const offset = (i % 2 === 1 ? 1 : -1) * amplitude;
          d += ` L ${bx + px * offset} ${by + py * offset}`;
        }
        return d;
      };

      // For each quarter (Q1-Q4), find the bounding rectangle and draw wavy border
      const quarterRanges = [
        { startMonth: 0, endMonth: 2 },  // Q1: rows 0-2
        { startMonth: 3, endMonth: 5 },  // Q2: rows 3-5
        { startMonth: 6, endMonth: 8 },  // Q3: rows 6-8
        { startMonth: 9, endMonth: 11 }, // Q4: rows 9-11
      ];

      for (let qi = 0; qi < 4; qi++) {
        const q = quarterRanges[qi];
        const color = qi % 2 === 0 ? '#dc2626' : '#1a1a1a';

        // Find the first row (top of quarter)
        const firstRow = monthRows[q.startMonth];
        // Find the last row (bottom of quarter)
        const lastRow = monthRows[q.endMonth];
        if (!firstRow || !lastRow) continue;

        const firstRowRect = firstRow.getBoundingClientRect();
        const lastRowRect = lastRow.getBoundingClientRect();

        // Find the month label cell (first child) for left edge
        const monthLabelFirst = firstRow.querySelector<HTMLElement>(':scope > div:first-child');
        const monthLabelLast = lastRow.querySelector<HTMLElement>(':scope > div:first-child');
        if (!monthLabelFirst || !monthLabelLast) continue;

        const leftRect = monthLabelFirst.getBoundingClientRect();
        const leftRectLast = monthLabelLast.getBoundingClientRect();

        // Find the rightmost cell (day 31) for right edge
        // Use the last row's day 31 cell to get the right edge
        const rightCellFirst = firstRow.querySelector<HTMLElement>('[data-day="31"]');
        const rightCellLast = lastRow.querySelector<HTMLElement>('[data-day="31"]');
        if (!rightCellFirst || !rightCellLast) continue;

        const rightRectFirst = rightCellFirst.getBoundingClientRect();
        const rightRectLast = rightCellLast.getBoundingClientRect();

        // Calculate coordinates relative to grid
        const left = leftRect.right - gridRect.left + 1; // right edge of month label
        const right = Math.max(rightRectFirst.right, rightRectLast.right) - gridRect.left;
        const top = firstRowRect.top - gridRect.top;
        const bottom = lastRowRect.bottom - gridRect.top;

        // Draw 4 wavy lines forming a rectangle
        // Top edge
        const topPath = makeWavyLine(left, top, right, top);
        if (topPath) paths.push({ d: topPath, color, blockIdx: qi });

        // Bottom edge
        const bottomPath = makeWavyLine(right, bottom, left, bottom);
        if (bottomPath) paths.push({ d: bottomPath, color, blockIdx: qi });

        // Left edge
        const leftPath = makeWavyLine(left, bottom, left, top);
        if (leftPath) paths.push({ d: leftPath, color, blockIdx: qi });

        // Right edge
        const rightPath = makeWavyLine(right, top, right, bottom);
        if (rightPath) paths.push({ d: rightPath, color, blockIdx: qi });
      }

      setWaveBorders(paths);
    };

    const timer = setTimeout(computeBorders, 100);
    const onResize = () => {
      clearTimeout(timer);
      setTimeout(computeBorders, 50);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [mounted, yearData, blocks, cellHeight]);

  return (
    <div className="h-screen bg-gray-50 print:bg-white print:h-auto flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 print:static print:border-b z-20">
        <div className="px-8 py-1.5 flex items-center justify-between flex-wrap gap-2 relative">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-2xl font-bold"
              aria-label="上一年"
            >
              ‹
            </button>
            <div className="flex items-end gap-2">
              <h1 className="text-7xl font-black tracking-tight text-gray-900 leading-none">
                {year}
              </h1>
              <span className="text-base text-gray-500 font-medium pb-1">
                {ganZhi}（{animal}）
              </span>
            </div>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-lg font-bold"
              aria-label="下一年"
            >
              ›
            </button>
            <button
              onClick={() => setYear(new Date().getFullYear())}
              className="px-4 py-1.5 text-base rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
            >
              今年
            </button>
          </div>

          {/* 居中标语 */}
          <div className="absolute inset-x-0 flex justify-center pointer-events-none">
            <span className="text-3xl font-bold tracking-[0.4em] text-gray-800 select-none" style={{ fontFamily: '"STKaiti", "KaiTi", "楷体", serif' }}>
              永远不要放弃
            </span>
          </div>

          {/* Legend & Stats */}
          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex items-center gap-3 text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-flex w-[23px] h-[23px] bg-emerald-50 rounded-md items-center justify-center text-emerald-600 text-[17px] font-bold">
                  ✓
                </span>
                <span>满意</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex w-[23px] h-[23px] bg-rose-50 rounded-md items-center justify-center text-rose-500 text-[17px] font-bold">
                  ✗
                </span>
                <span>不满意</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-3 rounded border-2 border-red-500" />
                <span className="inline-block w-4 h-3 rounded border-2 border-gray-800 -ml-1.5" />
                <span>季度</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-sky-400 rounded-full" />
                <span>备注</span>
              </span>
            </div>
            {mounted && stats.total > 0 && (
              <div className="flex items-center gap-2 pl-3 ml-1 border-l border-gray-200">
                <span className="text-gray-400">已过 <strong className="text-gray-700 font-semibold">{stats.total}</strong> 天</span>
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
      <div
        ref={gridContainerRef}
        className="flex-1 px-8 pb-2 pt-1 overflow-x-auto min-h-0 flex justify-center"
      >
        {selectedMonth === null ? (
        <div ref={gridInnerRef} className="h-full relative border-t border-l border-gray-200 rounded-sm" style={{ minWidth: '1100px' }}>


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
                  className="flex items-center justify-center text-[17px] font-extrabold sticky left-0 bg-gray-50 z-10 print:bg-white rounded mx-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    height: cellHeight,
                    color: monthColor.text,
                    border: `1.5px solid ${monthColor.text}`,
                    backgroundColor: `${monthColor.bg}`,
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
                        relative
                        ${isTodayCell ? 'ring-2 ring-blue-500 ring-inset z-[5]' : ''}
                        ${!cell.isWeekend ? 'bg-white' : ''}
                      `}
                      style={{
                        height: cellHeight,
                        borderBottom: '1px solid #e5e7eb',
                        borderRight: '1px solid #e5e7eb',
                        backgroundColor: isPast ? '#fafafa' : weekendBg,
                      }}
                    >
                      {/* Top zone: day number + lunar + check/cross, click to toggle */}
                      <div
                        className="flex flex-col items-start pl-1 pt-0.5 cursor-pointer hover:bg-black/[0.03] transition-colors"
                        style={{ height: '40%' }}
                        onClick={() => toggleDay(cell.month, cell.day)}
                        title={`${year}年${cell.month}月${cell.day}日 - 点击切换满意/不满意`}
                      >
                        <div className="flex items-center gap-0.5">
                          <span
                            className={`text-[15px] font-bold leading-none ${
                              isPast
                                ? 'text-gray-200'
                                : cell.isWeekend ? '' : 'text-gray-800'
                            }`}
                            style={
                              isPast
                                ? undefined
                                : cell.isWeekend
                                  ? { color: monthColor.text }
                                  : undefined
                            }
                          >
                            {cell.day}
                          </span>
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
                        </div>
                        <span
                          className={`text-[9px] leading-tight mt-0.5 whitespace-nowrap ${
                            isPast
                              ? 'text-gray-100'
                              : cell.isSolarTerm
                                ? 'text-orange-600 font-medium'
                                : cell.isFestival
                                  ? 'text-red-500 font-medium'
                                  : cell.isLunarFirstDay
                                    ? 'text-purple-600 font-medium'
                                    : cell.isWeekend
                                      ? ''
                                      : 'text-gray-400'
                          }`}
                          style={
                            isPast
                              ? undefined
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

                      {/* Bottom zone: empty area, click to open note */}
                      <div
                        className="cursor-pointer hover:bg-black/[0.03] transition-colors relative"
                        style={{ height: '60%' }}
                        onClick={(e) => openNotePopup(cell.month, cell.day, e)}
                        title={`${year}年${cell.month}月${cell.day}日 - 点击添加备忘`}
                      >
                        {hasNote && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-sky-400 rounded-full" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* SVG overlay for wavy block borders */}
          {mounted && waveBorders.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: '100%', height: '100%' }}
            >
              {waveBorders.map((p, i) => (
                <path
                  key={`${p.blockIdx}-${i}`}
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          )}
        </div>
        ) : (
        /* ===== Monthly View ===== */
        <MonthView
          year={year}
          month={selectedMonth}
          mounted={mounted}
          todayStr={todayStr}
          overrides={overrides}
          notes={notes}
          getDayStatus={getDayStatus}
          toggleDay={toggleDay}
          openNotePopup={openNotePopup}
          onBack={() => setSelectedMonth(null)}
        />
        )}
      </div>

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
                <div className="text-[15px] text-gray-400 font-medium mb-1.5 tracking-wide">已记录</div>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
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
    </div>
  );
}
