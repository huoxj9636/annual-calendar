# 跨对话记忆索引

> 每条索引指向详情文件的具体轮次行号，用 read_file(offset=行号, limit=范围) 精准跳读，不通读全文。

| 日期 | 主题 | 关键点 | 详情定位 |
|---|---|---|---|
| 2026-06-30 | 周复盘-展示形式 | 提出4种形态（热力图/卡片/时间轴/双层），推荐极简时间轴 | sessions/2026-06-30-周复盘时间轴.md#Q1(L25) |
| 2026-06-30 | 周复盘-六项确认 | 确认6项=completed/goodThings/problems/mood/reflections/tomorrowTodo | sessions/2026-06-30-周复盘时间轴.md#Q2(L38) |
| 2026-06-30 | 周复盘-一屏一周 | 用户要求一屏一周+挖掘同屏，不要Tab切换 | sessions/2026-06-30-周复盘时间轴.md#Q3(L53) |
| 2026-06-30 | 周复盘-挖掘取舍 | 心情无所谓、关键词云不做、完成度核心、TOP问题也做 | sessions/2026-06-30-周复盘时间轴.md#Q4(L61) |
| 2026-06-30 | 周复盘-用户偏好 | 默认当前周不改、主题跟随皮肤、硬编码色改skin变量 | sessions/2026-06-30-周复盘时间轴.md#Q7(L85) |
| 2026-06-30 | 周复盘-布局调整 | 6项flex-1均分、字号提档、知识森林按钮仅主页、去掉滚轮、侧边箭头 | sessions/2026-06-30-周复盘时间轴.md#Q12(L119) |
| 2026-06-30 | 周复盘-箭头优化 | 加回到本周按钮、最强最弱改pill卡片、箭头放大+Lucide图标 | sessions/2026-06-30-周复盘时间轴.md#Q13(L127) |
| 2026-06-30 | 记忆系统 | 创建.memory/跨对话记忆系统、行级精准定位、PITFALL错误合集 | sessions/2026-06-30-周复盘时间轴.md#Q15(L143) |
| 2026-06-30 | 记忆系统-详情格式 | 详情文件必须完整对话原文、目录按Q/A编号带行号 | sessions/2026-06-30-周复盘时间轴.md#Q16(L175) |
| 2026-07-01 | 记忆系统-结构总览 | 确认AGENTS.md/.memory//cross-session-memory/三层结构，规则变更触发条件位置 | sessions/2026-06-30-周复盘时间轴.md#Q17(L185) |
| 2026-07-01 | 记忆系统-提示词分版 | 同项目追加vs新项目初始化，两句话即可，技能包已自足 | sessions/2026-06-30-周复盘时间轴.md#Q18(L198) |
| 2026-07-01 | 记忆系统-session分文件规则 | 同一上下文=同一文件，不同上下文=不同文件，按上下文分不是按日期分 | sessions/2026-06-30-周复盘时间轴.md#Q20(L221) |
| 2026-07-01 | OKR数据丢失-根因定位 | POST /api/okr 从未传user_id→upsert静默失败，前端.catch吞错，OKR从未入库 | sessions/2026-07-01-OKR数据丢失.md#Q1(L14) |
| 2026-07-01 | OKR数据丢失-修复方案 | POST加user_id='legacy'、GET加过滤、后端返回500+详情、前端显示红色错误提示 | sessions/2026-07-01-OKR数据丢失.md#Q1(L14) |
| 2026-07-01 | user_id设计必要性 | 解释RLS策略/未来登录兼容/多用户隔离，'legacy'是占位符 | sessions/2026-07-01-OKR数据丢失.md#Q5(L87) |
| 2026-07-01 | 用户反馈加登录未做好 | 承认'legacy'占位方案不是用户要的，需要接入真 Supabase Auth | sessions/2026-07-01-OKR数据丢失.md#Q6(L95) |
| 2026-07-01 | 画布数据紧急回滚 | curl测试污染+后端GET drawing返回裸数组bug，UPDATE清空strokes | sessions/2026-07-01-OKR数据丢失.md#Q7(L103) |
| 2026-07-01 | 画布恢复-拒绝诊断 | 用户拒绝帮查→AI自查全库确认DB 4天前就空、画布只在localStorage | sessions/2026-07-01-OKR数据丢失.md#Q8(L114) |
| 2026-07-01 | 画布数据位置 | DB里2026年画布4天前就空、localStorage大概率有 | sessions/2026-07-01-OKR数据丢失.md#Q9(L141) |
| 2026-07-01 | 智能存储方案承诺 | user_id是实现细节、代码自动决定localStorage vs DB、不再问用户 | sessions/2026-07-01-OKR数据丢失.md#Q10(L154) |
| 2026-07-01 | 画布3重备份 | 主key+备份key+DB，加载取最多那份，永久保留localStorage | sessions/2026-07-01-OKR数据丢失.md#Q11(L162) |
| 2026-07-01 | 用户4条红线写入AGENTS.md | 禁删功能/数据、测试用2099、智能隐藏技术细节、新功能后向兼容 | sessions/2026-07-01-OKR数据丢失.md#Q12(L176) |
| 2026-07-01 | 第二轮记忆整理 | Q5-Q13追加到同一session文件 | sessions/2026-07-01-OKR数据丢失.md#Q13(L189) |
| 2026-07-01 | 第三轮记忆整理-执行过程 | 读PITFALL/AGENTS→追加Q5-Q13→更新INDEX→追加P13-P16→push | sessions/2026-07-01-OKR数据丢失.md#Q14(L196) |
| 2026-07-01 | 第三轮记忆整理-请求 | 用户要求按5步整理记忆流程 | sessions/2026-07-01-OKR数据丢失.md#Q15(L241) |
| 2026-07-01 | 登录弹窗-启动暂停期 | 拦截器安装时先getSession+500ms暂停期，刷新时不弹窗 | sessions/2026-07-01-登录弹窗与勾选逻辑.md#Q1(L111) |
| 2026-07-01 | 登录弹窗-刷新仍弹出+语法错误 | _initialized不够，加_paused 500ms暂停期；edit_file多次替换破坏try-catch(TS1472) | sessions/2026-07-01-登录弹窗与勾选逻辑.md#Q2(L95) |
| 2026-07-01 | 勾选逻辑-复盘内容优先 | overrides从覆盖变兜底，有复盘内容✓不受overrides影响 | sessions/2026-07-01-登录弹窗与勾选逻辑.md#Q3(L79) |
| 2026-07-01 | 勾选逻辑-登录未登录分别处理 | 未登录从localStorage加载/保存reviewDays+overrides，登录从API/DB | sessions/2026-07-01-登录弹窗与勾选逻辑.md#Q4(L52) |
| 2026-07-01 | 记忆整理-偷懒被抓 | 初次只记3轮次→补5轮次→用户指出20+轮不止 | sessions/2026-07-01-登录弹窗与勾选逻辑.md#Q5(L42) |
| 2026-07-01 | 记忆整理-二次被抓 | 整个会话20+轮对话只记了5轮，前上下文12个Phase完全遗漏 | sessions/2026-07-01-登录弹窗与勾选逻辑.md#Q7(L17) |
| 2026-07-01 | 登录按钮位置与可见性 | import从default改named，absolute定位向下43px | sessions/2026-07-01-账号登录与数据链路.md#Q1(L160) |
| 2026-07-01 | MigrationToast每次刷新弹出 | localStorage key读写不一致(带/不带userId后缀)，统一全局key+useState | sessions/2026-07-01-账号登录与数据链路.md#Q2(L142) |
| 2026-07-01 | ChunkLoadError缓存 | 重启服务+清除.next缓存+修复layout HTML结构 | sessions/2026-07-01-账号登录与数据链路.md#Q3(L132) |
| 2026-07-01 | 画板数据丢失 | API enum只有drawings(复数)，前端调用drawing(单数)，添加别名 | sessions/2026-07-01-账号登录与数据链路.md#Q4(L119) |
| 2026-07-01 | 部署NOT NULL约束错误 | user_id列有null值，UPDATE null为legacy，schema改nullable | sessions/2026-07-01-账号登录与数据链路.md#Q5(L103) |
| 2026-07-01 | legacy数据显示问题 | user_id=legacy数据，登录后看不到，需手动迁移 | sessions/2026-07-01-账号登录与数据链路.md#Q6(L92) |
| 2026-07-01 | API返回格式不匹配 | API返回{data:{...}}，前端期望{...}，统一res.data||res | sessions/2026-07-01-账号登录与数据链路.md#Q7(L81) |
| 2026-07-01 | daily_review保存失败 | upsert需唯一约束但无，改为delete+insert | sessions/2026-07-01-账号登录与数据链路.md#Q8(L70) |
| 2026-07-01 | saveReview函数bug | res.catch()错误，Response没有catch方法，改try-catch | sessions/2026-07-01-账号登录与数据链路.md#Q9(L59) |
| 2026-07-01 | apiFetch null触发登录 | 添加requireLogin触发登录弹窗 | sessions/2026-07-01-账号登录与数据链路.md#Q10(L48) |
| 2026-07-01 | 全面数据链路检查 | calendar_overrides加API保存，notes/drawings加id生成，knowledge_trees无API待做 | sessions/2026-07-01-账号登录与数据链路.md#Q11(L33) |
| 2026-07-01 | 登录弹窗-GET静默 | apiFetch只有POST/PUT/DELETE触发requireLogin，GET静默返回null | sessions/2026-07-01-账号登录与数据链路.md#Q12(L22) |
