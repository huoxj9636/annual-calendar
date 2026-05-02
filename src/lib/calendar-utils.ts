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
  { bg: '#faf5f5', accent: '#c8a0a8', text: '#a07880' },   // 1月 - 玫瑰灰
  { bg: '#faf7f4', accent: '#c4b098', text: '#9a8868' },   // 2月 - 暖杏灰
  { bg: '#f7f5fa', accent: '#a898c0', text: '#7868a0' },   // 3月 - 丁香灰
  { bg: '#f4f6fa', accent: '#8898b8', text: '#5870a0' },   // 4月 - 雾蓝
  { bg: '#f8f7f2', accent: '#b0a880', text: '#888068' },   // 5月 - 橄榄米
  { bg: '#f5f4fa', accent: '#9888b8', text: '#6858a0' },   // 6月 - 薰衣草
  { bg: '#f3f7f4', accent: '#88b098', text: '#588868' },   // 7月 - 苔绿灰
  { bg: '#faf6f3', accent: '#b8a090', text: '#907868' },   // 8月 - 暖灰棕
  { bg: '#f3f6fa', accent: '#88a8c0', text: '#5080a0' },   // 9月 - 灰蓝
  { bg: '#faf4f5', accent: '#c098a0', text: '#a07080' },   // 10月 - 酒红灰
  { bg: '#f3f7fa', accent: '#88b0b8', text: '#508890' },   // 11月 - 灰青
  { bg: '#faf8f4', accent: '#c0b088', text: '#a09068' },   // 12月 - 暮金
];

export const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];
