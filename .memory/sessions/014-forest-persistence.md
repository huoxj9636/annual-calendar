# Session 014 - 知识森林持久化

## 日期
2025-01

## 需求
树数据从localStorage迁移到Supabase数据库。

## 最终决策
- 树数据迁移到Supabase数据库持久化
- 接入Supabase登录模块
- 新建树默认不设位置，拖拽后持久化到数据库
- 树位置持久化三层兜底：DB + localStorage + 重试

## 遇到的bug及修复
- PUT /api/trees/[id] 500错误 → Supabase客户端单例 + loadEnv容错
- 间歇性错误 → 三层兜底策略

## 涉及文件
- forest/, api/trees/, supabase-browser.ts

## 备注
（从 Git 历史反推）
