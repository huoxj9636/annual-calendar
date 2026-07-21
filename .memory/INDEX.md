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
| 2026-07-11 | 甘特图-返回按钮 | 竖直长方体放在事项列左侧，后移20pt，再移到手柄垂直位置 | sessions/2026-07-11-甘特图微调.md#Q2(L139) |
| 2026-07-11 | 甘特图-左右滑动分割 | 左半(时间条可见区)水平滚动，右半垂直滚动，用边界判断 | sessions/2026-07-11-甘特图微调.md#Q5(L163) |
| 2026-07-11 | 甘特图-时间跟随精度 | 核心公式：hoverHour=(trackX+ganttScrollLeft)/48*scale，滚动后需加偏移 | sessions/2026-07-11-甘特图微调.md#Q6(L171) |
| 2026-07-11 | 甘特图-事项输入框固定 | sticky left-0 + z-index盖住时间条和刻度，底部边框主题色，宽度可拖拽 | sessions/2026-07-11-甘特图微调.md#Q8(L187) |
| 2026-07-11 | 甘特图-格子长度调整 | 23:45后空白缩短→格子太短(只到12点)→修正cellWidth/scale动态计算→对齐24点 | sessions/2026-07-11-甘特图微调.md#Q18(L267) |
| 2026-07-11 | 甘特图-修改旧功能致用户愤怒 | 修改cellWidth时破坏了时间块创建位置，用户骂"你他妈的"；P08红线再次违反 | sessions/2026-07-11-甘特图微调.md#Q19(L275) |
| 2026-07-11 | 甘特图-按钮布局 | 日程改名前移10pt→右上角关闭按钮旁→语音复盘等左移→2026左侧按钮上下滑动 | sessions/2026-07-11-甘特图微调.md#Q23(L307) |
| 2026-07-11 | 甘特图-滚动条隐藏/弹窗视口 | sidebar-scroll隐藏滚动条，更多弹窗自适应视口 | sessions/2026-07-11-甘特图微调.md#Q27(L339) |
| 2026-07-11 | 知识森林-定位圆环对齐 | 多次修复圆环动画位置不对齐，最终统一left/bottom/transform公式 | sessions/2026-07-11-知识森林持久化.md#Q1(L25) |
| 2026-07-11 | 知识森林-DB持久化 | 创建knowledge_trees表+CRUD API，树数据从localStorage迁移到Supabase | sessions/2026-07-11-知识森林持久化.md#Q6(L86) |
| 2026-07-11 | 登录模块+取消强制 | 基于Supabase Auth生成邮箱登录页，后取消强制登录，保留基础设施 | sessions/2026-07-11-知识森林持久化.md#Q7(L101) |
| 2026-07-11 | 知识森林-位置不保存 | POST默认position_x 50导致树叠中心，修复为null；scale 100/1.0转换 | sessions/2026-07-11-知识森林持久化.md#Q9(L129) |
| 2026-07-11 | 知识森林-PUT 500连环修复 | 间歇性500: putRoute+RLS→单例+loadEnv→localStorage兜底→重试，3轮修复未完全解决 | sessions/2026-07-11-知识森林持久化.md#Q11(L155) |
| 2026-07-12 | 自定义链接-刷新消失 | 模块顺序加载过滤allKeys仅内建8个,bm_xxx被过滤;扩展为validKeySet=内建+书签ID | sessions/2026-07-12-自定义链接消失.md#A1(L21) |
| 2026-07-12 | 每日复盘-屏幕自适应 | 主弹窗1320px固定宽改min(1320px,96vw);Review网格响应式1/2/3列+滚动;语音/导入弹窗同改 | sessions/2026-07-12-自定义链接消失.md#A2(L89) |
| 2026-07-21 | 书房功能-需求与实现 | 知识森林新增"书房"Tab：book_lists+books表、CRUD API、微信读书解析API、reading-room组件 | sessions/2026-07-21-书房功能.md#Q1(L9) |
| 2026-07-21 | 书房简化为石墨文档iframe | 用户不要自建CRUD，改为直接嵌入石墨文档iframe；删除多余API和DB表 | sessions/2026-07-21-书房功能.md#Q2(L41) |
