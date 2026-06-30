#!/bin/bash
# 记忆系统初始化脚本 - 在新项目根目录下执行
# 用法: bash init-memory.sh

set -e

echo "🧠 初始化跨对话记忆系统..."

# 创建目录结构
mkdir -p .memory/sessions

# 创建 INDEX.md
cat > .memory/INDEX.md << 'EOF'
# 记忆索引

| 日期 | 主题 | 关键点 | 详情定位 |
|---|---|---|---|
EOF

# 创建 PITFALL.md
cat > .memory/PITFALL.md << 'EOF'
# 错误合集（PITFALL）

> 每次对话开始必须阅读本文件，已犯过的错误绝不重犯。
> 新错误发现后立即追加，格式：场景 + 正确做法 + 根因。

EOF

echo "✅ .memory/ 目录结构已创建"
echo "📋 接下来请将以下内容添加到项目的 AGENTS.md 文件顶部："
echo ""
echo "---"
cat << 'AGENTS_SNIPPET'

### 跨对话记忆系统（最高优先级 - 每次对话必读）

#### 启动规则：每次新建对话时，必须按顺序读取以下文件：
1. `.memory/INDEX.md` — 历史上下文索引，用行号精准跳读
2. `.memory/PITFALL.md` — 错误合集，已犯过的错误绝不重犯

需要了解某次对话的决策细节时，根据 INDEX.md 中的定位读取 `.memory/sessions/{id}.md`。

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
   例：sessions/2025-01-14-周复盘时间轴.md#Q4(L61)
   → read_file(path, offset=61, limit=8) 只读8行，不用通读全文
    ↓
⑤ 正常开发（写代码 / 修bug / 新功能）
    ↓
⑥ 对话结束前 → 执行记忆更新流程（见下方）
    ↓
⑦ git push origin main → 推送后提醒用户"已推送到 GitHub"
    ↓
⑧ 调用 done 交付
```

#### 对话结束时的记忆更新流程（强制）

**Step 1：更新详情文件（增量追加，禁止全量覆盖）**
- 路径：`.memory/sessions/YYYY-MM-DD-主题关键词.md`
- 新对话创建新文件，延续对话从上一个Q编号继续追加
- 绝对禁止全量覆盖，只追加新轮次
- 内容要求：完整对话原文（用户原话 + AI 回答，一字不差），按 Q1/A1、Q2/A2 编号
- 追加完必须更新顶部目录表（编号+主题+行号），行号必须回核对齐

**Step 2：更新索引文件（增量追加，禁止全量覆盖）**
- 读取 `.memory/INDEX.md`，在表格末尾追加条目
- 绝对禁止重写整个 INDEX.md
- 一个对话涉及多个独立话题，拆成多条索引，每条指向不同轮次
- 定位格式：`sessions/YYYY-MM-DD-主题关键词.md#Q编号(L行号)`
- 行号必须与详情文件目录表一致

**Step 3：推送**
```bash
git add .memory/ && git commit -m "docs: 补充记忆 - YYYY-MM-DD-主题关键词" && git push origin main
```

推送后提醒用户"已推送到 GitHub"，然后才能调用 done 交付。

AGENTS_SNIPPET
echo "---"
echo ""
echo "✨ 完成！将上面的内容复制到 AGENTS.md 即可。"
