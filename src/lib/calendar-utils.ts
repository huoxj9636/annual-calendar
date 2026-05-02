export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = getDayOfWeek(year, month, day);
  return dow === 0 || dow === 6;
}

export interface TwelveWeekBlock {
  index: number;
  startDate: Date;
  endDate: Date;
  color: 'red' | 'black';
  label: string;
}

export function getTwelveWeekBlocks(year: number): TwelveWeekBlock[] {
  const blocks: TwelveWeekBlock[] = [];
  const colors: ('red' | 'black')[] = ['red', 'black', 'red', 'black'];
  const startOfYear = new Date(year, 0, 1);

  for (let i = 0; i < 4; i++) {
    const startDate = new Date(startOfYear);
    startDate.setDate(startDate.getDate() + i * 84); // 12 weeks = 84 days
    const endDate = new Date(startOfYear);
    endDate.setDate(endDate.getDate() + (i + 1) * 84 - 1); // 84th day of block

    blocks.push({
      index: i,
      startDate,
      endDate,
      color: colors[i],
      label: `P${i + 1}`,
    });
  }

  return blocks;
}

export function getBlockForDate(
  year: number,
  month: number,
  day: number,
  blocks: TwelveWeekBlock[],
): TwelveWeekBlock | null {
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  for (const block of blocks) {
    const start = new Date(block.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(block.endDate);
    end.setHours(0, 0, 0, 0);
    if (date >= start && date <= end) {
      return block;
    }
  }
  return null;
}

export interface BlockBorderInfo {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  color: string;
}

export function getBlockBorders(
  year: number,
  month: number,
  day: number,
  blocks: TwelveWeekBlock[],
): BlockBorderInfo | null {
  const currentBlock = getBlockForDate(year, month, day, blocks);
  if (!currentBlock) return null;

  const borderColor = currentBlock.color === 'red' ? '#dc2626' : '#1a1a1a';
  const result: BlockBorderInfo = {
    top: false,
    bottom: false,
    left: false,
    right: false,
    color: borderColor,
  };

  const daysInMonth = getDaysInMonth(year, month);

  // Left border: previous day is in a different block
  if (day === 1) {
    if (month === 1) {
      result.left = true;
    } else {
      const prevMonthDays = getDaysInMonth(year, month - 1);
      const prevBlock = getBlockForDate(year, month - 1, prevMonthDays, blocks);
      if (!prevBlock || prevBlock.index !== currentBlock.index) {
        result.left = true;
      }
    }
  } else {
    const prevBlock = getBlockForDate(year, month, day - 1, blocks);
    if (!prevBlock || prevBlock.index !== currentBlock.index) {
      result.left = true;
    }
  }

  // Right border: next day is in a different block
  if (day === daysInMonth) {
    if (month === 12) {
      result.right = true;
    } else {
      const nextBlock = getBlockForDate(year, month + 1, 1, blocks);
      if (!nextBlock || nextBlock.index !== currentBlock.index) {
        result.right = true;
      }
    }
  } else {
    const nextBlock = getBlockForDate(year, month, day + 1, blocks);
    if (!nextBlock || nextBlock.index !== currentBlock.index) {
      result.right = true;
    }
  }

  // Top border: same day in previous month is in a different block or doesn't exist
  if (month === 1) {
    result.top = true;
  } else {
    const prevMonthDays = getDaysInMonth(year, month - 1);
    if (day > prevMonthDays) {
      result.top = true;
    } else {
      const aboveBlock = getBlockForDate(year, month - 1, day, blocks);
      if (!aboveBlock || aboveBlock.index !== currentBlock.index) {
        result.top = true;
      }
    }
  }

  // Bottom border: same day in next month is in a different block or doesn't exist
  if (month === 12) {
    result.bottom = true;
  } else {
    const nextMonthDays = getDaysInMonth(year, month + 1);
    if (day > nextMonthDays) {
      result.bottom = true;
    } else {
      const belowBlock = getBlockForDate(year, month + 1, day, blocks);
      if (!belowBlock || belowBlock.index !== currentBlock.index) {
        result.bottom = true;
      }
    }
  }

  return result;
}

export function isDatePast(year: number, month: number, day: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

export function isToday(year: number, month: number, day: number): boolean {
  const today = new Date();
  return (
    today.getFullYear() === year &&
    today.getMonth() === month - 1 &&
    today.getDate() === day
  );
}

// Precompute all cell data for a year
export interface CellData {
  month: number;
  day: number;
  exists: boolean;
  isWeekend: boolean;
  dayOfWeek: number;
  lunarDisplay: string;
  isSolarTerm: boolean;
  isFestival: boolean;
  isLunarFirstDay: boolean;
  blockIndex: number;
  blockLabel: string;
  blockColor: string;
  blockBorders: BlockBorderInfo | null;
}

export function precomputeYearData(
  year: number,
  blocks: TwelveWeekBlock[],
  getLunarDisplay: (y: number, m: number, d: number) => {
    display: string;
    isSolarTerm: boolean;
    isFestival: boolean;
    isLunarFirstDay: boolean;
  },
): CellData[][] {
  const data: CellData[][] = [];

  for (let month = 1; month <= 12; month++) {
    const monthData: CellData[] = [];
    const daysInMonth = getDaysInMonth(year, month);

    for (let day = 1; day <= 31; day++) {
      if (day > daysInMonth) {
        monthData.push({
          month,
          day,
          exists: false,
          isWeekend: false,
          dayOfWeek: -1,
          lunarDisplay: '',
          isSolarTerm: false,
          isFestival: false,
          isLunarFirstDay: false,
          blockIndex: -1,
          blockLabel: '',
          blockColor: '',
          blockBorders: null,
        });
        continue;
      }

      const dow = getDayOfWeek(year, month, day);
      const weekend = dow === 0 || dow === 6;
      const lunarInfo = getLunarDisplay(year, month, day);
      const block = getBlockForDate(year, month, day, blocks);
      const borders = getBlockBorders(year, month, day, blocks);

      monthData.push({
        month,
        day,
        exists: true,
        isWeekend: weekend,
        dayOfWeek: dow,
        lunarDisplay: lunarInfo.display,
        isSolarTerm: lunarInfo.isSolarTerm,
        isFestival: lunarInfo.isFestival,
        isLunarFirstDay: lunarInfo.isLunarFirstDay,
        blockIndex: block?.index ?? -1,
        blockLabel: block?.label ?? '',
        blockColor: block?.color ?? '',
        blockBorders: borders,
      });
    }

    data.push(monthData);
  }

  return data;
}

// Month theme colors for weekend backgrounds
export const MONTH_COLORS = [
  { bg: '#fdf2f4', accent: '#ec4899', text: '#be185d' },   // 1月 - 粉 (童年)
  { bg: '#fff7ed', accent: '#f97316', text: '#c2410c' },   // 2月 - 橙 (少年)
  { bg: '#fefce8', accent: '#ca8a04', text: '#a16207' },   // 3月 - 黄 (青春)
  { bg: '#f0fdf4', accent: '#16a34a', text: '#15803d' },   // 4月 - 绿 (青春)
  { bg: '#f0fdfa', accent: '#0d9488', text: '#0f766e' },   // 5月 - 青绿 (青年)
  { bg: '#f0f9ff', accent: '#0891b2', text: '#0e7490' },   // 6月 - 蓝 (青年)
  { bg: '#eff6ff', accent: '#2563eb', text: '#1d4ed8' },   // 7月 - 靛蓝 (而立)
  { bg: '#f5f3ff', accent: '#7c3aed', text: '#6d28d9' },   // 8月 - 紫 (不惑)
  { bg: '#fdf4ff', accent: '#a855f7', text: '#9333ea' },   // 9月 - 紫红 (知天命)
  { bg: '#fdf2f4', accent: '#e879a0', text: '#be185d' },   // 10月 - 粉 (耳顺)
  { bg: '#fff7ed', accent: '#e8a050', text: '#b45309' },   // 11月 - 橙 (古稀)
  { bg: '#f5f3ff', accent: '#8b5cf6', text: '#7c3aed' },   // 12月 - 紫 (回归)
];

export const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];
