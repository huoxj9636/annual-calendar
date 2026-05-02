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
  const blockLength = 84; // 12 weeks * 7 days
  const colors: ('red' | 'black')[] = ['red', 'black', 'red', 'black'];
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  for (let i = 0; i < 4; i++) {
    const startDate = new Date(yearStart);
    startDate.setDate(startDate.getDate() + i * blockLength);

    if (startDate > yearEnd) break;

    const endDate = new Date(yearStart);
    endDate.setDate(endDate.getDate() + (i + 1) * blockLength - 1);

    const actualEndDate = endDate > yearEnd ? yearEnd : endDate;

    blocks.push({
      index: i,
      startDate,
      endDate: actualEndDate,
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
  { bg: '#f8bbd0', accent: '#e91e63', text: '#880e4f' },   // 1月 - 粉紫
  { bg: '#ffccbc', accent: '#ff5722', text: '#bf360c' },   // 2月 - 暖橙
  { bg: '#e1bee7', accent: '#9c27b0', text: '#6a1b9a' },   // 3月 - 浅紫
  { bg: '#bbdefb', accent: '#1e88e5', text: '#0d47a1' },   // 4月 - 浅蓝
  { bg: '#fff9c4', accent: '#f9a825', text: '#f57f17' },   // 5月 - 米黄
  { bg: '#d1c4e9', accent: '#5e35b1', text: '#4527a0' },   // 6月 - 灰紫
  { bg: '#c8e6c9', accent: '#43a047', text: '#1b5e20' },   // 7月 - 草绿
  { bg: '#d7ccc8', accent: '#6d4c41', text: '#3e2723' },   // 8月 - 暖棕
  { bg: '#b2ebf2', accent: '#00acc1', text: '#006064' },   // 9月 - 湖蓝
  { bg: '#ffcdd2', accent: '#e53935', text: '#b71c1c' },   // 10月 - 深红
  { bg: '#b2dfdb', accent: '#00897b', text: '#004d40' },   // 11月 - 薄荷
  { bg: '#ffecb3', accent: '#ffa000', text: '#e65100' },   // 12月 - 琥珀
];

export const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];
