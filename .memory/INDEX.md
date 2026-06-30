# 跨对话记忆索引

> 每次新对话必读此文件，获取历史上下文。需要了解某次对话的决策细节时，根据 ID 读取 `.memory/sessions/{id}.md`。

| ID | 日期 | 主题 | 关键决策 | 涉及文件 |
|---|---|---|---|---|
| 000 | 2024-12 | 项目初始化 | Next.js 16 + React 19 + shadcn/ui + lunar-javascript | 全部基础文件 |
| 001 | 2024-12 | 年历视觉设计 | 12月×31列网格、主题色标注周末、农历/节气显示 | year-calendar.tsx, lunar.ts, calendar-utils.ts |
| 002 | 2024-12 | 单元格交互 | 满意度✓/✗勾选、12周工作法边框、localStorage存储 | year-calendar.tsx |
| 003 | 2024-12 | 日视图侧边栏 | 日程/备忘Tab切换、语音识别分流、事件并列布局 | day-view.tsx |
| 004 | 2024-12 | 时钟与美化 | 模拟时钟、粒子上屏、整体美化 | analog-clock.tsx, particle-effect.tsx |
| 005 | 2024-12 | 月度复盘 | 满意度/热力图/趋势分析、scroll-snap分页 | monthly-review.tsx |
| 006 | 2024-12 | 人生旅途 | 9阶段交互式行动模板、可勾选、可加到日历 | life-calendar.tsx |
| 007 | 2025-01 | 视觉风格调整 | 多轮视觉微调 | 多个组件 |
| 008 | 2025-01 | 8套皮肤系统 | 8套完整主题定义、一键切换 | skins.ts |
| 009 | 2025-01 | 知识森林 | 类蚂蚁森林全景、树木成长、5种知识类型映射 | forest/ 目录 |
| 010 | 2025-01 | 森林增强 | 摇曳动画、飘落叶、光斑、云朵、种植流程优化 | forest/ 目录 |
| 011 | 2025-01 | 甘特图 | 甘特图功能 | 甘特图相关组件 |
| 012 | 2025-01 | 登录系统 | Supabase Auth接入、邮箱登录 | auth-guard.tsx, login/ |
| 013 | 2025-01 | 安全加固 | 数据安全、RLS策略、接口鉴权 | 多个API路由 |
| 014 | 2025-01 | 森林持久化 | 树数据迁移Supabase、位置三层兜底(DB+localStorage+重试) | forest/, api/trees/ |
| 015 | 2025-01 | 滴答清单集成 | 中转跳转页 + Tampermonkey用户脚本 | dida/ |
| 016 | 2025-01 | 知识库改造 | TreeCloseup左右分栏+富文本编辑器、定位跨页跳转 | forest/tree-closeup.tsx |
| 017 | 2025-01-14 | 周复盘时间轴 | 一屏一周7卡+挖掘同屏、左右箭头切换、完成度热力/统计/主题+TOP问题 | weekly-review-timeline.tsx, year-calendar.tsx |
