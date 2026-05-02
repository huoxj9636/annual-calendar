'use client';

import { useState } from 'react';

interface LifeCalendarProps {
  birthYear: number;
  setBirthYear: (year: number) => void;
  onClose: () => void;
}

// Detailed life stage definitions
const LIFE_STAGES = [
  {
    label: '童年', range: '0-5岁', emoji: '🎈', start: 0, end: 5,
    color: 'from-pink-50 to-rose-50', border: 'border-pink-200', accent: 'text-pink-600',
    bg: 'bg-pink-500', ring: 'ring-pink-300',
    summary: '人生最纯真的时光，在爱与探索中认识世界',
    categories: [
      {
        title: '身体成长',
        icon: '🏃',
        details: [
          '0-1岁：学会翻身、坐、爬、站、走，每个里程碑都值得记录',
          '1-2岁：从蹒跚学步到健步如飞，发展精细动作能力',
          '2-3岁：跑跳自如，开始尝试骑三轮车、玩球类活动',
          '3-5岁：身体协调性大幅提升，可学习游泳、舞蹈等基础运动',
          '保证充足睡眠（幼儿10-13小时/天），养成规律作息',
          '均衡营养，少糖少盐，培养不挑食的好习惯',
          '按时接种疫苗，定期体检关注发育指标',
        ],
      },
      {
        title: '认知启蒙',
        icon: '🧩',
        details: [
          '0-2岁：通过感官探索世界，多触摸、多听、多看',
          '1-3岁：语言爆发期，每天亲子阅读15-30分钟',
          '2-4岁：认识颜色、形状、数字，玩积木和拼图',
          '3-5岁：十万个为什么阶段，耐心回答每个问题',
          '选择优质绘本，避免过早接触电子屏幕（2岁前零屏幕）',
          '通过游戏学习，不急于"识字""算术"等功利目标',
        ],
      },
      {
        title: '情感安全',
        icon: '❤️',
        details: [
          '建立安全依恋：及时回应哭泣，让孩子感到被爱',
          '0-3岁是安全感形成的关键期，尽量由父母亲自养育',
          '用拥抱、亲吻表达爱意，让孩子在温暖中成长',
          '允许孩子表达情绪，教他们识别和命名情绪',
          '不恐吓、不威胁、不 conditional love（有条件的爱）',
          '父母情绪稳定是最好的教育，营造和谐家庭氛围',
        ],
      },
      {
        title: '习惯培养',
        icon: '🌱',
        details: [
          '2岁起培养自主进食、自主如厕',
          '3岁起学习自己穿衣、整理玩具',
          '建立"物品归位"的规矩，从收纳玩具开始',
          '学会说"请""谢谢""对不起"，培养基本礼貌',
          '设定简单规则并坚持执行，帮助孩子理解边界',
          '用正面引导代替惩罚，"你可以做…"代替"不许做…"',
        ],
      },
    ],
  },
  {
    label: '少年', range: '6-11岁', emoji: '📚', start: 6, end: 11,
    color: 'from-orange-50 to-amber-50', border: 'border-orange-200', accent: 'text-orange-600',
    bg: 'bg-orange-500', ring: 'ring-orange-300',
    summary: '求学之路的起点，在知识中打开世界的窗户',
    categories: [
      {
        title: '学业基础',
        icon: '📖',
        details: [
          '养成每天固定时间完成作业的习惯，先作业后玩耍',
          '语文：大量阅读课外书，远比刷题重要——每天至少30分钟',
          '数学：理解而非死记，用生活中的场景解释数学概念',
          '英语：以兴趣为导向，儿歌、动画、绘本，不急于语法',
          '建立"错题本"思维，记录并分析错误原因',
          '不要只关注分数，更要关注学习态度和方法',
          '遇到学习困难时，找到具体薄弱点针对性补强',
        ],
      },
      {
        title: '兴趣发展',
        icon: '🎨',
        details: [
          '广泛尝试：音乐、美术、体育、科学、编程，多接触不同领域',
          '6-8岁探索期：每样尝试3-6个月，不急于"专精"',
          '8-10岁聚焦期：从尝试中选出2-3项持续投入',
          '10-11岁深化期：在1-2项上达到一定水平',
          '兴趣班不宜超过3个，留出自由玩耍和发呆的时间',
          '尊重孩子的选择，不把父母的遗憾加在孩子身上',
          '允许放弃，但要求"坚持完这个学期再决定"',
        ],
      },
      {
        title: '社交能力',
        icon: '🤝',
        details: [
          '学会倾听别人说话，不随意打断',
          '学会分享和轮流，理解"公平"不等于"一样多"',
          '处理冲突：用语言表达不满，而非动手',
          '理解别人的感受，培养共情能力',
          '面对欺凌：勇敢说不，及时告诉老师和家长',
          '邀请同学来家里玩，学习做小主人',
          '参加团队活动（运动会、合唱团等），体验合作',
        ],
      },
      {
        title: '品格塑造',
        icon: '⭐',
        details: [
          '诚实：做错事不可怕，撒谎才可怕',
          '责任感：承担力所能及的家务（洗碗、扫地、喂宠物）',
          '感恩：学会说谢谢，理解别人的付出不是理所当然',
          '坚持：允许失败，但要鼓励再试一次',
          '独立思考：鼓励质疑"为什么"，不盲从权威',
          '金钱观：给适量零花钱，学习储蓄和合理消费',
        ],
      },
    ],
  },
  {
    label: '青春', range: '12-17岁', emoji: '💫', start: 12, end: 17,
    color: 'from-yellow-50 to-lime-50', border: 'border-yellow-200', accent: 'text-yellow-700',
    bg: 'bg-yellow-500', ring: 'ring-yellow-300',
    summary: '自我意识觉醒的岁月，在迷茫中寻找方向',
    categories: [
      {
        title: '学业进阶',
        icon: '📚',
        details: [
          '初中：打牢基础，语数英三大科不能有短板',
          '高中：找到自己的优势学科，形成学科竞争力',
          '学习方法升级：从"死记硬背"到"理解应用"',
          '学会做笔记（康奈尔笔记法）、做思维导图',
          '时间管理：使用番茄钟，合理分配各科时间',
          '重视阅读积累，广泛涉猎历史、哲学、科学等',
          '了解新高考/选科政策，早做规划',
          '不要把考试当成唯一目标，保持对知识的好奇心',
        ],
      },
      {
        title: '自我探索',
        icon: '🔍',
        details: [
          '思考"我是谁""我想要什么"——写日记是很好的方式',
          '发现自己的天赋：什么东西你学得比别人快？',
          '探索职业兴趣：参加职业体验、阅读行业故事',
          '培养独立判断力，不盲目追随潮流和同辈压力',
          '允许试错：这个年纪犯错成本最低',
          '阅读传记：看看杰出人物年轻时如何选择',
          '和不同背景的人交流，拓宽视野',
        ],
      },
      {
        title: '身心健康',
        icon: '💪',
        details: [
          '青春期身体变化是正常的，不必焦虑和羞耻',
          '坚持一项运动：跑步、篮球、游泳、瑜伽…每周3次以上',
          '关注体态：久坐学习易驼背，注意坐姿和拉伸',
          '饮食均衡：少喝奶茶少吃油炸，多喝水多吃蔬果',
          '保护视力：20-20-20法则，每20分钟远眺20秒',
          '心理健康：感到持续低落要勇敢求助，不是软弱',
          '建立情绪出口：运动、音乐、写作、与信任的人倾诉',
          '睡眠优先：青少年需要8-10小时，不要熬夜',
        ],
      },
      {
        title: '人际关系',
        icon: '👥',
        details: [
          '友谊：找到志同道合的朋友，质量>数量',
          '理解"圈子不同不必强融"，做好自己自然会吸引同频的人',
          '与父母关系：从依赖走向独立，学会沟通而非对抗',
          '尝试对父母说"我需要你的建议"而非"你别管我"',
          '初恋/暗恋：正常的情感体验，保持自尊和底线',
          '学会拒绝：不合理的要求要勇敢说不',
          '网络社交：线上友谊可以有，但不要替代现实交往',
        ],
      },
    ],
  },
  {
    label: '青年', range: '18-29岁', emoji: '🔥', start: 18, end: 29,
    color: 'from-green-50 to-emerald-50', border: 'border-green-200', accent: 'text-green-600',
    bg: 'bg-green-500', ring: 'ring-green-300',
    summary: '人生可能性最多的阶段，在尝试中找到自己的路',
    categories: [
      {
        title: '职业发展',
        icon: '💼',
        details: [
          '18-22岁：大学阶段，专业学习+实习探索双线并行',
          '22-25岁：入行期，接受自己是新手，快速学习',
          '25-29岁：找到方向期，确定要深耕的领域',
          '简历思维：每份工作都问"这能给我增加什么能力"',
          '建立职业网络：参加行业活动、维护前同事关系',
          '学会向上管理：理解领导的需求和痛点',
          '不要怕跳槽，但每次跳槽要有明确目的（能力跃迁/薪资/赛道）',
          '25岁前允许"试错"，25岁后开始"聚焦"',
          '关注行业趋势，保持学习的习惯',
        ],
      },
      {
        title: '财务起步',
        icon: '💰',
        details: [
          '记账3个月，搞清楚钱花在哪里',
          '建立应急基金：存够3-6个月生活费',
          '学习基础理财：定投指数基金是普通人最好的起点',
          '远离消费陷阱：信用卡分期、花呗不是"免费的午餐"',
          '收入≤支出时，先提高收入；收入>支出时，学习投资',
          '25岁前：积累本金比投资回报率更重要',
          '不要借钱消费，不要借钱消费，不要借钱消费',
          '开始了解保险：意外险和医疗险是刚需',
        ],
      },
      {
        title: '亲密关系',
        icon: '💕',
        details: [
          '先了解自己：我的依恋模式是什么？我需要什么样的关系？',
          '学会独处：一个不能和自己相处的人，也无法和他人相处',
          '择偶核心：价值观一致 > 性格互补 > 外在条件',
          '观察对方如何对待服务员、如何处理冲突、如何花钱',
          '红旗警告：控制欲、冷暴力、不尊重你的边界',
          '好的关系是互相成就，不是互相消耗',
          '不将就：单身好过错误的婚姻',
          '学会表达需求和感受，"我觉得…"比"你总是…"有效',
        ],
      },
      {
        title: '个人成长',
        icon: '🚀',
        details: [
          '每年读20本书以上，跨领域阅读',
          '掌握一项"硬技能"：编程、设计、写作、数据分析…',
          '培养一项"软实力"：演讲、谈判、写作、领导力',
          '旅行：每年至少去一个没去过的地方',
          '找到一位人生导师（mentor），主动请教',
          '开始建立个人品牌：写博客、做分享、参与社区',
          '保持运动习惯：代谢25岁后开始下降',
          '学会做饭：健康和省钱',
          '建立自己的信息获取体系（RSS、Newsletter、播客）',
        ],
      },
    ],
  },
  {
    label: '而立', range: '30-39岁', emoji: '🏔️', start: 30, end: 39,
    color: 'from-teal-50 to-cyan-50', border: 'border-teal-200', accent: 'text-teal-600',
    bg: 'bg-teal-500', ring: 'ring-teal-300',
    summary: '从"寻找自己"到"成为自己"，承担责任也成就自我',
    categories: [
      {
        title: '事业深耕',
        icon: '🎯',
        details: [
          '从"执行者"转型为"管理者"或"专家"，选择你的路径',
          '管理者路线：学习带团队、做决策、向上沟通',
          '专家路线：在细分领域做到行业Top 10%',
          '30岁前是靠体力，30岁后要靠经验和判断力',
          '考虑是否需要MBA/在职研究生等学历提升',
          '开始有意识地培养下属，你的价值=团队能力',
          '关注行业周期，不要在夕阳行业里做长期规划',
          '保持职业危机感：随时准备Plan B',
        ],
      },
      {
        title: '家庭经营',
        icon: '👨‍👩‍👧',
        details: [
          '如果选择生育：0-3岁高质量陪伴影响孩子一生',
          '夫妻关系优先于亲子关系，好的婚姻是给孩子最好的礼物',
          '家务分工明确，避免"默认妈妈负责"的不公平',
          '每周预留"二人世界"时间，保持亲密感',
          '与父母关系：从"被照顾"到"照顾者"，做好角色转换',
          '如果选择不生育：不必为此愧疚，人生没有标准答案',
          '经济基础决定家庭抗风险能力，合理规划家庭财务',
        ],
      },
      {
        title: '财务规划',
        icon: '📊',
        details: [
          '目标：实现"财务稳健"而非"财务自由"',
          '房贷不超过家庭收入40%，保留现金流',
          '资产配置：应急金(6个月)+保险+指数基金+房产',
          '给家庭配置完整保险：重疾、医疗、寿险、意外',
          '开始为孩子准备教育基金（如果有的话）',
          '学习税务知识，合法节税',
          '35岁前确定养老规划的大方向',
          '不要all-in任何投资，分散风险',
        ],
      },
      {
        title: '健康投资',
        icon: '🏥',
        details: [
          '30岁后每年体检，关注：血脂、血糖、肝功能、甲状腺',
          '基础代谢每10年下降5-8%，需要增加运动量',
          '力量训练很重要：预防肌肉流失和骨质疏松',
          '关注心理健康：中年焦虑是普遍现象，不是你的错',
          '学会说"不"：时间精力有限，保护自己的优先级',
          '保持一项运动爱好：跑步/游泳/网球/健身',
          '减少应酬中的酒精摄入，对肝脏好一点',
          '每年洗牙1-2次，牙齿问题越早处理越省钱',
        ],
      },
    ],
  },
  {
    label: '不惑', range: '40-49岁', emoji: '🌊', start: 40, end: 49,
    color: 'from-cyan-50 to-sky-50', border: 'border-cyan-200', accent: 'text-cyan-600',
    bg: 'bg-cyan-500', ring: 'ring-cyan-300',
    summary: '人生中场，在经验与智慧中找到内心的平静',
    categories: [
      {
        title: '事业转型',
        icon: '🔄',
        details: [
          '评估职业天花板：当前赛道还有5-10年增长空间吗？',
          '考虑"第二曲线"：在主业之外发展新能力',
          '从"做事"到"做人"：人脉、影响力、行业话语权',
          '担任行业评审、导师、顾问，输出比输入更重要',
          '如果创业：40岁是黄金期——有经验、有人脉、有判断力',
          '学会优雅地"放手"，信任年轻一代',
          '不要和25岁的自己比精力，要比智慧',
        ],
      },
      {
        title: '子女教育',
        icon: '🎓',
        details: [
          '青春期孩子的核心需求：被尊重、被理解、被信任',
          '少说教多倾听，"你觉得呢"比"你应该"有效100倍',
          '给孩子犯错的空间，你的经验不能替代他们的体验',
          '不要把自己的焦虑投射到孩子身上',
          '关注孩子的心理健康比成绩更重要',
          '家庭教育的底线：安全、健康、善良',
          '如果孩子学业不理想，帮助他们找到自己的路',
          '和孩子一起做些事：旅行、运动、做饭',
        ],
      },
      {
        title: '身心健康',
        icon: '🧘',
        details: [
          '40岁是健康的"分水岭"，体检要更全面（增加胃肠镜、心脏检查）',
          '关注更年期（女性45-55岁），了解激素变化对身体的影响',
          '压力管理：冥想、瑜伽、深呼吸，找到适合自己的减压方式',
          '警惕"过劳"信号：失眠、焦虑、心悸、记忆力下降',
          '保持社交：朋友不在多，在深——2-3个知心好友足矣',
          '培养一个与工作无关的爱好：园艺、书法、摄影、钓鱼',
          '40岁后骨质开始流失，补充钙和维D，坚持负重运动',
        ],
      },
      {
        title: '精神成长',
        icon: '🌙',
        details: [
          '开始思考"我真正想要什么"——不再为他人的期待而活',
          '阅读哲学、历史、心理学，建立更完整的认知框架',
          '学会与不确定性共处，"不惑"不是没有困惑，是不再惧怕困惑',
          '减少无效社交，把时间留给真正重要的人和事',
          '尝试公益/志愿服务，从"获得"转向"给予"',
          '写回忆录或家书，记录人生故事给后代',
        ],
      },
    ],
  },
  {
    label: '知天命', range: '50-59岁', emoji: '🌅', start: 50, end: 59,
    color: 'from-blue-50 to-indigo-50', border: 'border-blue-200', accent: 'text-blue-600',
    bg: 'bg-blue-500', ring: 'ring-blue-300',
    summary: '懂得命运的边界，在接纳中找到自由',
    categories: [
      {
        title: '经验传承',
        icon: '🔑',
        details: [
          '成为行业导师，把30年经验系统化地传授',
          '写行业文章、做内部分享、出版专业书籍',
          '帮助年轻人少走弯路，这是最有价值的"遗产"',
          '在公司建立"知识库"或"SOP"，让经验可复用',
          '接受"江山代有才人出"，不要和年轻人较劲',
        ],
      },
      {
        title: '兴趣深耕',
        icon: '🎨',
        details: [
          '重拾年轻时的爱好，现在有时间和经济基础了',
          '学习一项新技能：绘画、乐器、园艺、烹饪、写作',
          '深度旅行：不再是打卡拍照，而是了解一个地方的文化',
          '加入兴趣社群，和志同道合的人一起精进',
          '尝试"创作"而非"消费"：写诗、画画、做手工',
        ],
      },
      {
        title: '关系深化',
        icon: '🤲',
        details: [
          '和配偶进入"第二春"：孩子独立后重新发现彼此',
          '修复断裂的关系：与父母、兄弟姐妹、老友和解',
          '放下怨恨：50岁还记仇，伤害的是自己',
          '学会"退出"孩子的生活，他们有自己的路',
          '珍惜和老朋友的聚会，这些时光不会再重来',
        ],
      },
      {
        title: '退休准备',
        icon: '📋',
        details: [
          '55岁前确定退休财务方案：社保+商业养老+投资组合',
          '评估房产：是否需要 downsizing 换小房子释放资金',
          '制定退休生活计划：不能只有"不工作了"，要有充实的内容',
          '了解养老政策：退休年龄、医保待遇、养老金计算',
          '体检频率提高到每年1-2次，关注心脑血管和肿瘤筛查',
          '开始规划"养老圈"：在哪里养老、和谁一起、需要什么设施',
        ],
      },
    ],
  },
  {
    label: '耳顺', range: '60-69岁', emoji: '🍂', start: 60, end: 69,
    color: 'from-violet-50 to-purple-50', border: 'border-violet-200', accent: 'text-violet-600',
    bg: 'bg-violet-500', ring: 'ring-violet-300',
    summary: '耳顺之年，在从容中享受生命的丰收',
    categories: [
      {
        title: '退休生活',
        icon: '🏡',
        details: [
          '建立新的日常节奏：没有闹钟的日子也需要规划',
          '每天固定时间起床、运动、学习、社交',
          '参与社区活动：合唱团、书法班、太极拳、志愿者',
          '隔代陪伴：享受含饴弄孙的乐趣，但不要成为全职保姆',
          '学习使用数字工具：视频通话、移动支付、网购',
          '保持独处能力：一个人的时光也要过得充实',
        ],
      },
      {
        title: '身心养护',
        icon: '🌿',
        details: [
          '每天散步30分钟以上，是最简单有效的运动',
          '太极拳、八段锦、广场舞：既运动又社交',
          '定期体检：关注心脑血管、骨密度、认知功能',
          '注意防跌倒：家中安装扶手、使用防滑垫',
          '保持大脑活跃：下棋、阅读、学习新技能',
          '关注阿尔茨海默症早期信号，早发现早干预',
          '合理用药：不自行增减药物，注意药物相互作用',
        ],
      },
      {
        title: '旅行探索',
        icon: '✈️',
        details: [
          '趁着身体尚好，去想去的地方',
          '慢旅行：在一个城市住一周，像当地人一样生活',
          '和老伴/老友结伴出行，互相照应',
          '记录旅途：拍照、写游记、收集纪念品',
          '考虑"房车旅行"或"旅居养老"的新生活方式',
        ],
      },
      {
        title: '人生分享',
        icon: '📖',
        details: [
          '写回忆录：不需要出版，留给家人就是最好的礼物',
          '整理老照片，标注时间和故事',
          '和孙辈分享人生故事，传递家族记忆',
          '参加"口述历史"项目，为社会留下珍贵记录',
          '传授传统手艺、菜谱、家训',
        ],
      },
    ],
  },
  {
    label: '古稀', range: '70-79岁', emoji: '🌿', start: 70, end: 79,
    color: 'from-purple-50 to-fuchsia-50', border: 'border-purple-200', accent: 'text-purple-600',
    bg: 'bg-purple-500', ring: 'ring-purple-300',
    summary: '从心所欲不逾矩，在智慧中安享暮年',
    categories: [
      {
        title: '健康守护',
        icon: '🛡️',
        details: [
          '每天适度运动：散步、太极拳、简单的拉伸',
          '饮食清淡易消化：多蔬果、少油盐、适量蛋白质',
          '每季度体检，慢病规律服药',
          '安装一键呼叫设备，手机保持畅通',
          '保持认知训练：读书、下棋、做数独',
          '注意保暖，老年人体温调节能力下降',
          '谨防诈骗：不轻信电话推销、保健品宣传',
        ],
      },
      {
        title: '心灵安宁',
        icon: '🕊️',
        details: [
          '每天留出安静时光：冥想、祈祷或只是发呆',
          '接受身体的限制，不再和年轻时比较',
          '回忆美好往事，但不要沉溺于遗憾',
          '和自然保持连接：养花、看云、听雨',
          '如果有宗教信仰，可以更深入地修行',
          '做好"生前预嘱"：让家人知道你的意愿',
        ],
      },
      {
        title: '亲情陪伴',
        icon: '👨‍👩‍👧‍👦',
        details: [
          '子女探望时享受陪伴，不探望时不抱怨',
          '和孙辈的关系是纯粹的快乐，好好珍惜',
          '和老伴相互扶持，每一天都是礼物',
          '如果独居，保持社交：电话、视频、邻居往来',
          '主动表达爱意：一句"我想你了"永远不会太晚',
        ],
      },
      {
        title: '人生回望',
        icon: '🌟',
        details: [
          '相信你的一生是值得的——每一个选择都构成了独特的你',
          '放下所有未完成的心愿：人生本就不完美',
          '原谅伤害过你的人，也原谅自己的不完美',
          '把最珍贵的人生智慧传递给后代',
          '如果可以，为这个世界留下一点什么：一棵树、一封信、一段话',
          '从容面对每一天，因为"最好的尚未到来"',
        ],
      },
    ],
  },
];

export default function LifeCalendar({ birthYear, setBirthYear, onClose }: LifeCalendarProps) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentAge = currentYear - birthYear;

  // Determine current stage
  const currentStageIdx = LIFE_STAGES.findIndex(s => currentAge >= s.start && currentAge <= s.end);

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        className="relative h-full bg-gradient-to-b from-slate-50 to-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-left"
        style={{ width: Math.min(520, window.innerWidth * 0.92), maxWidth: '92vw' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-4 text-white relative overflow-hidden">
          
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-wide">人生旅程</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <label className="text-white/50 text-xs">出生年份</label>
            <input
              type="number"
              value={birthYear}
              min={1930}
              max={currentYear}
              onChange={(e) => setBirthYear(Number(e.target.value))}
              className="w-[72px] px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs text-white text-center focus:outline-none focus:border-white/40"
            />
            <div className="flex-1 text-right">
              <span className="text-white/70 text-xs">
                当前 <span className="text-amber-300 font-bold text-sm">{currentAge}</span> 岁
              </span>
              <span className="mx-1.5 text-white/30">·</span>
              <span className="text-white/70 text-xs">
                {currentStageIdx >= 0 && (
                  <span className="text-emerald-300 font-medium">{LIFE_STAGES[currentStageIdx].label}阶段</span>
                )}
              </span>
            </div>
          </div>
          {/* Life progress bar */}
          <div className="mt-2.5">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-white/10">
              {LIFE_STAGES.map((s, i) => {
                const widthPct = ((s.end - s.start + 1) / 80) * 100;
                const isActive = i === currentStageIdx;
                const isPast = currentAge > s.end;
                return (
                  <div
                    key={s.label}
                    className={`transition-all ${isActive ? 'opacity-100' : isPast ? 'opacity-50' : 'opacity-20'}`}
                    style={{ width: `${widthPct}%` }}
                  >
                    <div className={`h-full ${isActive ? s.bg : isPast ? 'bg-white/60' : 'bg-white/30'}`} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-white/40">
              <span>0岁</span>
              <span>80岁</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {LIFE_STAGES.map((stage, idx) => {
            const isActive = idx === currentStageIdx;
            const isPast = currentAge > stage.end;
            const isExpanded = expandedStage === idx;
            const stagePct = isPast ? 100 : isActive ? Math.min(100, ((currentAge - stage.start) / (stage.end - stage.start + 1) * 100)) : 0;

            return (
              <div
                key={stage.label}
                className={`rounded-xl border transition-all duration-300 overflow-hidden bg-gradient-to-r ${stage.color} ${stage.border} ${isActive ? `ring-2 ring-offset-1 ${stage.ring} shadow-md` : ''} ${isPast ? 'opacity-60' : ''}`}
              >
                {/* Stage Header - always visible */}
                <button
                  onClick={() => setExpandedStage(isExpanded ? null : idx)}
                  className="w-full text-left p-3.5 flex items-start gap-3 hover:bg-white/30 transition-colors"
                >
                  <span className="text-xl mt-0.5">{stage.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${stage.accent}`}>{stage.label}</span>
                      <span className="text-[10px] text-gray-400">{stage.range}</span>
                      {isActive && (
                        <span className={`text-[9px] ${stage.bg} text-white px-1.5 py-0.5 rounded-full font-medium`}>当前阶段</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{stage.summary}</p>
                    {/* Progress bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div className={`h-full ${stage.bg} rounded-full transition-all duration-500`} style={{ width: `${stagePct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round(stagePct)}%</span>
                    </div>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    className={`text-gray-400 mt-1 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 space-y-2.5 animate-fade-in">
                    {stage.categories.map((cat) => {
                      const isCatExpanded = expandedCategory === `${idx}-${cat.title}`;
                      return (
                        <div key={cat.title} className="bg-white/60 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedCategory(isCatExpanded ? null : `${idx}-${cat.title}`)}
                            className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-white/40 transition-colors"
                          >
                            <span className="text-sm">{cat.icon}</span>
                            <span className={`text-xs font-semibold ${stage.accent}`}>{cat.title}</span>
                            <svg
                              width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                              className={`text-gray-400 ml-auto transition-transform duration-200 ${isCatExpanded ? 'rotate-180' : ''}`}
                            >
                              <path d="M4 6l4 4 4-4" />
                            </svg>
                          </button>
                          {isCatExpanded && (
                            <div className="px-3 pb-3 space-y-1.5">
                              {cat.details.map((detail, di) => (
                                <div key={di} className="flex items-start gap-2 text-[11px] text-gray-600 leading-relaxed">
                                  <span className="text-gray-300 mt-0.5 flex-shrink-0">•</span>
                                  <span>{detail}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom quote */}
          <div className="mt-4 p-4 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-xl border border-indigo-100">
            <div className="text-center text-xs text-gray-500 italic leading-relaxed">
              &ldquo;种一棵树最好的时间是十年前，<br />其次是现在。&rdquo;<br />
              <span className="text-[10px] text-gray-400 not-italic">—— 无论你处在人生哪个阶段，当下就是最好的开始</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
