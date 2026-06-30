# Session 012 - 账号系统

## 日期
2025-01

## 需求
引入账号系统，localStorage数据自动同步到数据库。

## 最终决策
- 手机号+密码登录
- LoginButton(右上角,主题色融入) 与 UserMenu(左下角,登录后显示) 分离
- UserMenu改用Cloud/CloudOff图标
- localStorage数据自动同步到Supabase
- 未登录时正常使用（不强制登录）

## 涉及文件
- auth-guard.tsx, supabase-browser.ts

## 备注
（从 Git 历史反推）
