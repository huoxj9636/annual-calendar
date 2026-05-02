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
  const gridInnerRef = useRef<HTMLDivElement>(null);
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
      const headerH = 20;
      const gapsH = 11 * 3;
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
      const popW = 360;
      const popH = 280;
      let x = rect.left + rect.width / 2 - popW / 2;
      let y = rect.bottom + 4;
      if (x + popW > window.innerWidth - 16) x = window.innerWidth - popW - 16;
      if (x < 16) x = 16;
      if (y + popH > window.innerHeight - 16) y = rect.top - popH - 4;
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

  // Build SVG wave border paths for 12-week blocks
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

      const blockCellsMap: Record<number, { monthIdx: number; day: number; rect: DOMRect }[]> = {};

      const monthRows = gridEl.querySelectorAll<HTMLElement>('[data-month-row]');
      monthRows.forEach((row) => {
        const monthIdx = parseInt(row.dataset.monthRow || '0', 10);
        const cells = row.querySelectorAll<HTMLElement>('[data-day]');
        cells.forEach((cell) => {
          const day = parseInt(cell.dataset.day || '0', 10);
          const cellData = yearData[monthIdx]?.[day - 1];
          if (!cellData || !cellData.exists || cellData.blockIndex < 0) return;
          if (!blockCellsMap[cellData.blockIndex]) blockCellsMap[cellData.blockIndex] = [];
          blockCellsMap[cellData.blockIndex].push({
            monthIdx,
            day,
            rect: cell.getBoundingClientRect(),
          });
        });
      });

      const paths: { d: string; color: string; blockIdx: number }[] = [];

      const amplitude = 2;
      const wavelength = 6;

      const makeWavyLine = (
        x1: number, y1: number,
        x2: number, y2: number,
      ): string => {
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

      for (const [blockIdxStr, cells] of Object.entries(blockCellsMap)) {
        const blockIdx = parseInt(blockIdxStr, 10);
        const block = blocks.find((b: TwelveWeekBlock) => b.index === blockIdx);
        if (!block) continue;
        const color = block.color === 'red' ? '#dc2626' : '#1a1a1a';

        const byRow: Record<number, typeof cells> = {};
        for (const c of cells) {
          if (!byRow[c.monthIdx]) byRow[c.monthIdx] = [];
          byRow[c.monthIdx].push(c);
        }

        for (const [, rowCells] of Object.entries(byRow)) {
          const sorted = [...rowCells].sort((a, b) => a.day - b.day);
          const segments: typeof sorted[] = [];
          let current: typeof sorted = [sorted[0]];
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].day === sorted[i - 1].day + 1) {
              current.push(sorted[i]);
            } else {
              segments.push(current);
              current = [sorted[i]];
            }
          }
          segments.push(current);

          for (const seg of segments) {
            const firstRect = seg[0].rect;
            const lastRect = seg[seg.length - 1].rect;
            const monthIdx = seg[0].monthIdx;

            // Top edge
            const firstDay = seg[0].day;
            const aboveCell = monthIdx > 0
              ? yearData[monthIdx - 1]?.[firstDay - 1]
              : null;
            const isTopEdge = monthIdx === 0 ||
              !aboveCell || !aboveCell.exists ||
              aboveCell.blockIndex !== blockIdx;
            if (isTopEdge) {
              const x1 = firstRect.left - gridRect.left;
              const y1 = firstRect.top - gridRect.top;
              const x2 = lastRect.right - gridRect.left;
              const d = makeWavyLine(x1, y1, x2, y1);
              if (d) paths.push({ d, color, blockIdx });
            }

            // Bottom edge
            const lastDay = seg[seg.length - 1].day;
            const belowCell = monthIdx < 11
              ? yearData[monthIdx + 1]?.[lastDay - 1]
              : null;
            const isBottomEdge = monthIdx === 11 ||
              !belowCell || !belowCell.exists ||
              belowCell.blockIndex !== blockIdx;
            if (isBottomEdge) {
              const x1 = firstRect.left - gridRect.left;
              const y1 = firstRect.bottom - gridRect.top;
              const x2 = lastRect.right - gridRect.left;
              const d = makeWavyLine(x1, y1, x2, y1);
              if (d) paths.push({ d, color, blockIdx });
            }

            // Left edge
            const leftNeighbor = firstDay > 1
              ? yearData[monthIdx]?.[firstDay - 2]
              : null;
            const isLeftEdge = firstDay === 1 ||
              !leftNeighbor || !leftNeighbor.exists ||
              leftNeighbor.blockIndex !== blockIdx;
            if (isLeftEdge) {
              const x1 = firstRect.left - gridRect.left;
              const y1 = firstRect.top - gridRect.top;
              const d = makeWavyLine(x1, y1, x1, firstRect.bottom - gridRect.top);
              if (d) paths.push({ d, color, blockIdx });
            }

            // Right edge
            const rightNeighbor = lastDay < 31
              ? yearData[monthIdx]?.[lastDay]
              : null;
            const isRightEdge = lastDay === 31 ||
              !rightNeighbor || !rightNeighbor.exists ||
              rightNeighbor.blockIndex !== blockIdx;
            if (isRightEdge) {
              const x1 = lastRect.right - gridRect.left;
              const y1 = lastRect.top - gridRect.top;
              const d = makeWavyLine(x1, y1, x1, lastRect.bottom - gridRect.top);
              if (d) paths.push({ d, color, blockIdx });
            }
          }
        }
      }

      setWaveBorders(paths);
    };

    // Delay to ensure layout is stable
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
        <div className="px-8 py-3 flex items-center justify-between flex-wrap gap-2">
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
          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex items-center gap-3 text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-flex w-5 h-5 bg-emerald-50 rounded-md items-center justify-center text-emerald-600 text-[11px] font-bold">
                  ✓
                </span>
                <span>满意</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex w-5 h-5 bg-rose-50 rounded-md items-center justify-center text-rose-500 text-[11px] font-bold">
                  ✗
                </span>
                <span>不满意</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-3 rounded border-2 border-red-500" />
                <span className="inline-block w-4 h-3 rounded border-2 border-gray-800 -ml-1.5" />
                <span>12周</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-sky-400 rounded-full" />
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
        className="flex-1 px-8 pb-6 pt-3 overflow-x-auto min-h-0"
      >
        <div ref={gridInnerRef} className="w-full h-full relative">
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
                data-month-row={monthIdx}
                className="grid gap-0"
                style={{
                  gridTemplateColumns: colTemplate,
                  marginBottom: monthIdx < 11 ? 3 : 0,
                }}
              >
                {/* Month label */}
                <div
                  className="flex items-center justify-center text-[10px] font-bold sticky left-0 bg-gray-50 z-10 print:bg-white rounded-md mx-0.5"
                  style={{
                    height: cellHeight,
                    color: monthColor.text,
                    border: `2px solid ${monthColor.text}`,
                    backgroundColor: `${monthColor.bg}`,
                  }}
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

                  return (
                    <div
                      key={cell.day}
                      data-day={cell.day}
                      className={`
                        border border-gray-200 relative
                        ${isTodayCell ? 'ring-2 ring-blue-500 ring-inset z-[5]' : ''}
                        ${!cell.isWeekend ? 'bg-white' : ''}
                      `}
                      style={{
                        height: cellHeight,
                        backgroundColor: weekendBg,
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
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          )}
        </div>
      </div>

      {/* Note Popup - larger size */}
      {notePopup && mounted && (
        <div
          ref={popupRef}
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4"
          style={{
            left: notePopup.x,
            top: notePopup.y,
            width: 360,
          }}
        >
          <div className="text-sm font-bold text-gray-800 mb-2">
            {year}年{notePopup.month}月{notePopup.day}日 备忘
          </div>
          <textarea
            className="w-full h-36 text-sm border border-gray-300 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 leading-relaxed"
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
          <div className="flex justify-end gap-2 mt-2">
            <button
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              onClick={() => {
                setNotePopup(null);
                setNoteDraft('');
              }}
            >
              取消
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
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
