# Session 008 - 8套皮肤系统

## 日期
2025-01

## 需求
支持多套皮肤主题，用户可切换。

## 最终决策
- 8套皮肤主题系统：翡翠/海洋/日落/紫罗兰/樱花/暗夜/森林/薰衣草
- 重构人生旅途支持皮肤切换
- 8套皮肤动态月份色彩系统，全格子颜色跟随皮肤
- 年历头部添加皮肤选择入口
- 每套皮肤定义：swatch(主色)/panelBg/panelBorder/highlightColor/checkColor/crossColor/swatchName
- generateMonthColors() 为每个月生成主题色渐变

## 涉及文件
- skins.ts, year-calendar.tsx, globals.css

## 备注
（从 Git 历史反推）
