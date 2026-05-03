import YearCalendar from '@/components/year-calendar';

export const metadata = {
  title: '年度计划日历',
  description: '年度计划日历 - 12周工作法区块划分、农历节气显示、每日满意度勾选',
};

export default function Home() {
  return <YearCalendar />;
}
