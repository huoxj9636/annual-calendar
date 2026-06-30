# AGENTS.md 配置片段

将以下内容添加到项目的 AGENTS.md 文件顶部：

```markdown
### 跨对话记忆系统（最高优先级 - 每次对话必读）

#### 启动规则：每次新建对话时，必须按顺序读取以下文件：
1. `.memory/INDEX.md` — 历史上下文索引，用行号精准跳读
2. `.memory/PITFALL.md` — 错误合集，已犯过的错误绝不重犯

需要了解某次对话的决策细节时，根据 INDEX.md 中的定位读取 `.memory/sessions/{id}.md`。

#### 对话结束规则：每次对话结束时，必须：
1. 追加或创建 session 详情文件（`.memory/sessions/YYYY-MM-DD-主题关键词.md`）
2. 追加索引条目到 INDEX.md（含行级精准定位）
3. 如本次对话中犯过错误（哪怕已修复），追加条目到 `.memory/PITFALL.md`
4. 将所有改动 commit 并 `git push origin main` 推送到 GitHub
5. 推送后提醒用户"已推送到 GitHub"，然后才能调用 done 交付
```
