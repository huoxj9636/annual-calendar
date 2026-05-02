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
  const quarters = [
    { startMonth: 0, endMonth: 2 },  // Q1: Jan-Mar
    { startMonth: 3, endMonth: 5 },  // Q2: Apr-Jun
    { startMonth: 6, endMonth: 8 },  // Q3: Jul-Sep
    { startMonth: 9, endMonth: 11 }, // Q4: Oct-Dec
  ];

  for (let i = 0; i < 4; i++) {
    const q = quarters[i];
    const startDate = new Date(year, q.startMonth, 1);
    const endDay = new Date(year, q.endMonth + 1, 0).getDate();
    const endDate = new Date(year, q.endMonth, endDay);

    blocks.push({
      index: i,
      startDate,
      endDate,
      color: colors[i],
      label: `Q${i + 1}`,
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
  { bg: '#f5e0e8', accent: '#d4779a', text: '#a1355e' },   // 1月 - 粉紫
  { bg: '#f5e6de', accent: '#e08a5a', text: '#a3572a' },   // 2月 - 暖橙
  { bg: '#ede3ef', accent: '#b07cc0', text: '#7a4a8a' },   // 3月 - 浅紫
  { bg: '#e3ecf5', accent: '#7aadcf', text: '#3a6e94' },   // 4月 - 浅蓝
  { bg: '#f7f3e0', accent: '#d4b85a', text: '#9a8530' },   // 5月 - 米黄
  { bg: '#e5e0ef', accent: '#9080b8', text: '#5e4a8a' },   // 6月 - 灰紫
  { bg: '#e2ede3', accent: '#7ab87e', text: '#3a6e3e' },   // 7月 - 草绿
  { bg: '#ebe6e3', accent: '#a08878', text: '#5e4a3e' },   // 8月 - 暖棕
  { bg: '#ddf0f3', accent: '#5ab8c4', text: '#2a6e78' },   // 9月 - 湖蓝
  { bg: '#f5e0e2', accent: '#cf7a78', text: '#8a3a3a' },   // 10月 - 深红
  { bg: '#ddeeed', accent: '#5aaa9e', text: '#2a5e56' },   // 11月 - 薄荷
  { bg: '#f5eed8', accent: '#cc9a40', text: '#8a6a20' },   // 12月 - 琥珀
];

export const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];
