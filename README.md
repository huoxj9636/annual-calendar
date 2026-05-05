# 年度计划日历

一款集年历总览、日程管理、每日洞察、轨迹对照、月度复盘、人生旅途于一体的年度计划日历应用。

## 功能概览

### 年历总览
- 12 月 × 31 天横向网格，一屏纵览全年
- 农历日期、节气、节日实时显示
- 8 套皮肤主题随心切换
- 12 周工作法区块红黑边框标识
- 满意度勾选（✓/✗），状态持久化

### 日程管理
- 分钟精度时间轴，点击即可添加日程
- 拖拽边角调整日程时间
- 鼠标悬停实时显示时间指示器
- 定位按钮一键跳转当前时间
- 同时间段多事件并列显示
- 右键日程可 AI 拆解任务

### 每日洞察
- 6 个洞察维度：拖延诊断 / 执行力评估 / 精力分析 / 优先级复盘 / 习惯追踪 / 生活平衡
- AI 流式分析，金字塔结构精简表达

### 轨迹对照
- 计划时间 vs 实际时间甘特图对照
- 自动计算延迟/提前/超时/省时
- AI 分析时间使用偏差模式

### 月度复盘
- 下滑翻页进入月度复盘
- 满意度热力图 + 趋势分析

### 人生旅途
- 9 阶段人生行动模板（童年 → 暮年）
- 6 种人生模板可选（事业优先 / 家庭幸福 / 自由探索 / 平衡发展 / 健康为本 / 创造者型）
- 长期计划创建与里程碑追踪
- 完成度可视化

## 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS 4
- **农历**: lunar-javascript
- **AI**: 支持 OpenAI 兼容 API（火山引擎豆包 / OpenAI / DeepSeek 等）

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 9+

### 安装

```bash
# 克隆项目
git clone https://github.com/huoxj963636/annual-calendar.git
cd annual-calendar

# 安装依赖
pnpm install
```

### 配置 AI 功能（可选）

AI 功能（日程拆解、每日洞察、轨迹分析）需要配置 LLM API：

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑 .env.local，填入你的 API Key
# 支持任何 OpenAI 兼容的 API
```

最小配置只需填入 `LLM_API_KEY`。不配置时，日历核心功能正常使用，仅 AI 功能不可用。

### 启动

```bash
# 开发模式
pnpm dev

# 生产构建
pnpm build

# 生产启动
pnpm start
```

启动后访问 http://localhost:5000

## 数据存储

所有数据存储在浏览器 localStorage 中，无需数据库：

| 数据 | Key | 格式 |
|------|-----|------|
| 满意度勾选 | `calendar-overrides-{year}` | `{ "year-month-day": "checked"/"crossed" }` |
| 日程事件 | `dayview-events-{year}-{month}-{day}` | JSON Array |
| 待办事项 | `dayview-todos-{year}-{month}-{day}` | JSON Array |
| 备忘录 | `calendar-notes-{year}` | JSON Object |
| 人生旅途进度 | `life-calendar-progress` | 嵌套 Object |
| 长期计划 | `life-calendar-plans` | JSON Array |
| 面板宽度 | `panel-left-{type}` | Number (px) |
| 皮肤选择 | `calendar-skin-key` | String |

## 项目结构

```
├── public/                     # 静态资源
├── scripts/                    # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── page.tsx            # 首页 - 年历主页面
│   │   ├── layout.tsx          # 根布局
│   │   ├── globals.css         # 全局样式
│   │   └── api/                # API 路由
│   │       ├── ai-chat/route.ts    # 日程 AI 对话
│   │       ├── insight/route.ts    # 每日洞察
│   │       ├── track/route.ts      # 轨迹对照
│   │       └── fetch-url/route.ts  # URL 抓取
│   ├── components/
│   │   ├── year-calendar.tsx   # 年历核心组件
│   │   ├── timeline-panel.tsx  # 日程时间轴面板
│   │   ├── insight-panel.tsx   # 每日洞察面板
│   │   ├── track-panel.tsx     # 轨迹对照面板
│   │   ├── life-calendar.tsx   # 人生旅途
│   │   └── ui/                 # Shadcn UI 组件
│   ├── lib/
│   │   ├── llm.ts             # LLM 客户端（双模式）
│   │   ├── lunar.ts           # 农历计算
│   │   ├── calendar-utils.ts  # 日历工具
│   │   ├── skins.ts           # 皮肤主题系统
│   │   └── utils.ts           # 通用工具
│   └── types/                  # 类型声明
├── .env.example               # 环境变量模板
└── package.json
```

## License

MIT
