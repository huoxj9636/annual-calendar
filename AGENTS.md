# 项目上下文 - 年度计划日历

### 跨对话记忆系统（最高优先级 - 每次对话必读）

#### 完整闭环

```
新对话开始
    ↓
① 读 AGENTS.md（系统自动注入）→ 看到"必须读 .memory/"
    ↓
② 读 .memory/INDEX.md → 扫一遍所有历史对话摘要
    ↓
③ 读 .memory/PITFALL.md → 知道什么错不能犯
    ↓
④ 需要某次对话细节？→ 按 INDEX.md 中的定位 read_file 精准跳读
   例：sessions/2025-01-14-周复盘时间轴.md#最终决策(L27)
   → read_file(path, offset=27, limit=13) 只读13行，不用通读全文
    ↓
⑤ 正常开发（写代码 / 修bug / 新功能）
    ↓
⑥ 对话结束前 → 执行记忆更新流程（见下方）
    ↓
⑦ git push origin main → 推送后提醒用户"已推送到 GitHub"
    ↓
⑧ 调用 done 交付
```

#### 启动规则：每次新建对话时，必须按顺序读取以下文件：
1. `.memory/INDEX.md` — 历史上下文索引，用行号精准跳读
2. `.memory/PITFALL.md` — 错误合集，已犯过的错误绝不重犯

**读完不是目的，内化才是**：读完 INDEX.md 后，应该清楚这个项目"做过什么、决策了什么、当前状态是什么"；读完 PITFALL.md 后，应该清楚"什么错绝对不能犯、什么坑已经踩过"。不要只列标题报告"我读完了"，要用自己的话简要复述核心要点，证明你真的理解了。

需要了解某次对话的决策细节时，根据 INDEX.md 中的定位读取 `.memory/sessions/{id}.md`。

- `.memory/INDEX.md` — 所有对话的摘要索引（日期 / 主题 / 关键点 / 详情定位）
- `.memory/PITFALL.md` — 历史错误合集（犯错场景 / 正确做法 / 根因）
- `.memory/sessions/*.md` — 每次对话的**完整原文存档**（用户原话 + AI 回答，一字不差），按对话轮次编 Q1/Q2/Q3...，目录表指向每个轮次的行号

**对话结束规则**：每次对话结束时，必须：
1. 追加或创建 session 详情文件（`.memory/sessions/YYYY-MM-DD-主题关键词.md`）
2. 追加索引条目到 INDEX.md（含行级精准定位）
3. 如本次对话中犯过错误（哪怕已修复），追加条目到 `.memory/PITFALL.md`
4. 将所有改动 commit 并 `git push origin main` 推送到 GitHub

### 对话结束时的记忆更新流程（强制）

**Step 1：更新详情文件（按当前上下文判断，不问用户）**

- 路径：`.memory/sessions/YYYY-MM-DD-主题关键词.md`
- 日期用对话开始的日期，主题用2-4个字概括核心内容
- **判断逻辑（Agent 自行判断，不要问用户）**：
  - 当前上下文能看到之前的对话内容（Q编号连续） → 同一个文件，继续追加编号
  - 当前上下文是从零开始的 → 新建文件，从 Q1 开始
  - 对话开头有"此会话延续自..."的摘要 → 追加到被延续的那个文件
- **禁止用日期匹配旧文件**：同一天可以有多个文件，不同天也可以是同一文件
- 从 Q1/A1 开始编号
- **绝对禁止全量覆盖**：只追加新的对话轮次，不改动已有内容
- **内容要求：必须保留完整对话原文**（用户原话 + AI 回答，一字不差），按轮次编号 Q1/A1、Q2/A2、Q3/A3...
- 追加完新轮次后，必须更新文件顶部的目录表（新增轮次的编号+主题+行号）
- **目录表倒序排列**：最新的轮次在最上面，方便直接看到最新内容
- **目录表必须有日期列**：每条记录都要标注日期（如 6/30、7/1），不能只在跨天时才标注，否则无法知道每轮对话是哪天的
- 行号写完后必须回核对齐
- 格式参照已有的详情文件（如 `2025-01-14-周复盘时间轴.md`）

**Step 2：更新索引文件（增量追加，禁止全量覆盖）**
- 读取 `.memory/INDEX.md`，在表格末尾**追加**新条目
- **绝对禁止重写整个 INDEX.md**，只在末尾追加
- 一个对话如果涉及多个独立话题，拆成多条索引，每条指向详情文件的不同轮次（如 Q3/A3、Q7/A7）
- 定位格式：`sessions/YYYY-MM-DD-主题关键词.md#Q编号(L行号)`
- 行号必须与详情文件目录表中的行号一致
- 关键点要写具体（"确认了XX方案"），不要写空泛（"讨论了XX"）

**Step 3：推送**
```bash
cd /workspace/projects && git add .memory/ && git commit -m "docs: 补充记忆 - YYYY-MM-DD-主题关键词" && git push origin main
```

**推送后提醒（强制）**：git push 成功后、调用 `done` 交付前，必须明确告知用户"已推送到 GitHub"。不得在未提醒的情况下直接交付。

**版本推送规则（强制）**：每次完成一个功能版本（即每次调用 `done` 工具交付前），必须执行 `git push origin main` 将代码推送到 GitHub。不得遗漏。

**技能包同步规则**：当记忆系统的格式、流程、PITFALL 内容有重大变更时，必须同步更新 `cross-session-memory/` 技能包（SKILL.md + references + scripts），重新打包 `.skill` 文件，并执行 `save_to_my_skill` 更新"我的技能"。

**文件同步关系**：
```
AGENTS.md（项目实际配置）
    ↕ 必须保持一致
cross-session-memory/references/agents-config-template.md（技能包模板）

cross-session-memory/（技能源码）
    ↕ 打包生成
cross-session-memory.skill（.skill文件）

.memory/（运行时数据）→ 不同步到技能包，每个项目独有
```

同步矩阵：
| 改了什么 | 要同步更新 |
|---|---|
| 记忆系统流程/必读文件变更 | AGENTS.md + agents-config-template.md + SKILL.md |
| session/INDEX/PITFALL 格式变更 | SKILL.md + agents-config-template.md |
| init-memory.sh 脚本变更 | 重新打包 .skill |
| 同步矩阵本身变更 | AGENTS.md + agents-config-template.md + SKILL.md + 重新打包 .skill |
| .memory/ 数据 | 不同步，项目独有 |

**触发方式**：每次对话中若修改了 AGENTS.md 里"跨对话记忆系统"相关段落，对话结束前必须按同步矩阵检查并更新技能包对应文件，重新打包 `.skill`，执行 `save_to_my_skill`。

**规则变更的触发条件**：实际操作中发现现有规则不够用 = 规则要变。具体表现为：
1. 犯了一个现有规则没覆盖到的错 → 加 PITFALL 条目 + 检查是否需要改流程规则
2. 用户说了一句现有规则跟意图不一致的话 → 修正规则
3. 按现有规则做了但结果不对 → 修正规则
以上三种情况发生时，必须同步检查并更新受影响的文件（按同步矩阵）。

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

## ⚠️ 用户红线规则（最高优先级，违反任何一条立刻停止操作）

### 1. 绝不删除/破坏已有功能
- 任何"清理"、"重构"、"优化"前必须先确认该功能/数据**当前正在被使用**
- 不确定时直接问用户，**不要替用户决定什么是冗余**
- 用户数据**永远不删**：localStorage 任何 key 都不许 `removeItem`，数据库任何记录都不许 `DELETE`（除非用户明确要求）
- 已有的功能、菜单项、入口、按钮、数据流——**一个都不能少**

### 2. 测试/调试严禁污染真实数据
- **所有 API 测试用沙箱年份 `year=2099`（或 `9999`）**，禁止用 2025/2026 等真实年份
- 禁止对生产数据库执行写操作来"测试一下"
- 测试用临时数据用完后立即 `DELETE` 清理（如必须）
- 调试时优先用 `GET` 读，不用 `POST` 写

### 3. 智能隐藏技术细节
- 不要让用户感知到：`user_id`、`legacy`、Supabase 配置、RLS 策略、数据库连接等技术概念
- "登录" 是用户主动选择，不是强制流程
- 数据存储方式（localStorage / DB）由代码根据实际情况自动选择

### 4. 优先保证现有功能可用
- 新功能必须**后向兼容**：旧数据格式、旧 API、旧入口都要保留
- 改 API 时**先加后删**：新接口上线稳定后再移除旧接口
- 任何"统一化"、"规范化"操作必须**零停机**、**零数据丢失**

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
