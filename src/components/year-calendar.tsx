'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

export default function YearCalendar() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [overrides, setOverrides] = useState<DayOverrides>({});
  const [mounted, setMounted] = useState(false);
  const [todayStr, setTodayStr] = useState('');

  // Compute 12-week blocks for the current year
  const blocks = useMemo(() => getTwelveWeekBlocks(year), [year]);

  // Precompute all cell data
  const yearData = useMemo(
    () => precomputeYearData(year, blocks, getLunarInfo),
    [year, blocks],
  );

  // Load overrides from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const now = new Date();
    setTodayStr(
      `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
    );
    try {
      const saved = localStorage.getItem(`calendar-overrides-${year}`);
      if (saved) {
        setOverrides(JSON.parse(saved));
      } else {
        setOverrides({});
      }
    } catch {
      setOverrides({});
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
      // Ignore storage errors
    }
  }, [overrides, year, mounted]);

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
        // Currently auto-checked → cross it
        setOverrides((prev) => ({ ...prev, [key]: 'crossed' }));
      } else if (current === 'crossed') {
        // Currently crossed → explicitly checked
        setOverrides((prev) => ({ ...prev, [key]: 'checked' }));
      } else {
        // Currently checked → remove override (back to auto)
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
  }, [year, overrides, mounted, getDayStatus]);

  const animal = getYearAnimal(year);
  const ganZhi = getGanZhiYear(year);

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 print:static print:border-b">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            {/* Year navigation */}
            <button
              onClick={() => setYear((y) => y - 1)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-lg font-bold"
              aria-label="上一年"
            >
              ‹
            </button>
            <div className="flex items-baseline gap-3">
              <h1 className="text-4xl font-black tracking-tight text-gray-900">
                {year}
              </h1>
              <span className="text-lg text-gray-500 font-medium">
                {ganZhi}（{animal}）
              </span>
            </div>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-lg font-bold"
              aria-label="下一年"
            >
              ›
            </button>
            <button
              onClick={() => setYear(new Date().getFullYear())}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
            >
              今年
            </button>
          </div>

          {/* Legend & Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 bg-green-100 rounded text-green-600 text-center text-xs leading-4">
                  ✓
                </span>{' '}
                满意
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 bg-red-100 rounded text-red-600 text-center text-xs leading-4">
                  ✗
                </span>{' '}
                不满意
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-3 rounded border-2 border-red-600" />
                <span className="inline-block w-4 h-3 rounded border-2 border-gray-900 -ml-1.5" />
                {' '}12周区块
              </span>
            </div>
            {mounted && stats.total > 0 && (
              <div className="flex items-center gap-2 pl-3 border-l border-gray-300">
                <span>已过 {stats.total} 天</span>
                <span className="text-green-600 font-medium">
                  ✓{stats.checked}
                </span>
                <span className="text-red-500 font-medium">
                  ✗{stats.crossed}
                </span>
                <span className="font-bold text-gray-900">
                  {stats.rate}%
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 12-Week Block Labels */}
      <div className="max-w-[1600px] mx-auto px-4 pt-3 pb-1">
        <div className="flex items-center gap-3 text-sm">
          {blocks.map((block, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded"
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
              <span className="text-gray-500 text-xs">
                {block.startDate.getMonth() + 1}/{block.startDate.getDate()} -{' '}
                {block.endDate.getMonth() + 1}/{block.endDate.getDate()}
              </span>
            </span>
          ))}
          <span className="text-gray-400 text-xs ml-2">
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

      {/* Calendar Grid */}
      <div className="max-w-[1600px] mx-auto px-4 pb-8 overflow-x-auto">
        <div className="inline-block min-w-fit">
          {/* Day number header */}
          <div
            className="grid gap-0"
            style={{
              gridTemplateColumns: '56px repeat(31, minmax(38px, 1fr))',
            }}
          >
            <div className="h-7" /> {/* Empty corner */}
            {Array.from({ length: 31 }, (_, i) => (
              <div
                key={i + 1}
                className="h-7 flex items-center justify-center text-xs font-semibold text-gray-500"
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
                  gridTemplateColumns: '56px repeat(31, minmax(38px, 1fr))',
                }}
              >
                {/* Month label */}
                <div
                  className="flex items-center justify-center text-sm font-bold py-1 sticky left-0 bg-gray-50 z-10 print:bg-white"
                  style={{ color: monthColor.text }}
                >
                  {MONTH_NAMES[monthIdx]}
                </div>

                {/* Day cells */}
                {monthRow.map((cell: CellData) => {
                  if (!cell.exists) {
                    return (
                      <div
                        key={cell.day}
                        className="h-12 border border-gray-100 bg-gray-50/50"
                      />
                    );
                  }

                  const status = mounted ? getDayStatus(cell.month, cell.day) : 'none';
                  const isTodayCell =
                    mounted &&
                    todayStr === `${year}-${cell.month}-${cell.day}`;
                  const weekendBg = cell.isWeekend ? monthColor.bg : undefined;

                  // Build border styles for 12-week blocks
                  const borderStyle: React.CSSProperties = {};
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
                        h-12 border border-gray-200 relative cursor-pointer
                        transition-all duration-100 hover:brightness-95 hover:z-[5] hover:shadow-md
                        ${isTodayCell ? 'ring-2 ring-blue-500 ring-inset z-[5]' : ''}
                        ${!cell.isWeekend ? 'bg-white' : ''}
                      `}
                      style={{
                        backgroundColor: weekendBg,
                        ...borderStyle,
                      }}
                      onClick={() => toggleDay(cell.month, cell.day)}
                      title={`${year}年${cell.month}月${cell.day}日 - 点击切换状态`}
                    >
                      <div className="flex flex-col items-center justify-center h-full px-0.5">
                        {/* Day number + status */}
                        <div className="flex items-center gap-0.5 leading-none">
                          <span
                            className={`text-xs font-semibold ${
                              cell.isWeekend
                                ? ''
                                : 'text-gray-700'
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
                              className={`text-[10px] font-bold ${
                                status === 'crossed'
                                  ? 'text-red-500'
                                  : 'text-green-600'
                              }`}
                            >
                              {status === 'crossed' ? '✗' : '✓'}
                            </span>
                          )}
                        </div>
                        {/* Lunar display */}
                        <span
                          className={`text-[9px] leading-tight truncate max-w-full text-center ${
                            cell.isSolarTerm
                              ? 'text-orange-600 font-semibold'
                              : cell.isFestival
                                ? 'text-red-500 font-semibold'
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
                              ? { color: monthColor.accent + '99' }
                              : undefined
                          }
                        >
                          {cell.lunarDisplay}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
