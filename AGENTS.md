# 项目上下文 - 年度计划日历

### 项目概述

年度计划日历应用，支持 12 周工作法区块划分、农历/节气显示、每日满意度勾选、日视图日程管理、月度复盘、人生旅途行动模板等功能。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **农历库**: lunar-javascript

## 目录结构

```
├── public/                     # 静态资源
├── scripts/                    # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── page.tsx            # 首页 - 年历主页面
│   │   ├── layout.tsx          # 根布局
│   │   └── globals.css         # 全局样式
│   ├── components/
│   │   ├── year-calendar.tsx   # 年历核心组件 (Client Component)
│   │   ├── day-view.tsx        # 日视图侧边栏 (日程/备忘Tab切换)
│   │   ├── monthly-review.tsx  # 月度复盘页面 (满意度/热力图/趋势)
│   │   ├── life-calendar.tsx   # 人生旅途侧边栏 (9阶段交互式行动模板)
│   │   └── ui/                 # Shadcn UI 组件库
│   ├── lib/
│   │   ├── lunar.ts            # 农历计算工具 (lunar-javascript 封装)
│   │   ├── calendar-utils.ts   # 日历工具 (月份天数、周末判断、12周区块、边框计算)
│   │   ├── skins.ts            # 皮肤主题系统 (8套皮肤定义 + generateMonthColors)
│   │   └── utils.ts            # 通用工具函数 (cn)
│   ├── hooks/                  # 自定义 Hooks
│   └── types/
│       └── lunar-javascript.d.ts  # lunar-javascript 类型声明
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 核心功能

1. **年历网格**: 12 行(月) × 31 列(天)，横向展开
2. **周末彩色标注**: 周六/周日单元格使用当月主题色背景
3. **农历/节气显示**: 每天显示对应农历日期、节气、节日
4. **12 周工作法框选**: 每年 4 个 12 周区块，红/黑边框交替标识
5. **满意度勾选**: 过去天数自动 ✓，点击切换 ✓↔✗，状态存储在 localStorage
6. **日视图侧边栏**: 点击日期右侧滑出，日程/备忘Tab切换，语音识别智能分流，事件并列布局
7. **月度复盘页面**: 下滑翻页进入，自动定位当前月，满意度/热力图/趋势分析
8. **人生旅途侧边栏**: 左侧箭头滑出，9阶段交互式行动模板，可勾选行动项，可添加到日历计划

## 关键数据流

- `yearData = precomputeYearData(year, blocks, getLunarInfo)` — 年度数据预计算
- 勾选状态: `localStorage['calendar-overrides-{year}']` — JSON 格式 `{ "year-month-day": "checked"|"crossed" }`
- 日程事件: `localStorage['dayview-events-{year}-{month}-{day}']`
- 待办事项: `localStorage['dayview-todos-{year}-{month}-{day}']`
- 备忘录: `localStorage['calendar-notes-{year}']`
- 人生旅途进度: `localStorage['life-calendar-progress']` — 嵌套对象 `{stageKey: {catKey: {actionId: {done, addedToCalendar}}}}`
- 12 周区块: `getTwelveWeekBlocks(year)` — 返回 4 个 block，每 block 84 天

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入
- 禁止隐式 `any` 和 `as any`；函数参数、返回值应有明确类型

### Hydration 问题防范

- 动态内容（当天标记、勾选状态）使用 `mounted` 状态守卫，仅在客户端挂载后渲染
- 禁止在 JSX 渲染逻辑中直接使用 `new Date()`

### UI 设计与组件规范

- 模板默认预装核心组件库 `shadcn/ui`，位于 `src/components/ui/` 目录下

## 构建与测试命令

- 开发: `pnpm dev` (端口 5000)
- 构建: `pnpm build`
- 类型检查: `pnpm ts-check`
- 代码检查: `pnpm lint`
