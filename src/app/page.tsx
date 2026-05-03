'use client';

import dynamic from 'next/dynamic';

const YearCalendar = dynamic(() => import('@/components/year-calendar'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#f8f6f2]">
      <div className="text-gray-400 text-lg">加载中...</div>
    </div>
  ),
});

export default function Home() {
  return <YearCalendar />;
}
