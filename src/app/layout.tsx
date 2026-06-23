import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '年度计划日历',
    template: '%s | 年度计划日历',
  },
  description:
    '年度计划日历 - 12周工作法区块划分、农历节气显示、每日满意度勾选',
  icons: {
    icon: [
      { url: '/favicon-blue.svg', type: 'image/svg+xml' },
      { url: '/favicon-new.png?v=5', type: 'image/png', sizes: '128x128' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
