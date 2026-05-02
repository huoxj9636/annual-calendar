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
  { bg: '#f8e8ef', accent: '#d888a4', text: '#a84068' },   // 1月 - 粉紫
  { bg: '#f8ece6', accent: '#e49a6a', text: '#a86030' },   // 2月 - 暖橙
  { bg: '#f0e8f2', accent: '#b888c8', text: '#7e5090' },   // 3月 - 浅紫
  { bg: '#e8f0f8', accent: '#88b4d4', text: '#4878a0' },   // 4月 - 浅蓝
  { bg: '#f9f5e4', accent: '#d8c060', text: '#9a8838' },   // 5月 - 米黄
  { bg: '#eae6f2', accent: '#9888c0', text: '#685090' },   // 6月 - 灰紫
  { bg: '#e6f0e8', accent: '#88c08c', text: '#48784c' },   // 7月 - 草绿
  { bg: '#eeeae6', accent: '#a89484', text: '#685048' },   // 8月 - 暖棕
  { bg: '#e2f2f6', accent: '#68c0cc', text: '#387888' },   // 9月 - 湖蓝
  { bg: '#f8e6e8', accent: '#d48886', text: '#904848' },   // 10月 - 深红
  { bg: '#e2f2f0', accent: '#68b4a8', text: '#387068' },   // 11月 - 薄荷
  { bg: '#f8f0dc', accent: '#d0a248', text: '#907028' },   // 12月 - 琥珀
];

export const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];
