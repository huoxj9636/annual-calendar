'use client';

import { apiFetch, apiFire } from '@/lib/api-client';
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { getLunarInfo, getYearAnimal, getGanZhiYear } from '@/lib/lunar';
import MonthlyReview from '@/components/monthly-review';
import LifeCalendar from '@/components/life-calendar';
import AchievementPanel from '@/components/achievement-panel';
import { SKINS, NO_SKIN, DEFAULT_SKIN, generateMonthColors } from '@/lib/skins';
import ParticleEffect from '@/components/particle-effect';
import { LoginButton } from '@/components/auth/login-button';
import DrawingOverlay, { DrawingOverlayHandle } from '@/components/drawing-overlay';
import TimelinePanel from '@/components/timeline-panel';
import InsightPanel from '@/components/insight-panel';
import { AnalogClock } from '@/components/analog-clock';
import TrackPanel from '@/components/track-panel';
import DailyReview from '@/components/daily-review';
import KnowledgePanel from '@/components/knowledge-panel';
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
  const [monthReviewData, setMonthReviewData] = useState<Record<string, string>>({});
  const [reviewLeft, setReviewLeft] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('panel-left-review');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  const [clockStr, setClockStr] = useState('');
  const [clockMode, setClockMode] = useState<'digital' | 'analog'>('analog');
  const popupRef = useRef<HTMLDivElement>(null);
  const toggleClockMode = () => {
    setClockMode(prev => {
      const next = prev === 'digital' ? 'analog' : 'digital';
      localStorage.setItem('clock-mode', next);
      return next;
    });
  };
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridInnerRef = useRef<HTMLDivElement>(null);
  const [cellHeight, setCellHeight] = useState(66);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<DrawingOverlayHandle>(null);
  const isSnapping = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const timelineOpenRef = useRef(false);
  const [showLifeCalendar, setShowLifeCalendar] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [birthYear, setBirthYear] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendar-birth-year');
      if (saved) return Number(saved);
    }
    return 1990;
  });
  const handleSetBirthYear = (year: number) => {
    setBirthYear(year);
    localStorage.setItem('calendar-birth-year', String(year));
  };
  const [skinKey, setSkinKey] = useState<string>(DEFAULT_SKIN);
  const [showSkinPicker, setShowSkinPicker] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [, setDrawingHasStrokes] = useState(false);
  const [drawingVisible, setDrawingVisible] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const [drawingColor, setDrawingColor] = useState('#ef4444');
  const [drawingTool, setDrawingTool] = useState<'pen' | 'eraser'>('pen');
  const [motto, setMotto] = useState('永远不要放弃');
  const [editingMotto, setEditingMotto] = useState(false);
  const [mottoDraft, setMottoDraft] = useState('');
  const [timelineMonth, setTimelineMonth] = useState(() => new Date().getMonth() + 1);
  const [reviewStartDate, setReviewStartDate] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('calendar-review-start-date') || '';
    return '';
  });
  const [reviewDays, setReviewDays] = useState<Set<string>>(new Set());
  const [achievementDays, setAchievementDays] = useState<Set<string>>(new Set()); // 有成果物的日期

  // 后台导入任务
  const [bgTasks, setBgTasks] = useState<Array<{
    id: string; status: string; total: number; processed: number; saved: number;
    progress: number; createdAt: number; updatedAt: number; error?: string;
  }>>([]);
  const [showBgTasks, setShowBgTasks] = useState(false);

  // Refresh reviewDays from DB
  const refreshReviewDays = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/daily-review?year=${year}&action=list-days`);
      if (res) {
        const data = res;
        if (Array.isArray(data.days)) {
          setReviewDays(new Set(data.days));
        }
      }
    } catch { /* ignore */ }
  }, [year]);

  // 从 localStorage 扫描有成果物的日期
  const scanAchievementDays = useCallback(() => {
    const days = new Set<string>();
    // 扫描 localStorage 中所有 achievements-{year}-{month}-{day} 键
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('achievements-')) {
        // 格式: achievements-{year}-{month}-{day}
        const datePart = key.replace('achievements-', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(data) && data.length > 0) {
            days.add(datePart);
          }
        } catch { /* ignore parse error */ }
      }
    }
    setAchievementDays(days);
  }, []);
  const updateReviewStartDate = (date: string) => {
    setReviewStartDate(date);
    localStorage.setItem('calendar-review-start-date', date);
  };
  const [timelineDay, setTimelineDay] = useState(() => new Date().getDate());
  const [dailyReviewOpen, setDailyReviewOpen] = useState(false);
  const [dailyReviewMonth, setDailyReviewMonth] = useState(() => new Date().getMonth() + 1);
  const [dailyReviewDay, setDailyReviewDay] = useState(() => new Date().getDate());
  const [insightOpen, setInsightOpen] = useState(false);
  const [insightMonth, setInsightMonth] = useState(() => new Date().getMonth() + 1);
  const [insightDay, setInsightDay] = useState(() => new Date().getDate());
  const [trackOpen, setTrackOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Auto-open daily review at 18:00 (only if no review content exists for today)
  useEffect(() => {
    if (!mounted) return;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const shownKey = `daily-review-shown-${todayKey}`;
    if (localStorage.getItem(shownKey)) return; // already shown today

    const checkAndShow = async () => {
      if (localStorage.getItem(shownKey)) return; // already shown today
      const now = new Date();
      if (now.getHours() >= 18) {
        // Check if today already has review content
        try {
          const res = await apiFetch(`/api/daily-review?year=${now.getFullYear()}&month=${now.getMonth() + 1}&day=${now.getDate()}`);
          if (res) {
            const data = res;
            const hasContent = data.completed || data.goodThings || data.problems || data.mood || data.reflections || data.tomorrowTodo;
            if (hasContent) {
              // Already has review content, don't auto-open
              localStorage.setItem(shownKey, '1');
              return;
            }
          }
        } catch {
          // If API fails, proceed to show anyway
        }
        setDailyReviewMonth(now.getMonth() + 1);
        setDailyReviewDay(now.getDate());
        setDailyReviewOpen(true);
        localStorage.setItem(shownKey, '1');
      }
    };

    // If already past 18:00, check and show
    checkAndShow();

    // Otherwise, check every minute
    const timer = setInterval(() => {
      checkAndShow();
    }, 60000);

    return () => clearInterval(timer);
  }, [mounted]);
  const [moduleVisibility, setModuleVisibility] = useState<Record<string, boolean>>({
    timeline: true, dida: true, longterm: true, bilibili: true, insight: true, track: true, review: true, achievement: true,
  });
  const [moduleLinks, setModuleLinks] = useState<Record<string, string>>({
    timeline: '',
    dida: 'https://dida365.com/webapp/#q/all/timeline',
    longterm: '',
    bilibili: 'https://www.bilibili.com',
    insight: '',
    track: '',
    review: '',
    achievement: '',
  });
  const defaultModuleNames: Record<string, string> = { timeline: '日程', dida: '滴答', longterm: '长程', bilibili: 'B站', insight: '洞察', track: '轨迹', review: '复盘', achievement: '成果' };
  const [moduleNames, setModuleNames] = useState<Record<string, string>>(() => {
    try { return { ...defaultModuleNames, ...JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('calendar-module-names') || '{}' : '{}') }; } catch { return defaultModuleNames; }
  });
  const defaultModuleOrder = ['timeline', 'dida', 'longterm', 'review', 'achievement', 'bilibili', 'insight', 'track'];
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAchievement, setShowAchievement] = useState(false);
  const moreHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreButtonRef = useRef<HTMLDivElement | null>(null);
  const [moreMenuPos, setMoreMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [moduleOrder, setModuleOrder] = useState<string[]>(defaultModuleOrder);
  const [bookmarks, setBookmarks] = useState<BM[]>(() => {
    try { return JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('calendar-bookmarks') || '[]' : '[]'); } catch { return []; }
  });
  useEffect(() => { if (mounted) localStorage.setItem('calendar-bookmarks', JSON.stringify(bookmarks)); }, [bookmarks, mounted]);
  // 获取模块名称：优先 bookmarks，其次 moduleNames
  const getModuleName = (key: string) => {
    const bm = bookmarks.find(b => b.id === key);
    if (bm) return bm.name;
    return (mounted ? (moduleNames[key] || defaultModuleNames[key]) : defaultModuleNames[key]) || key;
  };

  // 所有模块列表（用于"更多"弹窗）：内建6个 + 自定义
  const builtinModules = [
    { id: 'timeline', label: '日程' },
    { id: 'dida', label: '滴答' },
    { id: 'longterm', label: '长程' },
    { id: 'review', label: '复盘' },
    { id: 'achievement', label: '成果' },
    { id: 'bilibili', label: 'B站' },
    { id: 'insight', label: '洞察' },
    { id: 'track', label: '轨迹' },
  ];
  // 按 moduleOrder 排序后的所有项
  const allModuleIds = useMemo(() => {
    const ids: string[] = [];
    for (const k of moduleOrder) {
      if (builtinModules.some(m => m.id === k) || bookmarks.some(b => b.id === k)) ids.push(k);
    }
    // 追加新增但未在 moduleOrder 里的
    for (const m of builtinModules) if (!ids.includes(m.id)) ids.push(m.id);
    for (const b of bookmarks) if (!ids.includes(b.id)) ids.push(b.id);
    return ids;
  }, [moduleOrder, bookmarks]);
  const getModuleInfo = (id: string) => {
    const bm = builtinModules.find(m => m.id === id);
    if (bm) return { id, label: bm.label, isBuiltin: true };
    const b = bookmarks.find(x => x.id === id);
    if (b) return { id, label: b.name, isBuiltin: false };
    return { id, label: id, isBuiltin: false };
  };

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
  const skin = useMemo(() => mounted ? (skinKey ? (SKINS.find(s => s.key === skinKey) ?? NO_SKIN) : NO_SKIN) : NO_SKIN, [skinKey, mounted]);
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

  // Load data from API on mount
  useEffect(() => {
    const now = new Date();
    setTodayStr(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    );

    // Load UI preferences from localStorage synchronously before mounting
    try {
      const savedSkin = localStorage.getItem('life-calendar-skin');
      if (savedSkin && SKINS.find(s => s.key === savedSkin)) setSkinKey(savedSkin);

      const savedMotto = localStorage.getItem('calendar-motto');
      if (savedMotto) setMotto(savedMotto);

      const savedLinks = localStorage.getItem('calendar-module-links');
      if (savedLinks) {
        try { setModuleLinks(prev => ({ ...prev, ...JSON.parse(savedLinks) })); } catch { /* ignore */ }
      }

      const savedVisibility = localStorage.getItem('calendar-module-visibility');
      if (savedVisibility) {
        try { setModuleVisibility(prev => ({ ...prev, ...JSON.parse(savedVisibility) })); } catch { /* ignore */ }
      }

      const savedNames = localStorage.getItem('calendar-module-names');
      if (savedNames) {
        try { setModuleNames(prev => ({ ...prev, ...JSON.parse(savedNames) })); } catch { /* ignore */ }
      }

      const savedOrder = localStorage.getItem('calendar-module-order');
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder) as string[];
          const allKeys = Object.keys(defaultModuleNames);
          const validOrder = parsed.filter(k => allKeys.includes(k));
          const missing = allKeys.filter(k => !validOrder.includes(k));
          setModuleOrder([...validOrder, ...missing]);
        } catch { /* ignore */ }
      }

      const savedDrawing = localStorage.getItem(`calendar-drawing-${year}`);
      if (savedDrawing) {
        try {
          const data = JSON.parse(savedDrawing);
          setDrawingHasStrokes(data.strokes && data.strokes.length > 0);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    // Read clockMode from localStorage before mounting
    const savedClockMode = localStorage.getItem('clock-mode');
    if (savedClockMode === 'analog' || savedClockMode === 'digital') {
      setClockMode(savedClockMode);
    }

    // Now set mounted - all localStorage values are already in state
    setMounted(true);

    // 扫描有成果物的日期
    scanAchievementDays();

    // Load data from DB asynchronously (with localStorage migration)
    (async () => {
      try {
        // Load review days (dates that have daily review content)
        try {
          const reviewDaysRes = await apiFetch(`/api/daily-review?year=${year}&action=list-days`);
          if (reviewDaysRes) {
            const reviewDaysData = reviewDaysRes;
            if (Array.isArray(reviewDaysData.days)) {
              setReviewDays(new Set(reviewDaysData.days));
            }
          }
        } catch { /* ignore */ }

        // Load overrides from DB
        const overridesRes = await apiFetch(`/api/calendar-data?type=overrides&year=${year}`);
        if (overridesRes) {
          const overridesData = overridesRes;
          if (Object.keys(overridesData).length > 0) {
            setOverrides(overridesData);
            // eslint-disable-next-line react-hooks/immutability
            overridesLoadedRef.current = true;
          } else {
            // Migrate from localStorage if DB is empty
            try {
              const lsData = localStorage.getItem(`calendar-overrides-${year}`);
              if (lsData) {
                const lsOverrides = JSON.parse(lsData);
                if (typeof lsOverrides === 'object' && Object.keys(lsOverrides).length > 0) {
                  setOverrides(lsOverrides);
                  // eslint-disable-next-line react-hooks/immutability
                  overridesLoadedRef.current = true;
                  await apiFetch('/api/calendar-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'overrides', year, data: lsOverrides }),
                  });
                  localStorage.removeItem(`calendar-overrides-${year}`);
                }
              }
            } catch { /* ignore */ }
          }
        }

        // Load notes from DB
        const notesRes = await apiFetch(`/api/calendar-data?type=notes&year=${year}`);
        if (notesRes) {
          const notesData = notesRes;
          if (Object.keys(notesData).length > 0) {
            setNotes(notesData);
            // eslint-disable-next-line react-hooks/immutability
            notesLoadedRef.current = true;
          } else {
            // Migrate from localStorage if DB is empty
            try {
              const lsData = localStorage.getItem(`calendar-notes-${year}`);
              if (lsData) {
                const lsNotes = JSON.parse(lsData);
                if (typeof lsNotes === 'object' && Object.keys(lsNotes).length > 0) {
                  setNotes(lsNotes);
                  // eslint-disable-next-line react-hooks/immutability
                  notesLoadedRef.current = true;
                  await apiFetch('/api/calendar-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'notes', year, data: lsNotes }),
                  });
                  localStorage.removeItem(`calendar-notes-${year}`);
                }
              }
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    })();
  }, [year]);

  // Save overrides to DB (skip first render after mount to avoid overwriting with empty {})
  const overridesLoadedRef = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    if (!overridesLoadedRef.current) {
      if (Object.keys(overrides).length > 0) {
        // eslint-disable-next-line react-hooks/immutability
        overridesLoadedRef.current = true;
      } else {
        return;
      }
    }
    apiFire('/api/calendar-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'overrides', year, data: overrides }),
    });
  }, [overrides, year, mounted]);

  // Save notes to DB
  const notesLoadedRef = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    if (!notesLoadedRef.current) {
      if (Object.keys(notes).length > 0) {
        // eslint-disable-next-line react-hooks/immutability
        notesLoadedRef.current = true;
      } else {
        return;
      }
    }
    apiFire('/api/calendar-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'notes', year, data: notes }),
    });
  }, [notes, year, mounted]);

  // Load month review data when selectedMonth changes
  useEffect(() => {
    if (selectedMonth === null) return;
    apiFetch(`/api/calendar-data?type=month-review&year=${year}&month=${selectedMonth}`)
      .then(res => res.ok ? res.json() : {})
      .then(data => setMonthReviewData(data))
      .catch(() => {});
  }, [selectedMonth, year]);

  // Save module visibility to localStorage
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('calendar-module-visibility', JSON.stringify(moduleVisibility));
    } catch { /* ignore */ }
  }, [moduleVisibility, mounted]);

  // Save module links to localStorage
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('calendar-module-links', JSON.stringify(moduleLinks));
    } catch { /* ignore */ }
  }, [moduleLinks, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('calendar-module-names', JSON.stringify(moduleNames));
    } catch { /* ignore */ }
  }, [moduleNames, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('calendar-module-order', JSON.stringify(moduleOrder));
    } catch { /* ignore */ }
  }, [moduleOrder, mounted]);

  

  // 后台任务轮询：每3秒检查一次任务状态
  useEffect(() => {
    if (!mounted) return;
    const poll = async () => {
      try {
        const res = await apiFetch('/api/import-review?action=tasks');
        if (res) {
          const data = res;
          setBgTasks(data.tasks || []);
          // 如果有正在进行的任务，刷新reviewDays
          const hasActive = (data.tasks || []).some((t: { status: string }) => t.status === 'processing' || t.status === 'pending');
          if (!hasActive && (data.tasks || []).some((t: { status: string }) => t.status === 'completed')) {
            // 有刚完成的任务，刷新数据
            refreshReviewDays();
          }
        }
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [mounted, refreshReviewDays]);

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

      // Skip snap when any overlay panel is open
      if (timelineOpenRef.current || insightOpen || trackOpen || showAchievement) return;
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
  }, [timelineOpen]);

  // Lock scroll position when timeline is open (belt-and-suspenders)
  useEffect(() => {
    const anyPanelOpen = timelineOpen || insightOpen || trackOpen || showAchievement;
    if (anyPanelOpen && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const savedScroll = container.scrollTop;
      const lockScroll = () => {
        if ((timelineOpenRef.current || insightOpen || trackOpen || showAchievement) && container.scrollTop !== savedScroll) {
          container.scrollTop = savedScroll;
        }
      };
      container.addEventListener('scroll', lockScroll, { passive: true });
      return () => container.removeEventListener('scroll', lockScroll);
    }
  }, [timelineOpen, insightOpen, trackOpen, showAchievement]);

  const getDayStatus = useCallback(
    (month: number, day: number): 'checked' | 'crossed' | 'auto' | 'none' => {
      const key = `${year}-${month}-${day}`;
      if (overrides[key]) return overrides[key];
      // 当天不默认状态，只有昨天及之前才默认判断
      if (isDatePast(year, month, day)) {
        // If reviewStartDate is set and date >= startDate, default to crossed (✗) when no review content
        if (reviewStartDate) {
          const [sy, sm, sd] = reviewStartDate.split('-').map(Number);
          const dateNum = year * 10000 + month * 100 + day;
          const startNum = sy * 10000 + sm * 100 + sd;
          if (dateNum >= startNum) {
            // Check if this day has review content
            const hasContent = reviewDays.has(key);
            return hasContent ? 'auto' : 'crossed';
          }
        }
        return 'auto';
      }
      // 今天保持空白，等待用户填写
      if (isToday(year, month, day)) {
        return 'none';
      }
      return 'none';
    },
    [year, overrides, reviewStartDate, reviewDays],
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
    <div ref={scrollContainerRef} className="h-screen overflow-y-scroll" style={{ scrollbarWidth: 'none', overflowY: (timelineOpen || insightOpen || trackOpen || showAchievement) ? 'hidden' : 'scroll' }}>
      {/* Page 1: Calendar */}
      <div className="h-screen print:bg-white print:h-auto flex flex-col overflow-hidden relative"
      style={{ backgroundColor: skin.bodyBg }}>
      {/* Header */}
      <header className="flex-shrink-0 print:static print:border-b z-20 relative overflow-hidden">
        {skin.headerBgImage ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${skin.headerFrom} 0%, ${skin.headerTo} 100%)` }} />
        )}
        <div className="absolute inset-0" style={{ background: skin.headerBgOverlay }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.12) 50%, rgba(0,0,0,0.03) 100%)" }} />
        <ParticleEffect color={skin.swatch} count={50} />

        <div className="relative px-8 py-2 flex items-center justify-between flex-wrap gap-2 ">
          <div className="flex items-center gap-3 px-5 py-2.5">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="w-12 h-12 flex items-center justify-center rounded-lg transition-colors text-2xl font-bold"
              style={{ color: skin.textMuted }}
              onMouseEnter={e => { e.currentTarget.style.color = skin.swatch; e.currentTarget.style.backgroundColor = skin.cardHover; }}
              onMouseLeave={e => { e.currentTarget.style.color = skin.textMuted; e.currentTarget.style.backgroundColor = 'transparent'; }}
              aria-label="上一年"
            >
              ‹
            </button>
            <div className="flex items-center relative" style={{ minHeight: 72 }}>
              {/* 年份 - 始终固定 */}
              <h1 className="text-7xl font-black tracking-tighter leading-none"
              style={{ color: skin.textPrimary, textShadow: `0 1px 2px ${skin.swatch}15` }}>
                {year}
              </h1>
              <div className="flex flex-col ml-4 relative" style={{ minHeight: 72, marginTop: '-13pt' }}>
                {/* 第一层：时钟（绝对定位，与年份垂直居中） */}
                {mounted && (
                  <div
                    className="absolute left-0 top-0 bottom-0 flex items-center transition-opacity duration-200 ease-out pointer-events-auto"
                    style={{ opacity: clockMode === 'analog' ? 1 : 0, zIndex: 10, marginTop: '13pt', marginLeft: '8pt' }}
                    onClick={toggleClockMode}
                    title="切换到干支"
                  >
                    <AnalogClock size={72} color={skin.textPrimary} bgColor="transparent" />
                  </div>
                )}
                {/* 第二层：干支 + 时分秒（绝对定位，干支垂直居中与年份/按钮对齐） */}
                <div className="absolute left-0 top-0 bottom-0 flex items-center" style={{ zIndex: 5 }}>
                  <div className="relative">
                  <div
                    className="cursor-pointer select-none transition-opacity duration-200 ease-out"
                    style={{ opacity: clockMode === 'digital' ? 1 : 0 }}
                    onClick={toggleClockMode}
                    title="切换到时钟"
                  >
                    <span className="text-lg font-medium leading-tight whitespace-nowrap" style={{ color: skin.textSecondary }}>
                      {ganZhi}（{animal}）
                    </span>
                  </div>
                  {mounted && clockStr && (
                    <div
                      className="absolute top-full left-0 text-xl font-mono tracking-wider tabular-nums leading-tight transition-transform duration-300 ease-out"
                      style={{
                        color: skin.textPrimary,
                        opacity: 0.6,
                        transform: clockMode === 'analog' ? 'translateX(111px)' : 'translateX(0)',
                        marginTop: '2px',
                      }}
                    >
                      {clockStr}
                    </div>
                  )}
                  </div>
                </div>
                {/* 固定按钮行 - 绝对定位，与干支/时钟垂直居中对齐，紧跟其后 */}
                <div className="absolute left-[100px] top-0 bottom-0 flex items-center gap-3" style={{ zIndex: 3 }}>
                  <button
                    onClick={() => setYear(new Date().getFullYear())}
                    className="px-3 py-1 text-xs font-medium rounded-full transition-all cursor-pointer hover:opacity-80 whitespace-nowrap"
                    style={{ color: skin.textPrimary, backgroundColor: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    今年
                  </button>
                  {/* Skin picker toggle */}
                  <button
                    onClick={() => setShowSkinPicker(v => !v)}
                    className="w-5 h-5 rounded-full cursor-pointer transition-all hover:opacity-80 active:scale-95 flex-shrink-0"
                    style={{
                      backgroundColor: skin.swatch,
                      boxShadow: `0 0 0 1.5px rgba(255,255,255,0.5)`,
                    }}
                    title="切换皮肤"
                  />
                  {/* Drawing tool buttons */}
                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      onClick={() => {
                        const next = !drawingMode;
                        setDrawingMode(next);
                        if (drawingRef.current) drawingRef.current.setDrawingEnabled(next);
                      }}
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer hover:opacity-80 active:scale-95"
                      style={{
                        backgroundColor: drawingMode ? skin.swatch : 'rgba(255,255,255,0.18)',
                        color: drawingMode ? 'white' : skin.textSecondary,
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                      title={drawingMode ? '退出画笔' : '开启画笔'}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                    {drawingMode && (
                      <>
                        {['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'].map(c => (
                          <button
                            key={c}
                            onClick={() => { setDrawingColor(c); setDrawingTool('pen'); if (drawingRef.current) { drawingRef.current.setPenColor(c); drawingRef.current.setTool('pen'); } }}
                            className="w-4 h-4 rounded-full border transition-transform hover:scale-125 cursor-pointer"
                            style={{
                              backgroundColor: c,
                              borderColor: drawingColor === c && drawingTool === 'pen' ? 'white' : 'transparent',
                              borderWidth: '1.5px',
                            }}
                          />
                        ))}
                        <button
                          onClick={() => { const next = drawingTool === 'eraser' ? 'pen' : 'eraser'; setDrawingTool(next); if (drawingRef.current) drawingRef.current.setTool(next); }}
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer hover:opacity-80"
                          style={{
                            backgroundColor: drawingTool === 'eraser' ? skin.swatch : 'rgba(255,255,255,0.18)',
                            color: drawingTool === 'eraser' ? 'white' : skin.textSecondary,
                            border: '1px solid rgba(255,255,255,0.15)',
                          }}
                          title="橡皮擦"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.8 1.4c.8-.8 2-.8 2.8 0l5 5c.8.8.8 2 0 2.8L11 20" />
                          </svg>
                        </button>
                        <button
                          onClick={() => drawingRef.current?.handleUndo()}
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: skin.textSecondary, border: '1px solid rgba(255,255,255,0.15)' }}
                          title="撤销"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8" />
                            <path d="M7 6l-4 4 4 4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => drawingRef.current?.handleClear()}
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: skin.textSecondary, border: '1px solid rgba(255,255,255,0.15)' }}
                          title="清除全部"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                          </svg>
                        </button>
                      </>
                    )}
                      <button
                        onClick={() => { const next = !drawingVisible; setDrawingVisible(next); if (drawingRef.current) drawingRef.current.setOverlayVisible(next); }}
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer hover:opacity-80"
                        style={{
                          backgroundColor: drawingVisible ? 'rgba(255,255,255,0.18)' : `${skin.swatch}30`,
                          color: drawingVisible ? skin.textSecondary : skin.swatch,
                          border: '1px solid rgba(255,255,255,0.15)',
                        }}
                        title={drawingVisible ? '隐藏画迹' : '显示画迹'}
                      >
                        {drawingVisible ? (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                  </div>
                  {/* 后台任务按钮 */}
                  {bgTasks.filter(t => t.status === 'pending' || t.status === 'processing').length > 0 && (
                    <button
                      onClick={() => setShowBgTasks(v => !v)}
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer hover:opacity-80 relative"
                      style={{
                        backgroundColor: skin.swatch,
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                      title="后台任务"
                    >
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    </button>
                  )}
                  {/* 下一年按钮 */}
                  <button
                    onClick={() => setYear((y) => y + 1)}
                    className="w-12 h-12 flex items-center justify-center rounded-lg transition-colors text-2xl font-bold ml-2"
                    style={{ color: skin.textMuted, marginTop: '14pt' }}
                    onMouseEnter={e => { e.currentTarget.style.color = skin.swatch; e.currentTarget.style.backgroundColor = skin.cardHover; }}
                    onMouseLeave={e => { e.currentTarget.style.color = skin.textMuted; e.currentTarget.style.backgroundColor = 'transparent'; }}
                    aria-label="下一年"
                  >
                    ›
                  </button>
                </div>

                <LoginButton />

              </div>
            </div>
          </div>

          {/* 居中标语 */}
          <div className="absolute inset-x-0 flex justify-center pointer-events-none">
            <span
              className="pointer-events-auto select-none cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: skin.textPrimary, fontSize: 40, fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif', letterSpacing: '0.3em', fontWeight: 300, textShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
              onClick={() => { setMottoDraft(motto); setEditingMotto(true); }}
              title="点击修改标语"
            >
              {mounted ? motto : '年度计划'}
            </span>
          </div>

          {/* Legend & Stats + Settings */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-0.5 text-xs">
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
                <div className="flex items-center gap-2 text-gray-500">
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
            {/* Settings button */}
            {mounted && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 cursor-pointer ml-1"
                style={{
                  backgroundColor: skin.swatch + "18",
                  color: skin.swatch,
                }}
                title="设置"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Skin Picker Dropdown - outside header to avoid overflow-hidden clipping */}
      {showSkinPicker && (
        <div className="absolute top-0 left-0 right-0 z-50 animate-fade-in" onClick={() => setShowSkinPicker(false)}>
          <div className="mx-auto max-w-3xl px-6 pt-2 pb-4" onClick={e => e.stopPropagation()}>
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: skin.panelBg + 'f5', backdropFilter: 'blur(24px)', border: `1px solid ${skin.divider}` }}>
              <div className="px-4 pt-3 pb-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${skin.divider}` }}>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold tracking-wide" style={{ color: skin.textSecondary }}>选择皮肤</h3>
                  <button onClick={() => { setSkinKey(''); localStorage.removeItem('life-calendar-skin'); window.dispatchEvent(new CustomEvent('life-calendar-skin-changed')); }} className="text-xs px-2 py-0.5 rounded transition-colors cursor-pointer" style={{ color: skin.textMuted, backgroundColor: skin.divider + '40' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = skin.divider + '80'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = skin.divider + '40'; }}>默认{skinKey === '' && <span className="ml-1" style={{ color: skin.checkColor }}>✓</span>}</button>
                </div>
                <button onClick={() => setShowSkinPicker(false)} className="w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer text-sm" style={{ color: skin.textMuted, backgroundColor: skin.divider + '60' }}>&times;</button>
              </div>
              <div className="grid grid-cols-4 gap-3 p-4">
                {SKINS.map(s => {
                  const isActive = skinKey === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => { setSkinKey(s.key); localStorage.setItem('life-calendar-skin', s.key); window.dispatchEvent(new CustomEvent('life-calendar-skin-changed')); }}
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
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left arrow for Life Calendar */}
        <button
          onClick={() => { setShowLifeCalendar(true); }}
          className="flex-shrink-0 w-14 flex items-center justify-center transition-all group cursor-pointer z-10"
          style={{ background: `linear-gradient(to right, ${skin.swatch}18, transparent)` }}
          title="人生旅途"
        >
          <span className="transition-colors text-4xl font-bold tracking-tight group-hover:opacity-100 opacity-40 transition-opacity inline-block group-hover:translate-x-1 transform" style={{ color: `${skin.swatch}bb` }}>
            »
          </span>
        </button>

        {/* Calendar / Task toggle sidebar */}
        <div className="flex-shrink-0 w-14 flex flex-col items-center pt-4 h-full z-10">
          {mounted && moduleOrder.filter(k => moduleVisibility[k as keyof typeof moduleVisibility]).map((key, idx, arr) => {
            const mk = key as 'timeline' | 'dida' | 'longterm' | 'bilibili' | 'insight' | 'track' | 'review' | 'achievement';
            const divider = idx > 0 ? <div key={`${key}-div`} className="w-6" style={{ borderTop: `1px solid ${skin.swatch}40`, margin: '12px auto 12px auto' }} /> : null;
            const btnStyle: React.CSSProperties = { backgroundColor: skin.swatch, color: '#ffffff', boxShadow: `0 0 0 2px ${skin.swatch}80, 0 2px 8px rgba(0,0,0,0.3)` };
            const labelStyle: React.CSSProperties = { color: '#ffffff', textShadow: '0 0 6px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)' };

            const icons: Record<string, React.ReactNode> = {
              timeline: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2.5" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
              dida: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" /><path d="M8 12l3 3 5-6" /></svg>,
              longterm: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20" /><path d="M12 2v20" /><circle cx="12" cy="12" r="3" /><path d="M12 5v2M12 17v2M5 12h2M17 12h2" /></svg>,
              bilibili: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z"/></svg>,
              insight: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>,
              track: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
              review: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
              achievement: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>,
            };

            const handleClick = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              if (mk === 'timeline') {
                if (moduleLinks.timeline) { window.open(moduleLinks.timeline, '_blank'); return; }
                const opening = !timelineOpen;
                if (opening) {
                  setSelectedMonth(null); setInsightOpen(false); setTrackOpen(false); isSnapping.current = false;
                  if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
                  if (scrollContainerRef.current) {
                    const container = scrollContainerRef.current;
                    container.style.overflowY = 'hidden'; container.style.scrollBehavior = 'auto';
                    container.scrollTop = Math.round(container.scrollTop / container.clientHeight) * container.clientHeight;
                  }
                }
                timelineOpenRef.current = opening; setTimelineOpen(opening);
                if (!opening && scrollContainerRef.current) scrollContainerRef.current.style.overflowY = 'scroll';
              } else if (mk === 'dida') {
                window.open(moduleLinks.dida || 'https://dida365.com/webapp/#q/all/timeline', '_blank');
              } else if (mk === 'longterm') {
                if (moduleLinks.longterm) { window.open(moduleLinks.longterm, '_blank'); return; }
                setShowLifeCalendar(true);
              } else if (mk === 'bilibili') {
                window.open(moduleLinks.bilibili || 'https://www.bilibili.com', '_blank');
              } else if (mk === 'insight') {
                if (moduleLinks.insight) { window.open(moduleLinks.insight, '_blank'); return; }
                const opening = !insightOpen;
                if (opening) {
                  setSelectedMonth(null); timelineOpenRef.current = false; setTimelineOpen(false); setTrackOpen(false);
                  if (scrollContainerRef.current) {
                    const container = scrollContainerRef.current;
                    container.style.overflowY = 'hidden'; container.style.scrollBehavior = 'auto';
                    container.scrollTop = Math.round(container.scrollTop / container.clientHeight) * container.clientHeight;
                  }
                } else { if (scrollContainerRef.current) scrollContainerRef.current.style.overflowY = 'scroll'; }
                setInsightOpen(opening);
              } else if (mk === 'track') {
                if (moduleLinks.track) { window.open(moduleLinks.track, '_blank'); return; }
                const opening = !trackOpen;
                if (opening) {
                  setSelectedMonth(null); timelineOpenRef.current = false; setTimelineOpen(false); setInsightOpen(false);
                  if (scrollContainerRef.current) {
                    const container = scrollContainerRef.current;
                    container.style.overflowY = 'hidden'; container.style.scrollBehavior = 'auto';
                    container.scrollTop = Math.round(container.scrollTop / container.clientHeight) * container.clientHeight;
                  }
                } else { if (scrollContainerRef.current) scrollContainerRef.current.style.overflowY = 'scroll'; }
                setTrackOpen(opening);
              } else if (mk === 'review') {
                if (moduleLinks.review) { window.open(moduleLinks.review, '_blank'); return; }
                setDailyReviewMonth(new Date().getMonth() + 1);
                setDailyReviewDay(new Date().getDate());
                setDailyReviewOpen(true);
              } else if (mk === 'achievement') {
                if (moduleLinks.achievement) { window.open(moduleLinks.achievement, '_blank'); return; }
                setShowAchievement(true);
              } else if ((mk as string).startsWith('bm_')) {
                // 自定义书签：打开对应URL
                const bm = bookmarks.find(b => b.id === mk);
                if (bm?.url) window.open(bm.url, '_blank');
              }
            };

            return <div key={mk} className="flex flex-col items-center">
              {divider}
              <button onClick={handleClick} onMouseDown={(e) => e.preventDefault()}
                className="group flex flex-col items-center gap-1 cursor-pointer" title={getModuleName(mk)}>
                <span className="w-10 h-10 rounded-full flex items-center justify-center transition-all group-hover:scale-110" style={btnStyle}>
                  {icons[mk as keyof typeof icons] || ((mk as string).startsWith('bm_') ? <span className="text-lg font-bold">{(getModuleName(mk) || 'N')[0].toUpperCase()}</span> : null)}
                </span>
                <span className="text-[12px] leading-none font-bold tracking-wide transition-colors" style={labelStyle}>{getModuleName(mk)}</span>
              </button>
            </div>;
          })}

          {/* 更多按钮 - 悬浮弹出 */}
          <div ref={moreButtonRef} className="flex flex-col items-center relative"
            onMouseEnter={() => {
              if (moreHoverTimerRef.current) clearTimeout(moreHoverTimerRef.current);
              if (moreButtonRef.current) {
                const r = moreButtonRef.current.getBoundingClientRect();
                // 弹窗顶部对齐"更多"圆形图标的顶部：wrapper顶部 + 12px(分隔线margin-top) + 12px(分隔线margin-bottom) = +24px
                setMoreMenuPos({ top: r.top + 24, left: r.right + 9 });
              }
              setShowMoreMenu(true);
            }}
            onMouseLeave={() => {
              moreHoverTimerRef.current = setTimeout(() => setShowMoreMenu(false), 100);
            }}>
            <div className="w-6" style={{ borderTop: `1px solid ${skin.swatch}40`, margin: '12px auto 12px auto' }} />
            <button className="group flex flex-col items-center gap-1 cursor-pointer">
              <span className="w-10 h-10 rounded-full flex items-center justify-center transition-all group-hover:scale-110 text-lg font-bold" style={{ backgroundColor: skin.swatch, color: '#ffffff', boxShadow: `0 0 0 2px ${skin.swatch}80, 0 2px 8px rgba(0,0,0,0.3)` }}>•••</span>
              <span className="text-[12px] leading-none font-bold tracking-wide transition-colors" style={{ color: '#ffffff', textShadow: '0 0 6px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)' }}>更多</span>
            </button>
          </div>
        </div>

        {/* 弹窗用 Portal 渲染到 body 真正置顶 */}
        {mounted && showMoreMenu && moreMenuPos && typeof document !== 'undefined' && createPortal(
          <div
            style={{ position: 'fixed', top: moreMenuPos.top, left: moreMenuPos.left, zIndex: 99999 }}
            onMouseEnter={() => { if (moreHoverTimerRef.current) clearTimeout(moreHoverTimerRef.current); }}
            onMouseLeave={() => { moreHoverTimerRef.current = setTimeout(() => setShowMoreMenu(false), 100); }}
          >
            <MoreMenuInline
              onClose={() => setShowMoreMenu(false)}
              skin={skin}
              bookmarks={bookmarks}
              setBookmarks={setBookmarks}
              builtinModules={builtinModules}
              allModuleIds={allModuleIds}
              getModuleInfo={getModuleInfo}
              moduleVisibility={moduleVisibility}
              setModuleVisibility={setModuleVisibility}
              moduleOrder={moduleOrder}
              setModuleOrder={setModuleOrder}
              moduleNames={moduleNames}
              setModuleNames={setModuleNames}
              moduleLinks={moduleLinks}
              setModuleLinks={setModuleLinks}
            />
          </div>,
          document.body
        )}

        <div
          ref={gridContainerRef}
          className="flex-1 pl-6 pr-8 pb-2 pt-1 overflow-x-auto min-h-0 flex justify-center"
        >
        <div ref={gridInnerRef} className="h-full relative rounded-lg"
          style={{ borderTop: `0.5px solid ${skin.cellBorder}`, borderLeft: `0.5px solid ${skin.cellBorder}`, minWidth: '1200px' }}>



          {/* Drawing overlay */}
          <DrawingOverlay ref={drawingRef} storageKey={`calendar-drawing-${year}`} visible={true} />

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
                  className="flex items-center justify-center text-[17px] font-extrabold sticky left-0 z-10 rounded-xl mx-0.5 mr-[5px] cursor-pointer hover:scale-110 transition-all duration-300 shadow-sm hover:shadow-lg backdrop-blur-md"
                  style={{
                    height: cellHeight,
                    color: monthColor.text,
                    border: `1px solid ${monthColor.text}20`,
                    backgroundColor: `${monthColor.bg}60`,
                  }}
                  onClick={() => {
                    // Close other panels if open
                    if (timelineOpen) {
                      timelineOpenRef.current = false;
                      setTimelineOpen(false);
                    }
                    setInsightOpen(false);
                    setTrackOpen(false);
                        if (timelineOpen || insightOpen || trackOpen) {
                      if (scrollContainerRef.current) {
                        scrollContainerRef.current.style.overflowY = 'scroll';
                      }
                    }
                    setSelectedMonth(monthIdx + 1);
                  }}
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
                  const hasAnyNote = hasNote;
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
                      {/* ✓/✗ centered in entire cell */}
                      {mounted && status !== 'none' && (
                        <span
                          className="absolute inset-0 flex items-center justify-center text-[26px] font-bold leading-none pointer-events-none select-none"
                          style={{ color: status === 'crossed' ? skin.crossColor : skin.checkColor }}
                        >
                          {status === 'crossed' ? '✗' : '✓'}
                        </span>
                      )}
                      {/* Content wrapper above overlay */}
                      <div className="relative z-10 h-full flex flex-col">
                      {/* Top zone (1/3): left=daily review, right=toggle ✓/✗, ✓/✗ centered as watermark */}
                      <div className="relative" style={{ height: '33%' }}>

                        <div className="flex h-full">
                          {/* Left half: click for timeline */}
                          <div
                            className="flex-1 flex flex-col items-start pl-1.5 pt-1 cursor-pointer transition-colors rounded-tl-md"
                            onClick={() => {
                              setSelectedMonth(null);
                              setInsightOpen(false);
                              setTrackOpen(false);
                              setDailyReviewOpen(false);
                                            setTimelineMonth(cell.month);
                              setTimelineDay(cell.day);
                              if (!timelineOpen) {
                                isSnapping.current = false;
                                if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
                                if (scrollContainerRef.current) {
                                  const container = scrollContainerRef.current;
                                  const currentScroll = container.scrollTop;
                                  container.style.overflowY = 'hidden';
                                  container.style.scrollBehavior = 'auto';
                                  const pageH = container.clientHeight;
                                  const targetPage = Math.round(currentScroll / pageH) * pageH;
                                  container.scrollTop = targetPage;
                                }
                                timelineOpenRef.current = true;
                                setTimelineOpen(true);
                              }
                            }}
                            title="日程"
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
                          {/* Right half: click to toggle ✓/✗ */}
                          <div
                            className="flex-1 cursor-pointer transition-colors rounded-tr-md"
                            onClick={() => toggleDay(cell.month, cell.day)}
                            title="切换满意/不满意"
                          />
                        </div>
                      </div>

                      {/* Bottom zone (2/3): click for daily review */}
                      <div
                        className="cursor-pointer  transition-all duration-200 rounded-b-sm"
                        style={{ height: '67%' }}
                        onClick={() => {
                          setSelectedMonth(null);
                          setInsightOpen(false);
                          setTrackOpen(false);
                          setTimelineOpen(false);
                          timelineOpenRef.current = false;
                          setDailyReviewMonth(cell.month);
                          setDailyReviewDay(cell.day);
                          setDailyReviewOpen(true);
                        }}
                      />
                      {/* Blue dot indicator: shown when has achievements (outputs) */}
                      {achievementDays.has(`${year}-${cell.month}-${cell.day}`) && (
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full z-20"
                      style={{ background: `${skin.blueDot}55`, boxShadow: 'none' }} />
                      )}
                      </div>{/* end content wrapper */}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Timeline panel overlay - left starts after month name column */}
          {timelineOpen && (
            <TimelinePanel
              year={year}
              month={timelineMonth}
              day={timelineDay}
              onClose={() => {
                timelineOpenRef.current = false;
                setTimelineOpen(false);
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.style.overflowY = 'scroll';
                }
              }}
              skin={skin}
            />
          )}

          {/* Daily Insight overlay */}
          {insightOpen && (
            <InsightPanel
              year={year}
              month={insightMonth}
              day={insightDay}
              skin={skin}
              onClose={() => {
                setInsightOpen(false);
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.style.overflowY = 'scroll';
                }
              }}
            />
          )}

          {/* Track overlay */}
          {trackOpen && (
            <TrackPanel
              year={year}
              skin={skin}
              onClose={() => {
                setTrackOpen(false);
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.style.overflowY = 'scroll';
                }
              }}
            />
          )}

          {/* 成果面板 */}
          {showAchievement && (
            <AchievementPanel
              year={year}
              month={new Date().getMonth() + 1}
              day={new Date().getDate()}
              skin={skin}
              onClose={() => { setShowAchievement(false); scanAchievementDays(); }}
            />
          )}

          {/* 今日复盘 - 覆盖层 */}
          {dailyReviewOpen && (
            <DailyReview
              year={year}
              month={dailyReviewMonth}
              day={dailyReviewDay}
              skin={skin}
              events={[]}
              todos={[]}
              onClose={() => { setDailyReviewOpen(false); refreshReviewDays(); }}
            />
          )}

          {/* 月度复盘 - 覆盖层，左侧从月份名列右侧开始 */}
          {selectedMonth !== null && mounted && (
            <div className="absolute top-0 right-0 bottom-0 z-40 flex flex-col overflow-hidden"
              style={{ backgroundColor: skin.panelBg, left: `${reviewLeft}px` }}
            >
              {/* 左侧拖拽手柄 */}
              <div
                className="absolute top-0 bottom-0 left-0 w-2 cursor-col-resize z-50 hover:bg-black/10 transition-colors group"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startLeft = reviewLeft;
                  let finalLeft = startLeft;
                  document.body.style.userSelect = 'none';
                  document.body.style.cursor = 'col-resize';
                  const onMove = (ev: MouseEvent) => {
                    ev.preventDefault();
                    const newLeft = Math.max(0, Math.min(startLeft + (ev.clientX - startX), 500));
                    finalLeft = newLeft;
                    setReviewLeft(newLeft);
                  };
                  const onUp = () => {
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';
                    localStorage.setItem('panel-left-review', String(finalLeft));
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                  };
                  document.addEventListener('mousemove', onMove);
                  document.addEventListener('mouseup', onUp);
                }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-10 rounded-full bg-black/15 group-hover:bg-black/40 transition-colors" />
              </div>
            {/* 头部 - 背景图+渐变 */}
            <div className="px-6 pt-5 pb-5 relative overflow-hidden flex-shrink-0" style={skin.headerBgImage ? { backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(135deg, ${skin.headerFrom} 0%, ${skin.headerTo} 100%)` }}>
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${skin.sidebarFrom}55, ${skin.sidebarTo}44)` }} />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <div className="text-white/60 text-xs font-medium tracking-wider mb-1">MONTHLY REVIEW</div>
                  <div className="text-white text-3xl font-bold">{selectedMonth}月复盘</div>
                </div>
                <button onClick={() => setSelectedMonth(null)} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors z-20">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* 复盘内容 - 现代卡片 */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* 迷你统计条 */}
              {(() => {
                const daysInMonth = new Date(year, selectedMonth, 0).getDate();
                const today = new Date();
                const isCurrentYear = year === today.getFullYear();
                const isCurrentMonth = isCurrentYear && selectedMonth === today.getMonth() + 1;
                const effectiveDays = isCurrentMonth ? today.getDate() : daysInMonth;
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
                  <div className="rounded-xl p-3 space-y-2" style={{ background: skin.cardBg }}>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span style={{ color: skin.checkColor }} className="text-sm">✓</span>
                        <span style={{ color: skin.textSecondary }} className="text-xs font-medium">{satisfied}天满意</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span style={{ color: skin.crossColor }} className="text-sm">✗</span>
                        <span style={{ color: skin.textSecondary }} className="text-xs font-medium">{crossed}天不满意</span>
                      </div>
                      <div className="flex-1" />
                      <span style={{ color: skin.textMuted }} className="text-xs">{effectiveDays}天</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: skin.divider }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, background: skin.swatch }} />
                      </div>
                      <span style={{ color: skin.textPrimary }} className="text-xs font-semibold">{rate}%</span>
                    </div>
                  </div>
                );
              })()}
              {([
                { key: 'goals', label: '本月目标', icon: '🎯', color: '#8b5cf6', placeholder: '这个月想要达成什么？' },
                { key: 'done', label: '完成情况', icon: '✅', color: '#22c55e', placeholder: '实际完成了哪些？' },
                { key: 'reflect', label: '反思改进', icon: '💡', color: '#f59e0b', placeholder: '有什么可以改进？' },
                { key: 'plan', label: '下月计划', icon: '🚀', color: '#3b82f6', placeholder: '下个月有什么计划？' },
              ] as const).map((section) => {
                const savedValue = monthReviewData[section.key] || '';
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
                      onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => {
                        apiFire('/api/calendar-data', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'month-review', year, month: selectedMonth, sectionKey: section.key, data: e.target.value }),
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>{/* end gridInnerRef */}
        </div>{/* end gridContainerRef */}

      {/* Right arrow for Knowledge Panel - floating, no layout impact */}
      <button
        onClick={() => setShowKnowledge(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 w-14 h-32 flex items-center justify-center transition-all group cursor-pointer z-20"
        style={{ background: `linear-gradient(to left, ${skin.swatch}18, transparent)` }}
        title="知识库"
      >
        <span className="text-4xl font-bold tracking-tight opacity-40 group-hover:opacity-100 transition-opacity inline-block group-hover:-translate-x-1 transform" style={{ color: `${skin.swatch}bb` }}>
          «
        </span>
      </button>

      {/* Knowledge Panel */}
      {showKnowledge && (
        <KnowledgePanel open={showKnowledge} skin={skin} onClose={() => setShowKnowledge(false)} />
      )}

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

      </div>{/* end flex-1 container */}
      </div>{/* end page1 container */}

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
      {editingMotto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setEditingMotto(false)}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 w-80"
            style={{ backgroundColor: skin.panelBg, border: `1px solid ${skin.divider}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-4" style={{ color: skin.textPrimary }}>
              修改标语
            </h3>
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
              className="w-full text-lg px-3 py-2 rounded-lg border outline-none transition-colors"
              style={{
                color: skin.textPrimary,
                backgroundColor: skin.cardBg,
                borderColor: skin.divider,
                fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
              }}
              placeholder="输入标语..."
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs" style={{ color: skin.textMuted }}>
                {mottoDraft.length}/15
              </span>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditingMotto(false)}
                className="px-4 py-1.5 text-sm rounded-lg transition-colors"
                style={{ color: skin.textSecondary, backgroundColor: skin.cardHover }}
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (mottoDraft.trim()) {
                    setMotto(mottoDraft.trim());
                    localStorage.setItem('calendar-motto', mottoDraft.trim());
                    setEditingMotto(false);
                  }
                }}
                className="px-4 py-1.5 text-sm rounded-lg text-white transition-colors"
                style={{ backgroundColor: skin.swatch }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 人生日历侧边栏 - 从左侧滑入 */}
      <LifeCalendar
        visible={showLifeCalendar}
        birthYear={birthYear}
        setBirthYear={handleSetBirthYear}
        onClose={() => setShowLifeCalendar(false)}
        skinKey={skinKey}
      />

      {/* Settings popup */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onClick={() => setSettingsOpen(false)}>
          <div className="rounded-2xl shadow-2xl p-6 w-[400px]"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: skin.panelBg,
              border: `1px solid ${skin.cellBorder}`,
              boxShadow: `0 25px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px ${skin.cellBorder}`,
            }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: skin.textPrimary }}>设置</h2>
              <button onClick={() => setSettingsOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-black/10 active:scale-90 cursor-pointer"
                style={{ color: skin.textSecondary }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* 复盘起始日期 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📅</span>
                <span className="text-sm font-medium" style={{ color: skin.textPrimary }}>复盘起始日期</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={reviewStartDate}
                  onChange={(e) => {
                    setReviewStartDate(e.target.value);
                    localStorage.setItem('calendar-review-start-date', e.target.value);
                  }}
                  className="text-sm px-3 py-2 rounded-lg outline-none transition-all cursor-pointer flex-1"
                  style={{
                    backgroundColor: reviewStartDate ? `${skin.swatch}10` : 'rgba(0,0,0,0.04)',
                    color: skin.textPrimary,
                    border: `1px solid ${reviewStartDate ? `${skin.swatch}40` : 'transparent'}`,
                  }}
                />
                {reviewStartDate && (
                  <button
                    onClick={() => {
                      setReviewStartDate('');
                      localStorage.removeItem('calendar-review-start-date');
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-black/10 active:scale-90 cursor-pointer"
                    style={{ color: skin.textSecondary }}
                    title="清除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
              <p className="text-xs opacity-60" style={{ color: skin.textSecondary }}>
                设置后，该日期之后没有复盘内容的日期默认标记为 ✗
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 后台任务面板 */}
      {showBgTasks && (
        <div className="fixed top-4 right-4 z-50 w-80 rounded-xl shadow-2xl overflow-hidden"
          style={{
            backgroundColor: skin.panelBg,
            border: `1px solid ${skin.cellBorder}`,
            boxShadow: `0 25px 60px -12px rgba(0,0,0,0.25)`,
          }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${skin.cellBorder}` }}>
            <h3 className="text-sm font-semibold" style={{ color: skin.textPrimary }}>后台任务</h3>
            <button onClick={() => setShowBgTasks(false)}
              className="w-5 h-5 rounded flex items-center justify-center transition-all hover:bg-black/10 active:scale-90 cursor-pointer"
              style={{ color: skin.textSecondary }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-3 space-y-2">
            {bgTasks.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: skin.textMuted }}>暂无任务</p>
            )}
            {bgTasks.map(task => (
              <div key={task.id} className="rounded-lg p-3" style={{ backgroundColor: `${skin.swatch}08`, border: `1px solid ${skin.swatch}15` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: skin.textPrimary }}>
                    {task.status === 'pending' && '等待中...'}
                    {task.status === 'processing' && '分析中...'}
                    {task.status === 'completed' && '已完成'}
                    {task.status === 'failed' && '失败'}
                  </span>
                  <span className="text-[10px]" style={{ color: skin.textMuted }}>
                    {task.processed}/{task.total} 条
                  </span>
                </div>
                {/* 进度条 */}
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${skin.swatch}15` }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${task.progress}%`,
                      backgroundColor: task.status === 'failed' ? '#ef4444' : skin.swatch,
                    }}
                  />
                </div>
                {task.status === 'completed' && (
                  <p className="text-[10px] mt-1.5" style={{ color: skin.textSecondary }}>
                    成功保存 {task.saved} 条复盘
                  </p>
                )}
                {task.status === 'failed' && task.error && (
                  <p className="text-[10px] mt-1.5" style={{ color: '#ef4444' }}>
                    {task.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface BM { id: string; name: string; url: string; }

function MoreMenuInline({
  onClose, skin,
  bookmarks, setBookmarks,
  builtinModules, allModuleIds, getModuleInfo,
  moduleVisibility, setModuleVisibility,
  moduleOrder, setModuleOrder,
  moduleNames, setModuleNames,
  moduleLinks, setModuleLinks,
}: {
  onClose: () => void; skin: typeof SKINS[number];
  bookmarks: BM[]; setBookmarks: React.Dispatch<React.SetStateAction<BM[]>>;
  builtinModules: { id: string; label: string }[];
  allModuleIds: string[];
  getModuleInfo: (id: string) => { id: string; label: string; isBuiltin: boolean };
  moduleVisibility: Record<string, boolean>;
  setModuleVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  moduleOrder: string[];
  setModuleOrder: React.Dispatch<React.SetStateAction<string[]>>;
  moduleNames: Record<string, string>;
  setModuleNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  moduleLinks: Record<string, string>;
  setModuleLinks: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const { swatch, cardBg, textPrimary, textSecondary, divider, panelBg } = skin;

  const getLink = (id: string) => {
    const b = bookmarks.find(x => x.id === id);
    return b?.url || moduleLinks[id] || '';
  };

  const getLabel = (id: string) => {
    // 先检查 moduleNames（内建模块改名）
    if (moduleNames[id]) return moduleNames[id];
    // 再检查 bookmarks（自定义书签）
    const bm = bookmarks.find(b => b.id === id);
    if (bm) return bm.name;
    // 最后用默认名
    return getModuleInfo(id).label;
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editId === '__new__') {
      const newId = `bm_${Date.now()}`;
      setBookmarks(prev => [...prev, { id: newId, name: name.trim(), url: url.trim() }]);
      setModuleOrder(prev => [...prev, newId]);
      setModuleVisibility(prev => ({ ...prev, [newId]: true }));
    } else if (editId) {
      // 编辑现有项
      const info = getModuleInfo(editId);
      if (info.isBuiltin) {
        // 内建模块：改 moduleNames / moduleLinks
        setModuleNames(prev => ({ ...prev, [editId]: name.trim() }));
        setModuleLinks(prev => ({ ...prev, [editId]: url.trim() }));
      } else {
        setBookmarks(prev => prev.map(b => b.id === editId ? { ...b, name: name.trim(), url: url.trim() } : b));
      }
    }
    setShowForm(false);
    setEditId(null);
    setName('');
    setUrl('');
  };

  const handleEdit = (id: string) => {
    setEditId(id);
    setName(getLabel(id));
    setUrl(getLink(id));
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const info = getModuleInfo(id);
    if (!info.isBuiltin) {
      setBookmarks(prev => prev.filter(b => b.id !== id));
      setModuleOrder(prev => prev.filter(x => x !== id));
      setModuleVisibility(prev => { const c = { ...prev }; delete c[id]; return c; });
    }
    if (editId === id) { setShowForm(false); setEditId(null); setName(''); setUrl(''); }
  };

  const handleToggleVisibility = (id: string) => {
    setModuleVisibility(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== id) setDragOver(id);
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOver(null); return; }
    setModuleOrder(prev => {
      const arr = [...prev];
      const fromIdx = arr.indexOf(dragId);
      const toIdx = arr.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, dragId);
      return arr;
    });
    setDragId(null);
    setDragOver(null);
  };
  const handleDragEnd = () => { setDragId(null); setDragOver(null); };

  return (
    <div className="w-[520px] max-h-[70vh] overflow-y-auto rounded-2xl shadow-2xl border p-4" style={{ backgroundColor: panelBg, borderColor: divider }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: textPrimary }}>
            <span>更多链接</span>
            <span className="text-xs font-normal opacity-60" style={{ color: textSecondary }}>拖拽排序 · 眼睛控制显示</span>
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:opacity-70 text-lg" style={{ color: textSecondary }}>✕</button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {allModuleIds.map(id => {
            const info = getModuleInfo(id);
            const label = getLabel(id);
            const link = getLink(id);
            const visible = moduleVisibility[id] !== false;
            const isDragging = dragId === id;
            const isDragOver = dragOver === id;
            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => handleDragStart(e, id)}
                onDragOver={(e) => handleDragOver(e, id)}
                onDrop={(e) => handleDrop(e, id)}
                onDragEnd={handleDragEnd}
                className={`relative group flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing rounded-lg p-2 transition-all ${isDragging ? 'opacity-40 scale-95' : ''} ${isDragOver ? 'ring-2' : ''}`}
                style={{ backgroundColor: cardBg, boxShadow: isDragOver ? `0 0 0 2px ${swatch}` : 'none' }}
                onClick={() => link && visible && window.open(link, '_blank')}
                title="拖动可排序"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-lg text-base font-bold" style={{ backgroundColor: swatch + '20', color: visible ? swatch : '#9ca3af', opacity: visible ? 1 : 0.5 }}>
                  {label.charAt(0)}
                </div>
                <span className="text-xs truncate w-full text-center font-medium" style={{ color: visible ? textSecondary : '#9ca3af' }}>{label}</span>
                {/* 按钮行放在文字下方 */}
                <div className="flex gap-1.5 mt-1">
                  {/* 眼睛（显示/隐藏） */}
                  <button
                    className="w-5 h-5 flex items-center justify-center rounded-full shadow-sm"
                    style={{ backgroundColor: visible ? swatch : '#9ca3af' }}
                    onClick={(e) => { e.stopPropagation(); handleToggleVisibility(id); }}
                    title={visible ? '在主页显示' : '在主页隐藏'}
                  >
                    {visible ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 4.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                  {/* 编辑（图标） */}
                  <button
                    className="w-5 h-5 flex items-center justify-center rounded-full text-white shadow-sm opacity-70 group-hover:opacity-100"
                    style={{ backgroundColor: swatch }}
                    onClick={(e) => { e.stopPropagation(); handleEdit(id); }}
                    title="编辑"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" /></svg>
                  </button>
                  {/* 删除（仅自定义） */}
                  {!info.isBuiltin && (
                    <button
                      className="w-5 h-5 flex items-center justify-center rounded-full text-white shadow-sm opacity-70 group-hover:opacity-100"
                      style={{ backgroundColor: '#ef4444' }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(id); }}
                      title="删除"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div
            className="flex flex-col items-center gap-1 cursor-pointer rounded-lg p-2 border-2 border-dashed transition-all hover:scale-105"
            style={{ borderColor: divider, color: textSecondary }}
            onClick={() => { setShowForm(true); setEditId('__new__'); setName(''); setUrl(''); }}
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-lg text-lg opacity-50">+</div>
            <span className="text-xs">添加</span>
          </div>
        </div>
        {showForm && (
          <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: cardBg }}>
            <div className="flex flex-col gap-2">
              <input className="w-full px-3 py-2 rounded-lg text-sm outline-none border" style={{ backgroundColor: panelBg, borderColor: divider, color: textPrimary }} placeholder="网站名称" value={name} onChange={e => setName(e.target.value)} autoFocus />
              <input className="w-full px-3 py-2 rounded-lg text-sm outline-none border" style={{ backgroundColor: panelBg, borderColor: divider, color: textPrimary }} placeholder="网址（如 https://example.com）" value={url} onChange={e => setUrl(e.target.value)} />
              <div className="flex gap-2 justify-end">
                <button className="px-4 py-1.5 rounded-lg text-sm" style={{ backgroundColor: divider, color: textPrimary }} onClick={() => { setShowForm(false); setEditId(null); setName(''); setUrl(''); }}>取消</button>
                <button className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: swatch }} onClick={handleSave}>{editId === '__new__' ? '添加' : '保存修改'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
