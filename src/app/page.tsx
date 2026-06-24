import type { Metadata } from 'next';
import YearCalendar from '@/components/year-calendar';
import AuthGuardWrapper from '@/components/auth-guard-wrapper';

export const metadata: Metadata = {
  title: '年度计划日历',
  description: '年度计划日历 - 12周工作法 + 农历 + 节气',
};

export default function Home() {
  return (
    <AuthGuardWrapper>
      <YearCalendar />
    </AuthGuardWrapper>
  );
}
