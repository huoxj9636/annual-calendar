'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { getLunarInfo, getYearAnimal, getGanZhiYear } from '@/lib/lunar';
import {
  precomputeYearData,
  getTwelveWeekBlocks,
  isDatePast,
  isToday,
  MONTH_COLORS,
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
  const [noteDraft, setNoteDraft] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [cellHeight, setCellHeight] = useState(44);

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
      // 12 months + gaps (3px each = 33px) + header row (20px)
      const headerH = 20;
      const gapsH = 11 * 3; // 11 gaps between 12 months
      const available = containerHeight - headerH - gapsH;
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
      `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
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
      const popW = 220;
      const popH = 140;
      let x = rect.left + rect.width / 2 - popW / 2;
      let y = rect.bottom + 4;
      if (x + popW > window.innerWidth - 8) x = window.innerWidth - popW - 8;
      if (x < 8) x = 8;
      if (y + popH > window.innerHeight - 8) y = rect.top - popH - 4;
      setNotePopup({ month, day, x, y });
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

  const colTemplate = `48px repeat(31, 1fr)`;

  return (
    <div className="h-screen bg-gray-50 print:bg-white print:h-auto flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 print:static print:border-b z-20">
        <div className="px-4 py-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-lg font-bold"
              aria-label="上一年"
            >
              ‹
            </button>
            <div className="flex items-baseline gap-2">
              <h1 className="text-3xl font-black tracking-tight text-gray-900">
                {year}
              </h1>
              <span className="text-base text-gray-500 font-medium">
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
              className="px-2.5 py-1 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
            >
              今年
            </button>
          </div>

          {/* Legend & Stats */}
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3.5 bg-green-100 rounded text-green-600 text-center text-[10px] leading-3.5">
                  ✓
                </span>{' '}
                满意
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3.5 bg-red-100 rounded text-red-600 text-center text-[10px] leading-3.5">
                  ✗
                </span>{' '}
                不满意
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3 rounded border-2 border-red-600" />
                <span className="inline-block w-3.5 h-3 rounded border-2 border-gray-900 -ml-1" />
                {' '}12周
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full" />
                备注
              </span>
            </div>
            {mounted && stats.total > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-gray-300">
                <span>已过{stats.total}天</span>
                <span className="text-green-600 font-medium">✓{stats.checked}</span>
                <span className="text-red-500 font-medium">✗{stats.crossed}</span>
                <span className="font-bold text-gray-900">{stats.rate}%</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 12-Week Block Labels */}
      <div className="flex-shrink-0 px-4 pt-2 pb-1">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {blocks.map((block, i) => (
            <span
              key={i}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{
                border: `2px solid ${block.color === 'red' ? '#dc2626' : '#1a1a1a'}`,
              }}
            >
              <span
                className="font-bold"
                style={{
                  color: block.color === 'red' ? '#dc2626' : '#1a1a1a',
                }}
              >
                {block.label}
              </span>
              <span className="text-gray-500 text-[10px]">
                {block.startDate.getMonth() + 1}/{block.startDate.getDate()} -{' '}
                {block.endDate.getMonth() + 1}/{block.endDate.getDate()}
              </span>
            </span>
          ))}
          <span className="text-gray-400 text-[10px] ml-1">
            {(() => {
              const block4End = blocks[3]?.endDate;
              const yearEnd = new Date(year, 11, 31);
              if (block4End && yearEnd > block4End) {
                const remaining =
                  Math.floor(
                    (yearEnd.getTime() - block4End.getTime()) /
                      (1000 * 60 * 60 * 24),
                  ) + 1;
                return `剩余 ${remaining} 天不在12周周期内`;
              }
              return '';
            })()}
          </span>
        </div>
      </div>

      {/* Calendar Grid - fills remaining viewport */}
      <div
        ref={gridContainerRef}
        className="flex-1 px-3 pb-2 overflow-x-auto min-h-0"
      >
        <div className="w-full h-full">
          {/* Day number header */}
          <div
            className="grid gap-0"
            style={{ gridTemplateColumns: colTemplate }}
          >
            <div className="flex items-center justify-center" style={{ height: 20 }} />
            {Array.from({ length: 31 }, (_, i) => (
              <div
                key={i + 1}
                className="flex items-center justify-center text-[9px] font-medium text-gray-400"
                style={{ height: 20 }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Month rows */}
          {yearData.map((monthRow, monthIdx) => {
            const monthColor = MONTH_COLORS[monthIdx];
            return (
              <div
                key={monthIdx}
                className="grid gap-0"
                style={{
                  gridTemplateColumns: colTemplate,
                  marginBottom: monthIdx < 11 ? 3 : 0,
                }}
              >
                {/* Month label */}
                <div
                  className="flex items-center justify-center text-[10px] font-bold sticky left-0 bg-gray-50 z-10 print:bg-white"
                  style={{ height: cellHeight, color: monthColor.text }}
                >
                  {MONTH_NAMES[monthIdx]}
                </div>

                {/* Day cells */}
                {monthRow.map((cell: CellData) => {
                  if (!cell.exists) {
                    return (
                      <div
                        key={cell.day}
                        className="border border-gray-100 bg-gray-50/50"
                        style={{ height: cellHeight }}
                      />
                    );
                  }

                  const status = mounted ? getDayStatus(cell.month, cell.day) : 'none';
                  const isTodayCell =
                    mounted &&
                    todayStr === `${year}-${cell.month}-${cell.day}`;
                  const weekendBg = cell.isWeekend ? monthColor.bg : undefined;
                  const noteKey = `${year}-${cell.month}-${cell.day}`;
                  const hasNote = mounted && notes[noteKey];

                  // Build border styles for 12-week blocks
                  const borderStyle: CSSProperties = {};
                  if (cell.blockBorders) {
                    const bw = '2.5px';
                    const bc = cell.blockBorders.color;
                    if (cell.blockBorders.top) borderStyle.borderTop = `${bw} solid ${bc}`;
                    if (cell.blockBorders.bottom) borderStyle.borderBottom = `${bw} solid ${bc}`;
                    if (cell.blockBorders.left) borderStyle.borderLeft = `${bw} solid ${bc}`;
                    if (cell.blockBorders.right) borderStyle.borderRight = `${bw} solid ${bc}`;
                  }

                  return (
                    <div
                      key={cell.day}
                      className={`
                        border border-gray-200 relative
                        ${isTodayCell ? 'ring-2 ring-blue-500 ring-inset z-[5]' : ''}
                        ${!cell.isWeekend ? 'bg-white' : ''}
                      `}
                      style={{
                        height: cellHeight,
                        backgroundColor: weekendBg,
                        ...borderStyle,
                      }}
                    >
                      {/* Top zone: day number + check/cross toggle */}
                      <div
                        className="flex items-start justify-start pt-0.5 pl-1 cursor-pointer hover:bg-black/[0.03] transition-colors"
                        style={{ height: '50%' }}
                        onClick={() => toggleDay(cell.month, cell.day)}
                        title={`${year}年${cell.month}月${cell.day}日 - 点击切换满意/不满意`}
                      >
                        <span
                          className={`text-[10px] font-bold leading-none ${
                            cell.isWeekend ? '' : 'text-gray-800'
                          }`}
                          style={
                            cell.isWeekend
                              ? { color: monthColor.text }
                              : undefined
                          }
                        >
                          {cell.day}
                        </span>
                        {mounted && status !== 'none' && (
                          <span
                            className={`text-[8px] font-bold leading-none ${
                              status === 'crossed'
                                ? 'text-red-500'
                                : 'text-green-600'
                            }`}
                          >
                            {status === 'crossed' ? '✗' : '✓'}
                          </span>
                        )}
                      </div>

                      {/* Bottom zone: lunar display + note indicator, click to open note */}
                      <div
                        className="flex items-start pl-1 pr-0.5 cursor-pointer hover:bg-black/[0.03] transition-colors relative"
                        style={{ height: '50%' }}
                        onClick={(e) => openNotePopup(cell.month, cell.day, e)}
                        title={`${year}年${cell.month}月${cell.day}日 - 点击添加备忘`}
                      >
                        <span
                          className={`text-[7px] leading-tight truncate max-w-full ${
                            cell.isSolarTerm
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
                            cell.isWeekend &&
                            !cell.isSolarTerm &&
                            !cell.isFestival &&
                            !cell.isLunarFirstDay
                              ? { color: monthColor.accent }
                              : undefined
                          }
                        >
                          {cell.lunarDisplay}
                        </span>
                        {hasNote && (
                          <span className="absolute top-0 right-0.5 w-1.5 h-1.5 bg-blue-400 rounded-full" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Note Popup */}
      {notePopup && mounted && (
        <div
          ref={popupRef}
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3"
          style={{
            left: notePopup.x,
            top: notePopup.y,
            width: 220,
          }}
        >
          <div className="text-xs font-bold text-gray-700 mb-1.5">
            {year}年{notePopup.month}月{notePopup.day}日 备忘
          </div>
          <textarea
            className="w-full h-20 text-xs border border-gray-300 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            placeholder="记录今日事项..."
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
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button
              className="text-[10px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              onClick={() => {
                setNotePopup(null);
                setNoteDraft('');
              }}
            >
              取消
            </button>
            <button
              className="text-[10px] px-2 py-0.5 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              onClick={saveNote}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
