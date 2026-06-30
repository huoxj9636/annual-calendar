# Session 000 - 项目初始化

## 日期
2025-01

## 需求
创建年度计划日历应用，核心功能包括12周工作法区块划分、农历/节气显示、满意度勾选。

## 最终决策
- 使用 Next.js (App Router) + TypeScript + Tailwind CSS
- 12 行(月) × 31 列(天) 横向展开的年历网格
- 农历使用 lunar-javascript 库
- 满意度勾选存储在 localStorage

## 涉及文件
- year-calendar.tsx, page.tsx, layout.tsx, globals.css
- lib/lunar.ts, lib/calendar-utils.ts

## 备注
（从 Git 历史反推，本轮对话的详细决策过程无法还原，仅记录功能范围）
