import { Solar } from 'lunar-javascript';

export interface LunarInfo {
  lunarDay: string;
  lunarMonth: string;
  display: string;
  isSolarTerm: boolean;
  solarTerm: string;
  isFestival: boolean;
  festivalName: string;
  isLunarFirstDay: boolean;
}

export function getLunarInfo(year: number, month: number, day: number): LunarInfo {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();

  const lunarDay = lunar.getDayInChinese();
  const lunarMonth = lunar.getMonthInChinese();
  const isLunarFirstDay = lunar.getDay() === 1;

  const jieQi = lunar.getJieQi();
  const lunarFestivals = lunar.getFestivals();
  const solarFestivals = solar.getFestivals();

  let display = lunarDay;
  let isSolarTerm = false;
  let solarTerm = '';
  let isFestival = false;
  let festivalName = '';

  if (jieQi) {
    display = jieQi;
    isSolarTerm = true;
    solarTerm = jieQi;
  } else if (solarFestivals.length > 0) {
    display = solarFestivals[0];
    isFestival = true;
    festivalName = solarFestivals[0];
  } else if (lunarFestivals.length > 0) {
    display = lunarFestivals[0];
    isFestival = true;
    festivalName = lunarFestivals[0];
  } else if (isLunarFirstDay) {
    display = lunarMonth + '月';
  }

  return {
    lunarDay,
    lunarMonth,
    display,
    isSolarTerm,
    solarTerm,
    isFestival,
    festivalName,
    isLunarFirstDay,
  };
}

export function getYearAnimal(year: number): string {
  const animals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  const index = (year - 4) % 12;
  return animals[index];
}

export function getGanZhiYear(year: number): string {
  const gan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const zhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const ganIdx = (year - 4) % 10;
  const zhiIdx = (year - 4) % 12;
  return gan[ganIdx] + zhi[zhiIdx] + '年';
}
