'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { SkinTheme } from '@/lib/skins';

interface WeeklyReviewTimelineProps {
  year: number;
  skin: SkinTheme;
  onOpenDayReview: (month: number, day: number) => void;
}

interface DayReview {
  date: Date;
  year: number;
  month: number;
  day: number;
  completed: string;
  goodThings: string;
  problems: string;
  mood: string;
  reflections: string;
  tomorrowTodo: string;
  totalLength: number;
  fieldLengths: Record<string, number>;
  hasContent: boolean;
}

interface MiningResult {
  heatmap: Array<{ field: string; label: string; cells: Array<{ length: number; filled: boolean }> }>;
  totalFilledCells: number;
  totalCells: number;
  fieldFilledCount: Record<string, number>;
  fieldFillRate: Record<string, number>;
  totalItems: number;
  filledDays: number;
  mostProductiveDayIndex: number;
  leastProductiveDayIndex: number;
  themes: Array<{ text: string; count: number }>;
  topProblems: Array<{ text: string; count: number }>;
}

const FIELD_ORDER: Array<keyof typeof FIELD_LABELS> = ['completed', 'goodThings', 'problems', 'mood', 'reflections', 'tomorrowTodo'];
const FIELD_LABELS: Record<string, string> = {
  completed: '完成',
  goodThings: '美好',
  problems: '问题',
  mood: '心情',
  reflections: '感想',
  tomorrowTodo: '明日',
};

// === Week calculation helpers ===

function getFirstWeekStart(year: number): Date {
  const jan1 = new Date(year, 0, 1);
  jan1.setHours(0, 0, 0, 0);
  const dow = jan1.getDay(); // 0=Sun, 1=Mon, ...
  const backToMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(jan1);
  monday.setDate(jan1.getDate() - backToMonday);
  return monday;
}

function getWeekStart(year: number, weekIndex: number): Date {
  const firstMonday = getFirstWeekStart(year);
  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (weekIndex - 1) * 7);
  return monday;
}

function getTotalWeeks(year: number): number {
  const dec31 = new Date(year, 11, 31);
  dec31.setHours(0, 0, 0, 0);
  const firstMonday = getFirstWeekStart(year);
  const lastMondayDate = new Date(dec31);
  const dow = dec31.getDay();
  const backToMonday = dow === 0 ? 6 : dow - 1;
  lastMondayDate.setDate(dec31.getDate() - backToMonday);
  const diffDays = Math.floor((lastMondayDate.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000));
  return Math.round(diffDays / 7) + 1;
}

function getCurrentWeekIndex(year: number): number {
  const now = new Date();
  if (now.getFullYear() !== year) return 1;
  const firstMonday = getFirstWeekStart(year);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateRange(start: Date, end: Date): string {
  return `${start.getFullYear()}/${formatMonthDay(start)} - ${formatMonthDay(end)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// === Data fetching ===

async function fetchDayReview(year: number, month: number, day: number): Promise<DayReview | null> {
  try {
    const res = await fetch(`/api/daily-review?year=${year}&month=${month}&day=${day}`);
    if (!res.ok) return null;
    const data = await res.json();
    const fieldLengths: Record<string, number> = {
      completed: (data.completed || '').length,
      goodThings: (data.goodThings || '').length,
      problems: (data.problems || '').length,
      mood: (data.mood || '').length,
      reflections: (data.reflections || '').length,
      tomorrowTodo: (data.tomorrowTodo || '').length,
    };
    const totalLength = Object.values(fieldLengths).reduce((a, b) => a + b, 0);
    return {
      date: new Date(year, month - 1, day),
      year, month, day,
      completed: data.completed || '',
      goodThings: data.goodThings || '',
      problems: data.problems || '',
      mood: data.mood || '',
      reflections: data.reflections || '',
      tomorrowTodo: data.tomorrowTodo || '',
      totalLength,
      fieldLengths,
      hasContent: totalLength > 0,
    };
  } catch {
    return null;
  }
}

async function fetchWeekData(year: number, weekStart: Date): Promise<DayReview[]> {
  const promises: Promise<DayReview | null>[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    promises.push(fetchDayReview(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  }
  const results = await Promise.all(promises);
  return results.filter((d): d is DayReview => d !== null);
}

// === Mining analysis ===

// Split a multi-line text into items, dedupe, count
function extractTopItems(texts: string[], maxItems: number = 5): Array<{ text: string; count: number }> {
  const counter = new Map<string, number>();
  for (const text of texts) {
    if (!text) continue;
    // Split by line breaks, punctuation, "、" "。" "，" "；"
    const items = text
      .split(/[\n\r。；;、,，]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 2);
    for (const item of items) {
      const normalized = item.replace(/\s+/g, '');
      if (normalized.length < 2) continue;
      counter.set(normalized, (counter.get(normalized) || 0) + 1);
    }
  }
  return Array.from(counter.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxItems);
}

// Extract themes from "completed" texts - dedupe similar items
function extractThemes(texts: string[], maxItems: number = 4): Array<{ text: string; count: number }> {
  return extractTopItems(texts, maxItems);
}

function computeMining(weekData: DayReview[]): MiningResult {
  const heatmap = FIELD_ORDER.map((field) => ({
    field,
    label: FIELD_LABELS[field],
    cells: weekData.map(d => ({
      length: d.fieldLengths[field] || 0,
      filled: !!(d as unknown as Record<string, string>)[field],
    })),
  }));

  const fieldFilledCount: Record<string, number> = {};
  const fieldFillRate: Record<string, number> = {};
  let totalFilledCells = 0;
  for (const field of FIELD_ORDER) {
    const cnt = weekData.filter(d => !!(d as unknown as Record<string, string>)[field]).length;
    fieldFilledCount[field] = cnt;
    fieldFillRate[field] = cnt / 7;
    totalFilledCells += cnt;
  }
  const totalCells = 7 * FIELD_ORDER.length;

  const totalItems = weekData.reduce((sum, d) => sum + Object.values(d.fieldLengths).filter(l => l > 0).length, 0);
  const filledDays = weekData.filter(d => d.hasContent).length;

  const dailyCounts = weekData.map(d => Object.values(d.fieldLengths).filter(l => l > 0).length);
  const maxCount = Math.max(...dailyCounts);
  const minCount = Math.min(...dailyCounts);
  const mostProductiveDayIndex = dailyCounts.indexOf(maxCount);
  const leastProductiveDayIndex = maxCount === minCount ? -1 : dailyCounts.indexOf(minCount);

  const completedTexts = weekData.map(d => d.completed);
  const themes = extractThemes(completedTexts, 5);

  const problemTexts = weekData.map(d => d.problems);
  const topProblems = extractTopItems(problemTexts, 5);

  return {
    heatmap,
    totalFilledCells,
    totalCells,
    fieldFilledCount,
    fieldFillRate,
    totalItems,
    filledDays,
    mostProductiveDayIndex,
    leastProductiveDayIndex,
    themes,
    topProblems,
  };
}

// === Components ===

function DayCard({ day, skin, onClick, isToday }: { day: DayReview; skin: SkinTheme; onClick: () => void; isToday: boolean }) {
  const filledFields = FIELD_ORDER.filter(f => !!(day as unknown as Record<string, string>)[f]).length;
  return (
    <div
      onClick={onClick}
      className="flex-1 min-w-0 rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col overflow-hidden"
      style={{
        backgroundColor: skin.cardBg,
        border: `1px solid ${isToday ? skin.swatch : skin.divider}`,
        boxShadow: isToday ? `0 0 0 2px ${skin.swatch}33` : 'none',
      }}
      title="点击编辑当日复盘"
    >
      {/* Date header - 固定高度 */}
      <div
        className="flex-shrink-0 px-3 py-2.5 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${skin.divider}` }}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold" style={{ color: skin.textPrimary }}>{day.date.getMonth() + 1}/{day.date.getDate()}</span>
          <span className="text-xs font-medium" style={{ color: skin.textMuted }}>
            {['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day.date.getDay()]}
          </span>
        </div>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded"
          style={{
            backgroundColor: filledFields > 0 ? `${skin.swatch}22` : skin.cardHover,
            color: filledFields > 0 ? skin.swatch : skin.textMuted,
          }}
        >
          {filledFields}/6
        </span>
      </div>

      {/* 6 fields - 每项 flex-1 均分剩余高度 */}
      <div className="flex-1 min-h-0 px-3 py-2 flex flex-col gap-1 overflow-hidden">
        {FIELD_ORDER.map((field) => {
          const text = (day as unknown as Record<string, string>)[field] || '';
          const filled = !!text;
          return (
            <div key={field} className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
              <div
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold leading-none"
                style={{ color: filled ? skin.textSecondary : skin.textMuted }}
              >
                <span
                  className="w-3.5 h-3.5 flex-shrink-0 rounded-sm flex items-center justify-center text-[10px] font-bold"
                  style={{
                    backgroundColor: filled ? skin.checkColor : skin.cardHover,
                    color: filled ? 'white' : skin.textMuted,
                  }}
                >
                  {filled ? '✓' : ''}
                </span>
                <span>{FIELD_LABELS[field]}</span>
              </div>
              <div
                className="flex-1 min-h-0 text-sm leading-snug overflow-hidden"
                style={{
                  color: filled ? skin.textPrimary : skin.textMuted,
                  opacity: filled ? 1 : 0.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-word',
                }}
                title={text}
              >
                {text || '——'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeatmapModule({ mining, weekData, skin }: { mining: MiningResult | null; weekData: DayReview[]; skin: SkinTheme }) {
  if (!mining) return <ModuleFrame skin={skin} title="完成度密度" />;
  // max length per cell for color scaling
  const maxLen = Math.max(1, ...mining.heatmap.flatMap(row => row.cells.map(c => c.length)));
  return (
    <ModuleFrame skin={skin} title="完成度密度" subtitle="色深 = 字数">
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <div className="grid gap-1" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          {/* Header row */}
          <div />
          {weekData.map((d, i) => (
            <div key={i} className="text-xs text-center font-semibold" style={{ color: skin.textMuted }}>
              {['一', '二', '三', '四', '五', '六', '日'][d.date.getDay() === 0 ? 6 : d.date.getDay() - 1]}
            </div>
          ))}
          {mining.heatmap.map((row) => (
            <div key={`row-${row.field}`} className="contents">
              <div className="text-xs pr-1.5 text-right font-medium" style={{ color: skin.textSecondary }}>
                {row.label}
              </div>
              {row.cells.map((cell, i) => {
                const intensity = cell.length / maxLen;
                const opacity = cell.filled ? 0.15 + intensity * 0.75 : 0;
                return (
                  <div
                    key={`${row.field}-${i}`}
                    className="h-7 rounded-sm flex items-center justify-center text-xs font-mono font-semibold"
                    style={{
                      backgroundColor: cell.filled ? skin.swatch : skin.cardHover,
                      opacity: cell.filled ? 0.3 + intensity * 0.7 : 1,
                      color: intensity > 0.5 ? 'white' : skin.textMuted,
                    }}
                    title={cell.filled ? `${row.label}: ${cell.length} 字` : `${row.label}: 空`}
                  >
                    {cell.filled ? cell.length : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </ModuleFrame>
  );
}

function StatsModule({ mining, weekData, skin }: { mining: MiningResult | null; weekData: DayReview[]; skin: SkinTheme }) {
  if (!mining) return <ModuleFrame skin={skin} title="完成度统计" />;
  const maxBar = Math.max(1, ...Object.values(mining.fieldFilledCount));
  return (
    <ModuleFrame skin={skin} title="本周完成度统计" subtitle={`总条数 ${mining.totalItems} · 填写天数 ${mining.filledDays}/7`}>
      <div className="flex-1 flex flex-col gap-2.5 min-h-0">
        {/* Day stats */}
        <div className="flex gap-3 text-sm" style={{ color: skin.textSecondary }}>
          <span>最强: <b style={{ color: skin.swatch }}>{mining.mostProductiveDayIndex >= 0 ? `周${['一','二','三','四','五','六','日'][weekData[mining.mostProductiveDayIndex].date.getDay() === 0 ? 6 : weekData[mining.mostProductiveDayIndex].date.getDay() - 1]}` : '—'}</b></span>
          {mining.leastProductiveDayIndex >= 0 && mining.leastProductiveDayIndex !== mining.mostProductiveDayIndex && (
            <span>最弱: <b style={{ color: skin.textMuted }}>{`周${['一','二','三','四','五','六','日'][weekData[mining.leastProductiveDayIndex].date.getDay() === 0 ? 6 : weekData[mining.leastProductiveDayIndex].date.getDay() - 1]}`}</b></span>
          )}
        </div>
        {/* 6 field bar chart */}
        <div className="flex-1 flex flex-col justify-center gap-1.5 min-h-0">
          {FIELD_ORDER.map((field) => {
            const count = mining.fieldFilledCount[field];
            const pct = count / 7;
            return (
              <div key={field} className="flex items-center gap-2 text-sm">
                <span className="w-9 flex-shrink-0 text-right font-medium" style={{ color: skin.textSecondary }}>{FIELD_LABELS[field]}</span>
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: skin.cardHover }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct * 100}%`, backgroundColor: skin.swatch, opacity: 0.4 + pct * 0.6 }}
                  />
                </div>
                <span className="w-10 flex-shrink-0 font-mono text-xs text-right" style={{ color: skin.textMuted }}>{count}/7</span>
              </div>
            );
          })}
        </div>
      </div>
    </ModuleFrame>
  );
}

function ThemesModule({ mining, skin }: { mining: MiningResult | null; skin: SkinTheme }) {
  if (!mining) return <ModuleFrame skin={skin} title="完成内容 + TOP 问题" />;
  return (
    <ModuleFrame skin={skin} title="完成内容 + TOP 问题">
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        {/* Themes */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="text-sm font-semibold mb-1.5" style={{ color: skin.textSecondary }}>本周主要完成</div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {mining.themes.length === 0 ? (
              <div className="text-sm" style={{ color: skin.textMuted }}>本周完成项为空</div>
            ) : (
              <ul className="space-y-1.5">
                {mining.themes.map((t, i) => (
                  <li key={i} className="text-sm flex items-baseline gap-2" style={{ color: skin.textPrimary }}>
                    <span className="w-3.5 flex-shrink-0 text-center font-mono text-xs" style={{ color: skin.swatch }}>{(i + 1)}</span>
                    <span className="flex-1 min-w-0 truncate" title={t.text}>{t.text}</span>
                    {t.count > 1 && <span className="text-xs flex-shrink-0 font-mono" style={{ color: skin.textMuted }}>×{t.count}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {/* Top problems */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="text-sm font-semibold mb-1.5" style={{ color: skin.textSecondary }}>TOP 问题</div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {mining.topProblems.length === 0 ? (
              <div className="text-sm" style={{ color: skin.textMuted }}>本周无问题</div>
            ) : (
              <ul className="space-y-1.5">
                {mining.topProblems.map((p, i) => (
                  <li key={i} className="text-sm flex items-baseline gap-2" style={{ color: skin.textPrimary }}>
                    <span className="w-3.5 flex-shrink-0 text-center font-mono text-xs" style={{ color: skin.crossColor }}>{(i + 1)}</span>
                    <span className="flex-1 min-w-0 truncate" title={p.text}>{p.text}</span>
                    {p.count > 1 && <span className="text-xs flex-shrink-0 font-mono" style={{ color: skin.textMuted }}>×{p.count}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </ModuleFrame>
  );
}

function ModuleFrame({ skin, title, subtitle, children }: { skin: SkinTheme; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col min-h-0 overflow-hidden"
      style={{ backgroundColor: skin.cardBg, border: `1px solid ${skin.divider}` }}
    >
      <div className="flex items-baseline justify-between mb-2.5 flex-shrink-0">
        <h3 className="text-sm font-bold" style={{ color: skin.textPrimary }}>{title}</h3>
        {subtitle && <span className="text-xs" style={{ color: skin.textMuted }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function DotsNav({ total, current, onJump, skin }: { total: number; current: number; onJump: (w: number) => void; skin: SkinTheme }) {
  const dots = useMemo(() => {
    const arr: number[] = [];
    for (let i = 1; i <= total; i++) arr.push(i);
    return arr;
  }, [total]);
  return (
    <div className="flex items-center justify-center gap-0.5 px-4 py-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {dots.map((w) => (
        <button
          key={w}
          onClick={() => onJump(w)}
          className="flex-shrink-0 rounded-full transition-all"
          style={{
            width: w === current ? 18 : 5,
            height: 5,
            backgroundColor: w === current ? skin.swatch : `${skin.swatch}40`,
          }}
          title={`第 ${w} 周`}
        />
      ))}
    </div>
  );
}

// === Main Component ===

export default function WeeklyReviewTimeline({ year, skin, onOpenDayReview }: WeeklyReviewTimelineProps) {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weekData, setWeekData] = useState<DayReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [inView, setInView] = useState(false);
  const [transition, setTransition] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  const totalWeeks = useMemo(() => getTotalWeeks(year), [year]);

  // Init to current week
  useEffect(() => {
    setCurrentWeek(getCurrentWeekIndex(year));
  }, [year]);

  // IntersectionObserver
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setInView(entry.isIntersecting && entry.intersectionRatio > 0.3);
        });
      },
      { threshold: [0, 0.3, 0.5, 0.7, 1] }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Fetch week data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const weekStart = getWeekStart(year, currentWeek);
    fetchWeekData(year, weekStart).then((data) => {
      if (!cancelled) {
        setWeekData(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [year, currentWeek]);

  const goPrev = useCallback(() => {
    setCurrentWeek((w) => {
      if (w <= 1) return w;
      setTransition('right');
      setTimeout(() => setTransition(null), 350);
      return w - 1;
    });
  }, []);

  const goNext = useCallback(() => {
    setCurrentWeek((w) => {
      if (w >= totalWeeks) return w;
      setTransition('left');
      setTimeout(() => setTransition(null), 350);
      return w + 1;
    });
  }, [totalWeeks]);

  // Wheel handler (only when in view)
  useEffect(() => {
    if (!inView) return;
    let lastFire = 0;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastFire < 400) return;
      if (Math.abs(e.deltaY) < 20) return;
      lastFire = now;
      if (e.deltaY > 0) goNext();
      else goPrev();
    };
    const node = containerRef.current;
    if (!node) return;
    node.addEventListener('wheel', handler, { passive: false });
    return () => node.removeEventListener('wheel', handler);
  }, [inView, goPrev, goNext]);

  // Touch/drag handlers
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) goNext();
        else goPrev();
      }
      touchStartX.current = null;
      touchStartY.current = null;
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, [data-no-drag]')) return;
      dragStartX.current = e.clientX;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (dragStartX.current === null) return;
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) > 80) {
        if (dx < 0) goNext();
        else goPrev();
      }
      dragStartX.current = null;
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchend', onTouchEnd, { passive: true });
    node.addEventListener('mousedown', onMouseDown);
    node.addEventListener('mouseup', onMouseUp);

    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('mousedown', onMouseDown);
      node.removeEventListener('mouseup', onMouseUp);
    };
  }, [goPrev, goNext]);

  // Keyboard handlers
  useEffect(() => {
    if (!inView) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inView, goPrev, goNext]);

  const mining = useMemo(() => (weekData.length > 0 ? computeMining(weekData) : null), [weekData]);
  const weekStart = useMemo(() => getWeekStart(year, currentWeek), [year, currentWeek]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 6);
    return d;
  }, [weekStart]);
  const todayKey = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-screen flex flex-col overflow-hidden select-none"
      style={{ backgroundColor: skin.bodyBg, cursor: dragStartX.current !== null ? 'grabbing' : 'default' }}
    >
      {/* Top bar */}
      <div
        className="flex-shrink-0 px-6 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${skin.divider}` }}
      >
        <button
          onClick={goPrev}
          disabled={currentWeek <= 1}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
          style={{ color: skin.textPrimary, backgroundColor: skin.cardBg, border: `1px solid ${skin.divider}` }}
        >
          ← 上一周
        </button>
        <div className="flex flex-col items-center">
          <div className="text-base font-bold flex items-center gap-2" style={{ color: skin.textPrimary }}>
            <span style={{ color: skin.swatch }}>第 {currentWeek}</span>
            <span>周</span>
            <span className="text-sm font-mono" style={{ color: skin.textMuted }}>· {formatDateRange(weekStart, weekEnd)}</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: skin.textMuted }}>
            {loading ? '加载中...' : mining ? `本周已写 ${mining.totalItems} 条 · ${mining.filledDays}/7 天` : '暂无数据'}
          </div>
        </div>
        <button
          onClick={goNext}
          disabled={currentWeek >= totalWeeks}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
          style={{ color: skin.textPrimary, backgroundColor: skin.cardBg, border: `1px solid ${skin.divider}` }}
        >
          下一周 →
        </button>
      </div>

      {/* Cards row */}
      <div
        className="flex-1 flex gap-2 px-3 py-2 overflow-hidden min-h-0 transition-all duration-300"
        style={{
          transform: transition === 'left' ? 'translateX(-20px)' : transition === 'right' ? 'translateX(20px)' : 'none',
          opacity: transition ? 0 : 1,
        }}
        data-no-drag
      >
        {weekData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: skin.textMuted }}>
            {loading ? '加载本周复盘中...' : '本周无复盘数据'}
          </div>
        ) : (
          weekData.map((day) => (
            <DayCard
              key={`${day.year}-${day.month}-${day.day}`}
              day={day}
              skin={skin}
              isToday={`${day.year}-${day.month}-${day.day}` === todayKey}
              onClick={() => onOpenDayReview(day.month, day.day)}
            />
          ))
        )}
      </div>

      {/* Mining area */}
      <div className="flex-shrink-0 grid grid-cols-3 gap-2 px-3 pb-2" style={{ height: '200px' }}>
        <HeatmapModule mining={mining} weekData={weekData} skin={skin} />
        <StatsModule mining={mining} weekData={weekData} skin={skin} />
        <ThemesModule mining={mining} skin={skin} />
      </div>

      {/* Bottom dots nav */}
      <div className="flex-shrink-0" style={{ borderTop: `1px solid ${skin.divider}` }}>
        <DotsNav total={totalWeeks} current={currentWeek} onJump={setCurrentWeek} skin={skin} />
      </div>
    </div>
  );
}
