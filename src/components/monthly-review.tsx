'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getLunarInfo } from '@/lib/lunar';
import {
  getDaysInMonth,
  isWeekend,
} from '@/lib/calendar-utils';
import { SKINS, DEFAULT_SKIN } from '@/lib/skins';
import type { SkinTheme } from '@/lib/skins';

interface MonthlyReviewProps {
  year: number;
  skin?: SkinTheme;
}

type DayOverride = 'checked' | 'crossed';

interface MonthStats {
  month: number;
  totalDays: number;
  checked: number;
  crossed: number;
  overrideRate: number;
  satisfactionRate: number;
  scheduleDays: number;
  scheduleRate: number;
  todoTotal: number;
  todoDone: number;
  todoRate: number;
  memoDays: number;
  memoRate: number;
  weekdayChecked: number;
  weekdayTotal: number;
  weekendChecked: number;
  weekendTotal: number;
  solarTerms: string[];
  festivals: string[];
  heatMap: ('checked' | 'crossed' | 'empty' | 'future')[];
}

export default function MonthlyReview({ year, skin: skinProp }: MonthlyReviewProps) {
  const skin = skinProp ?? SKINS.find(s => s.key === DEFAULT_SKIN) ?? SKINS[0];
  const [mounted, setMounted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const monthGridRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const isInitialAutoSelect = useRef(true);

  useEffect(() => {
    setMounted(true);
    // Auto-select current month after mount (without scrolling)
    const currentMonth = new Date().getMonth() + 1;
    if (year === new Date().getFullYear()) {
      setSelectedMonth(currentMonth);
    }
    // Mark initial auto-select as done after a tick
    const timer = setTimeout(() => { isInitialAutoSelect.current = false; }, 300);
    return () => clearTimeout(timer);
  }, [year]);

  // Scroll to detail only when user manually clicks a month
  useEffect(() => {
    if (isInitialAutoSelect.current) return;
    if (selectedMonth !== null && detailRef.current) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedMonth]);

  const monthStats = useMemo<MonthStats[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const totalDays = getDaysInMonth(year, month);

      // Load overrides
      let overrides: Record<string, DayOverride> = {};
      try {
        const raw = localStorage.getItem(`calendar-overrides-${year}`);
        if (raw) overrides = JSON.parse(raw);
      } catch { /* empty */ }

      // Load events
      let scheduleDays = 0;
      try {
        for (let d = 1; d <= totalDays; d++) {
          const key = `dayview-events-${year}-${month}-${d}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const events = JSON.parse(raw);
            if (Array.isArray(events) && events.length > 0) scheduleDays++;
          }
        }
      } catch { /* empty */ }

      // Load todos
      let todoTotal = 0;
      let todoDone = 0;
      try {
        for (let d = 1; d <= totalDays; d++) {
          const key = `dayview-todos-${year}-${month}-${d}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const todos = JSON.parse(raw);
            if (Array.isArray(todos)) {
              todoTotal += todos.length;
              todoDone += todos.filter((t: { done?: boolean }) => t.done).length;
            }
          }
        }
      } catch { /* empty */ }

      // Load memos
      let memoDays = 0;
      try {
        const rawNotes = localStorage.getItem(`calendar-notes-${year}`);
        const notes: Record<string, string> = rawNotes ? JSON.parse(rawNotes) : {};
        for (let d = 1; d <= totalDays; d++) {
          const noteKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (notes[noteKey] && notes[noteKey].trim()) memoDays++;
        }
      } catch { /* empty */ }

      // Count overrides
      let checked = 0;
      let crossed = 0;
      let weekdayChecked = 0;
      let weekdayTotal = 0;
      let weekendChecked = 0;
      let weekendTotal = 0;

      const heatMap: MonthStats['heatMap'] = [];

      for (let d = 1; d <= totalDays; d++) {
        const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isFuture = year > currentYear || (year === currentYear && month > currentMonth) ||
          (year === currentYear && month === currentMonth && d > currentDay);

        if (isFuture) {
          heatMap.push('future');
        } else if (overrides[key] === 'checked') {
          checked++;
          heatMap.push('checked');
        } else if (overrides[key] === 'crossed') {
          crossed++;
          heatMap.push('crossed');
        } else {
          heatMap.push('empty');
        }

        const weekend = isWeekend(year, month, d);
        if (weekend) {
          weekendTotal++;
          if (overrides[key] === 'checked') weekendChecked++;
        } else {
          weekdayTotal++;
          if (overrides[key] === 'checked') weekdayChecked++;
        }
      }

      const overrideDays = checked + crossed;
      const isPast = year < currentYear || (year === currentYear && month < currentMonth) ||
        (year === currentYear && month === currentMonth);

      // Solar terms and festivals
      const solarTerms: string[] = [];
      const festivals: string[] = [];
      for (let d = 1; d <= totalDays; d++) {
        const lunar = getLunarInfo(year, month, d);
        if (lunar.isSolarTerm && lunar.solarTerm) solarTerms.push(lunar.solarTerm);
        if (lunar.isFestival && lunar.festivalName) festivals.push(lunar.festivalName);
      }

      return {
        month,
        totalDays,
        checked,
        crossed,
        overrideRate: isPast && totalDays > 0 ? Math.round(overrideDays / totalDays * 100) : 0,
        satisfactionRate: overrideDays > 0 ? Math.round(checked / overrideDays * 100) : 0,
        scheduleDays,
        scheduleRate: totalDays > 0 ? Math.round(scheduleDays / totalDays * 100) : 0,
        todoTotal,
        todoDone,
        todoRate: todoTotal > 0 ? Math.round(todoDone / todoTotal * 100) : 0,
        memoDays,
        memoRate: totalDays > 0 ? Math.round(memoDays / totalDays * 100) : 0,
        weekdayChecked,
        weekdayTotal,
        weekendChecked,
        weekendTotal,
        solarTerms,
        festivals,
        heatMap,
      };
    });
  }, [year]);

  // Year average stats
  const yearAvg = useMemo(() => {
    const totalChecked = monthStats.reduce((s, m) => s + m.checked, 0);
    const totalCrossed = monthStats.reduce((s, m) => s + m.crossed, 0);
    const totalOverride = totalChecked + totalCrossed;
    const totalScheduleDays = monthStats.reduce((s, m) => s + m.scheduleDays, 0);
    const totalTodoTotal = monthStats.reduce((s, m) => s + m.todoTotal, 0);
    const totalTodoDone = monthStats.reduce((s, m) => s + m.todoDone, 0);
    const totalMemoDays = monthStats.reduce((s, m) => s + m.memoDays, 0);
    const totalDays = monthStats.reduce((s, m) => s + m.totalDays, 0);

    return {
      satisfactionRate: totalOverride > 0 ? Math.round(totalChecked / totalOverride * 100) : 0,
      scheduleRate: totalDays > 0 ? Math.round(totalScheduleDays / totalDays * 100) : 0,
      todoRate: totalTodoTotal > 0 ? Math.round(totalTodoDone / totalTodoTotal * 100) : 0,
      memoRate: totalDays > 0 ? Math.round(totalMemoDays / totalDays * 100) : 0,
    };
  }, [monthStats]);

  // Satisfaction trend data for line chart
  const satisfactionData = monthStats.map(m => m.satisfactionRate);

  // Selected month detail
  const selectedStats = selectedMonth !== null ? monthStats[selectedMonth - 1] : null;

  const handleMonthClick = useCallback((m: number) => {
    setSelectedMonth(prev => prev === m ? null : m);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen px-8 py-6"
      style={{ background: `linear-gradient(135deg, ${skin.bodyBg}cc, ${skin.cardBg}, ${skin.bodyBg}aa)` }}>
      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight"
            style={{ color: skin.textPrimary }}>{year} 年度复盘</h2>
          <p className="text-gray-400 mt-1 text-sm">下拉回到日历 · 数据实时同步</p>
        </div>
        <div className="flex gap-3">
          <div className="text-center px-5 py-3 rounded-2xl shadow-sm backdrop-blur-sm"
            style={{ backgroundColor: skin.cardBg + "cc", borderColor: skin.divider }}>
            <div className="text-2xl font-black"
            style={{ color: skin.checkColor }}>{yearAvg.satisfactionRate}%</div>
            <div className="text-xs text-gray-400 mt-0.5">年满意度</div>
          </div>
          <div className="text-center px-5 py-3 rounded-2xl shadow-sm backdrop-blur-sm"
            style={{ backgroundColor: skin.cardBg + "cc", borderColor: skin.divider }}>
            <div className="text-2xl font-black"
            style={{ color: skin.blueDot }}>{yearAvg.scheduleRate}%</div>
            <div className="text-xs text-gray-400 mt-0.5">日程密度</div>
          </div>
          <div className="text-center px-5 py-3 rounded-2xl shadow-sm backdrop-blur-sm"
            style={{ backgroundColor: skin.cardBg + "cc", borderColor: skin.divider }}>
            <div className="text-2xl font-black"
            style={{ color: skin.swatch }}>{yearAvg.todoRate}%</div>
            <div className="text-xs text-gray-400 mt-0.5">待办完成</div>
          </div>
          <div className="text-center px-5 py-3 rounded-2xl shadow-sm backdrop-blur-sm"
            style={{ backgroundColor: skin.cardBg + "cc", borderColor: skin.divider }}>
            <div className="text-2xl font-black"
            style={{ color: skin.tabActive }}>{yearAvg.memoRate}%</div>
            <div className="text-xs text-gray-400 mt-0.5">备忘活跃</div>
          </div>
        </div>
      </div>

      {/* 12 Month Cards Grid */}
      <div ref={monthGridRef} className="grid grid-cols-4 gap-4 mb-6">
        {monthStats.map((m) => {
          const isSelected = selectedMonth === m.month;
          return (
            <div
              key={m.month}
              onClick={() => handleMonthClick(m.month)}
              className="rounded-2xl p-4 cursor-pointer transition-all duration-200 border-2"
              style={{
                backgroundColor: isSelected ? skin.cardBg : skin.cardBg + 'cc',
                borderColor: isSelected ? skin.swatch : 'transparent',
                boxShadow: isSelected ? `0 10px 25px ${skin.swatch}20` : '0 1px 3px rgba(0,0,0,0.05)',
                transform: isSelected ? 'scale(1.02)' : 'none',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold" style={{ color: skin.textPrimary }}>{m.month}月</span>
                <span className="text-xl font-black"
                  style={{ color: m.satisfactionRate >= 80 ? skin.checkColor : m.satisfactionRate >= 60 ? skin.swatch : m.satisfactionRate > 0 ? skin.crossColor : skin.textMuted }}>
                  {m.satisfactionRate > 0 ? `${m.satisfactionRate}%` : '-'}
                </span>
              </div>

              {/* Mini heat map */}
              <div className="flex flex-wrap gap-[2px] mb-3">
                {m.heatMap.map((h, i) => (
                  <div
                    key={i}
                    className="w-[10px] h-[10px] rounded-[2px]"
                    style={{ backgroundColor: h === 'checked' ? skin.checkColor + '99' : h === 'crossed' ? skin.crossColor + '80' : h === 'future' ? skin.divider : skin.textMuted + '40' }}
                  />
                ))}
              </div>

              {/* Mini stats */}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>✓{m.checked}</span>
                <span>✗{m.crossed}</span>
                <span>📅{m.scheduleDays}天</span>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: skin.divider }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${m.satisfactionRate}%`,
                    background: m.satisfactionRate >= 80 ? skin.checkColor :
                      m.satisfactionRate >= 60 ? skin.swatch : skin.crossColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Year Satisfaction Trend - Line Chart */}
      <div className="rounded-2xl shadow-sm border p-6 mb-6"
        style={{ backgroundColor: skin.cardBg, borderColor: skin.divider }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: skin.textPrimary }}>年度满意度趋势</h3>
        <div className="flex items-end gap-2 h-40">
          {monthStats.map((m, i) => {
            const height = m.satisfactionRate > 0 ? Math.max(m.satisfactionRate, 8) : 0;
            const prev = i > 0 ? satisfactionData[i - 1] : null;
            const trend = prev !== null && m.satisfactionRate > 0 && prev > 0
              ? m.satisfactionRate > prev ? 'up' : m.satisfactionRate < prev ? 'down' : 'same'
              : null;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                {trend && (
                  <span className="text-xs font-bold"
                    style={{ color: trend === 'up' ? skin.checkColor : trend === 'down' ? skin.crossColor : skin.textMuted }}>
                    {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                  </span>
                )}
                <div className="w-full flex flex-col items-center justify-end" style={{ height: '100px' }}>
                  <div
                    className="w-full max-w-[40px] rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${height}%`,
                      background: m.satisfactionRate >= 80 ? `linear-gradient(180deg, ${skin.checkColor}, ${skin.checkColor}88)` :
                        m.satisfactionRate >= 60 ? `linear-gradient(180deg, ${skin.swatch}, ${skin.swatch}88)` :
                        m.satisfactionRate > 0 ? `linear-gradient(180deg, ${skin.crossColor}, ${skin.crossColor}88)` :
                        skin.divider,
                    }}
                  />
                </div>
                <span className="text-xs mt-1" style={{ color: skin.textMuted }}>{m.month}月</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Month Detail */}
      {selectedStats && (
        <div ref={detailRef} className="rounded-2xl shadow-sm border p-6 mb-6"
          style={{ backgroundColor: skin.cardBg, borderColor: skin.swatch + "40" }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold" style={{ color: skin.textPrimary }}>{selectedStats.month}月详细分析</h3>
            <button
              onClick={() => setSelectedMonth(null)}
              className="text-sm"
              style={{ color: skin.textMuted }}
            >
              收起 ✕
            </button>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            {[
              { label: '满意度', value: selectedStats.satisfactionRate, unit: '%', color: skin.checkColor, icon: '😊' },
              { label: '打卡率', value: selectedStats.overrideRate, unit: '%', color: skin.blueDot, icon: '📋' },
              { label: '日程密度', value: selectedStats.scheduleRate, unit: '%', color: skin.tabActive, icon: '📅' },
              { label: '待办完成', value: selectedStats.todoRate, unit: '%', color: skin.swatch, icon: '✅' },
              { label: '备忘活跃', value: selectedStats.memoRate, unit: '%', color: skin.sidebarTo, icon: '📝' },
            ].map((metric) => (
              <div key={metric.label} className="text-center p-4 rounded-2xl" style={{ backgroundColor: metric.color + '08' }}>
                <div className="text-2xl mb-1">{metric.icon}</div>
                <div className="text-3xl font-black" style={{ color: metric.color }}>
                  {metric.value > 0 ? metric.value : '-'}
                  {metric.value > 0 && <span className="text-sm font-normal text-gray-400">{metric.unit}</span>}
                </div>
                <div className="text-xs text-gray-400 mt-1">{metric.label}</div>
              </div>
            ))}
          </div>

          {/* Workday vs Weekend */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-2xl"
              style={{ backgroundColor: skin.blueDot + "10" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: skin.blueDot }} />
                <span className="text-sm font-semibold text-gray-700">工作日</span>
                <span className="text-xs text-gray-400">({selectedStats.weekdayTotal}天)</span>
              </div>
              <div className="text-2xl font-black"
            style={{ color: skin.blueDot }}>
                {selectedStats.weekdayTotal > 0
                  ? `${Math.round(selectedStats.weekdayChecked / selectedStats.weekdayTotal * 100)}%`
                  : '-'}
              </div>
              <div className="text-xs text-gray-400">满意度 · ✓{selectedStats.weekdayChecked}天</div>
            </div>
            <div className="p-4 rounded-2xl"
              style={{ backgroundColor: skin.swatch + "10" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: skin.swatch }} />
                <span className="text-sm font-semibold text-gray-700">周末</span>
                <span className="text-xs text-gray-400">({selectedStats.weekendTotal}天)</span>
              </div>
              <div className="text-2xl font-black" style={{ color: skin.swatch }}>
                {selectedStats.weekendTotal > 0
                  ? `${Math.round(selectedStats.weekendChecked / selectedStats.weekendTotal * 100)}%`
                  : '-'}
              </div>
              <div className="text-xs text-gray-400">满意度 · ✓{selectedStats.weekendChecked}天</div>
            </div>
          </div>

          {/* Solar Terms & Festivals */}
          {(selectedStats.solarTerms.length > 0 || selectedStats.festivals.length > 0) && (
            <div className="flex gap-4 mb-6">
              {selectedStats.solarTerms.length > 0 && (
                <div className="flex-1 p-4 rounded-2xl"
                  style={{ backgroundColor: skin.checkColor + "10" }}>
                  <div className="text-sm font-semibold mb-2"
                  style={{ color: skin.textPrimary }}>🌿 节气</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedStats.solarTerms.map((st, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: skin.checkColor + "20", color: skin.checkColor }}>{st}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedStats.festivals.length > 0 && (
                <div className="flex-1 p-4 rounded-2xl"
                  style={{ backgroundColor: skin.crossColor + "10" }}>
                  <div className="text-sm font-semibold mb-2"
                  style={{ color: skin.textPrimary }}>🎉 节日</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedStats.festivals.map((f, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: skin.crossColor + "20", color: skin.crossColor }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detail Heat Map */}
          <div className="p-4 rounded-2xl"
            style={{ backgroundColor: skin.panelBg + "cc" }}>
            <div className="text-sm font-semibold mb-3"
            style={{ color: skin.textPrimary }}>日度热力图</div>
            <div className="flex flex-wrap gap-[3px]">
              {selectedStats.heatMap.map((h, i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-medium ${
                    h === 'checked' ? 'bg-emerald-400 text-white' :
                    h === 'crossed' ? 'bg-rose-300 text-white' :
                    h === 'future' ? 'bg-gray-100 text-gray-300' :
                    'bg-gray-200 text-gray-400'
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: skin.checkColor + "99" }} /> ✓满意</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: skin.crossColor + "80" }} /> ✗不满意</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: skin.textMuted + "40" }} /> 未记录</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: skin.divider }} /> 未来</span>
            </div>
          </div>

          {/* Schedule & Memo Summary */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 rounded-2xl"
              style={{ backgroundColor: skin.tabActive + "10" }}>
              <div className="text-sm font-semibold mb-2"
                  style={{ color: skin.textPrimary }}>📅 日程摘要</div>
              <div className="text-sm text-gray-500">
                本月共 <strong >{selectedStats.scheduleDays}</strong> 天有日程安排
              </div>
              <div className="text-sm text-gray-500 mt-1">
                日程密度 <strong >{selectedStats.scheduleRate}%</strong>
              </div>
            </div>
            <div className="p-4 rounded-2xl"
              style={{ backgroundColor: skin.sidebarTo + "10" }}>
              <div className="text-sm font-semibold mb-2"
                  style={{ color: skin.textPrimary }}>📝 备忘精选</div>
              <div className="text-sm text-gray-500">
                本月共 <strong >{selectedStats.memoDays}</strong> 天有备忘记录
              </div>
              <div className="text-sm text-gray-500 mt-1">
                活跃度 <strong >{selectedStats.memoRate}%</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-20" />
    </div>
  );
}
