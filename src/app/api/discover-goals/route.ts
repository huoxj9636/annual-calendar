import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

interface ReviewRow {
  month: number;
  day: number;
  completed: string;
  good_things: string;
  problems: string;
  mood: string;
  reflections: string;
  tomorrow_todo: string;
}

interface OverrideRow {
  date_key: string;
  value: string;
}

interface TodoRow {
  month: number;
  day: number;
  text: string;
  done: boolean;
}

interface EventRow {
  month: number;
  day: number;
  title: string;
}

// 数据源分析结果
interface DataSourceSignals {
  source1_checkPattern: string[];    // 勾叉模式信号
  source2_shouldSentences: string[]; // "应该"句式
  source3_againSentences: string[];  // "又"字句式
  source4_noteContent: string[];     // 导入笔记内容
  source5_canceledTodos: string[];   // 反复创建但未完成的待办
  source6_aiThemes: string[];        // AI自由分析发现的反复主题
  allReviewText: string;             // 所有复盘原文（给AI参考）
}

export async function GET(request: NextRequest) {
  try {
    const year = new Date().getFullYear();
    const client = getSupabaseClient();

    // 追溯3个月的数据，如果不足15条则扩展到6个月
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // 并行获取5大数据源（查当年数据，后续按日期范围过滤）
    const [reviewsRes, overridesRes, todosRes] = await Promise.all([
      client
        .from('daily_reviews')
        .select('month, day, completed, good_things, problems, mood, reflections, tomorrow_todo')
        .eq('year', year),
      client
        .from('calendar_overrides')
        .select('date_key, value')
        .eq('year', year),
      client
        .from('day_todos')
        .select('month, day, text, done')
        .eq('year', year),
    ]);

    if (reviewsRes.error) {
      return NextResponse.json({ error: reviewsRes.error.message }, { status: 500 });
    }

    const allReviews = (reviewsRes.data || []) as ReviewRow[];
    const allOverrides = (overridesRes.data || []) as OverrideRow[];
    const allTodos = (todosRes.data || []) as TodoRow[];

    // 按日期过滤：只保留最近3个月的数据
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    function isWithinCutoff(month: number, day: number): boolean {
      const d = new Date(year, month - 1, day);
      return d >= cutoffDate;
    }

    // 逐步扩展时间范围：3个月 → 6个月 → 12个月
    let actualMonths = 3;
    let reviews = allReviews.filter(r => isWithinCutoff(r.month, r.day));
    let overrides = allOverrides.filter(r => {
      const parts = r.date_key.split('-');
      return parts.length >= 3 && isWithinCutoff(parseInt(parts[1]), parseInt(parts[2]));
    });
    let todos = allTodos.filter(r => isWithinCutoff(r.month, r.day));

    if (reviews.length < 15) {
      actualMonths = 6;
      const extendedCutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      function isWithin6(month: number, day: number): boolean {
        const d = new Date(year, month - 1, day);
        return d >= extendedCutoff;
      }
      reviews = allReviews.filter(r => isWithin6(r.month, r.day));
      overrides = allOverrides.filter(r => {
        const parts = r.date_key.split('-');
        return parts.length >= 3 && isWithin6(parseInt(parts[1]), parseInt(parts[2]));
      });
      todos = allTodos.filter(r => isWithin6(r.month, r.day));
    }

    if (reviews.length < 15) {
      actualMonths = 12;
      const extendedCutoff = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
      function isWithin12(month: number, day: number): boolean {
        const d = new Date(year, month - 1, day);
        return d >= extendedCutoff;
      }
      reviews = allReviews.filter(r => isWithin12(r.month, r.day));
      overrides = allOverrides.filter(r => {
        const parts = r.date_key.split('-');
        return parts.length >= 3 && isWithin12(parseInt(parts[1]), parseInt(parts[2]));
      });
      todos = allTodos.filter(r => isWithin12(r.month, r.day));
    }

    // 从5个数据源提取信号
    const signals = extractSignals(reviews, overrides, todos);

    // 初始化LLM客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // === 来源6：AI自由分析复盘原文中的反复主题 ===
    let source6_aiThemes: string[] = [];
    if (signals.allReviewText.length > 50) {
      try {
        const aiAnalysisPrompt = `你是一个信号发现者。请从以下用户的日常复盘中，找出反复出现的困扰或向往。

重点关注：
- 反复出现的情绪、行为、话题
- 用户暗示想做但没做的事
- 反复出现的困境或纠结
- 不要局限于"应该""又"等关键词，要发现更深层的反复模式

复盘内容：
${signals.allReviewText.slice(0, 6000)}

请以JSON数组格式返回你发现的反复主题：
[
  {
    "keyword": "关键词（2-4字）",
    "count": 出现次数,
    "pattern": "反复模式描述",
    "suggestion": "简短改善建议"
  }
]

只返回JSON数组，不要其他文字。如果没有发现反复模式，返回空数组。`;

        const aiAnalysisMessages = [{ role: 'user' as const, content: aiAnalysisPrompt }];
        const aiAnalysisResponse = await llmClient.invoke(aiAnalysisMessages, {
          model: 'doubao-seed-2-0-lite-260215',
          temperature: 0.3,
        });

        if (aiAnalysisResponse?.content) {
          const jsonMatch = aiAnalysisResponse.content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const aiThemes = JSON.parse(jsonMatch[0]);
            if (Array.isArray(aiThemes)) {
              source6_aiThemes = aiThemes.map((t: { keyword?: string; pattern?: string }) =>
                t.keyword ? `"${t.keyword}"：${t.pattern || '反复出现'}` : ''
              ).filter(Boolean);
            }
          }
        }
      } catch {
        // AI自由分析失败不影响主流程
        source6_aiThemes = [];
      }
    }
    signals.source6_aiThemes = source6_aiThemes;

    // 检查是否有足够的数据
    const totalSignals =
      signals.source1_checkPattern.length +
      signals.source2_shouldSentences.length +
      signals.source3_againSentences.length +
      signals.source4_noteContent.length +
      signals.source5_canceledTodos.length +
      signals.source6_aiThemes.length;

    if (totalSignals === 0 && signals.allReviewText.length < 10) {
      return NextResponse.json({
        hasData: false,
        themes: [],
        message: '暂无复盘数据，请先开始每日复盘',
      });
    }

    // 使用LLM综合6个信号源，去重合并
    const mergePrompt = `你是一个目标发现助手。从用户的6种日常信号中提取反复出现的困扰和向往。

## 信号来源

### 来源1：日历勾叉模式
${signals.source1_checkPattern.length > 0 ? signals.source1_checkPattern.join('\n') : '（无显著模式）'}

### 来源2："应该"句式（用户说了想做什么但没做到）
${signals.source2_shouldSentences.length > 0 ? signals.source2_shouldSentences.map((s, i) => `${i + 1}. ${s}`).join('\n') : '（未发现"应该"句式）'}

### 来源3："又"字句式（承认反复失败，最高质量的OKR种子）
${signals.source3_againSentences.length > 0 ? signals.source3_againSentences.map((s, i) => `${i + 1}. ${s}`).join('\n') : '（未发现"又"字句式）'}

### 来源4：导入的笔记内容（用户关心的主题）
${signals.source4_noteContent.length > 0 ? signals.source4_noteContent.slice(0, 30).map((s, i) => `${i + 1}. ${s}`).join('\n') : '（无导入笔记）'}

### 来源5：反复创建但未完成的待办事项
${signals.source5_canceledTodos.length > 0 ? signals.source5_canceledTodos.map((s, i) => `${i + 1}. ${s}`).join('\n') : '（无未完成待办模式）'}

### 来源6：AI深度分析发现的反复主题
${signals.source6_aiThemes.length > 0 ? signals.source6_aiThemes.map((s, i) => `${i + 1}. ${s}`).join('\n') : '（未发现额外反复模式）'}

---

请综合以上6个信号源，去重合并，提取3-8个反复出现的主题。重点关注：
1. "又"字句式是最强信号 = 承认反复失败 = 有强烈意愿但缺方法
2. "应该"句式 = 用户自己说了想做什么，只是没做到
3. 连续✗模式 = 某维度在系统性失控
4. 反复未完成待办 = 有行动意愿但执行困难
5. AI深度分析 = 可能发现前5个结构化源未覆盖的深层模式

以JSON数组格式返回：
[
  {
    "keyword": "关键词（2-4字）",
    "count": 出现次数,
    "pattern": "反复模式描述（如'说了8次又熬夜了'）",
    "suggestion": "简短的改善建议（10字以内）",
    "source": "信号来源（如'又字句式/应该句式/勾叉模式/未完成待办/导入笔记/AI分析/多源综合'）"
  }
]

只返回JSON数组，不要其他文字。如果没有明显的反复模式，返回空数组。`;

    const messages = [{ role: 'user' as const, content: mergePrompt }];
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.2,
    });

    let themes: Array<{ keyword: string; count: number; pattern: string; suggestion: string; source: string }> = [];
    try {
      if (response?.content) {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          themes = JSON.parse(jsonMatch[0]);
        }
      }
    } catch {
      themes = extractThemesSimple(reviews);
    }

    if (themes.length === 0) {
      themes = extractThemesSimple(reviews);
    }

    return NextResponse.json({
      hasData: true,
      themes,
      reviewCount: reviews.length,
      actualMonths,
      signalStats: {
        checkPatterns: signals.source1_checkPattern.length,
        shouldSentences: signals.source2_shouldSentences.length,
        againSentences: signals.source3_againSentences.length,
        noteContent: signals.source4_noteContent.length,
        canceledTodos: signals.source5_canceledTodos.length,
        aiAnalysis: signals.source6_aiThemes.length,
      },
      message: themes.length > 0 ? `从${reviews.length}天复盘中发现了${themes.length}个反复出现的主题` : '暂未发现明显反复模式',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[discover-goals] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * 从5个数据源提取信号
 */
function extractSignals(
  reviews: ReviewRow[],
  overrides: OverrideRow[],
  todos: TodoRow[]
): DataSourceSignals {
  const source1_checkPattern: string[] = [];
  const source2_shouldSentences: string[] = [];
  const source3_againSentences: string[] = [];
  const source4_noteContent: string[] = [];
  const source5_canceledTodos: string[] = [];
  const source6_aiThemes: string[] = [];

  // === 来源1：日历勾叉模式 ===
  const crossDates = overrides
    .filter(o => o.value === 'crossed')
    .map(o => o.date_key)
    .sort();
  const checkDates = overrides
    .filter(o => o.value === 'checked')
    .map(o => o.date_key)
    .sort();

  // 连续✗模式
  if (crossDates.length >= 3) {
    const streaks = findConsecutiveStreaks(crossDates);
    for (const streak of streaks) {
      if (streak.length >= 3) {
        source1_checkPattern.push(
          `连续${streak.length}天✗（${streak[0]} ~ ${streak[streak.length - 1]}），说明某个维度在系统性失控`
        );
      }
    }
  }

  // 周末✓工作日✗模式
  if (crossDates.length >= 5 && checkDates.length >= 3) {
    const weekdayCrosses = crossDates.filter(d => {
      const dayOfWeek = new Date(d).getDay();
      return dayOfWeek > 0 && dayOfWeek < 6;
    });
    const weekendChecks = checkDates.filter(d => {
      const dayOfWeek = new Date(d).getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    });
    if (weekdayCrosses.length > checkDates.length * 0.7 && weekendChecks.length > 2) {
      source1_checkPattern.push(
        `工作日多✗（${weekdayCrosses.length}天）周末多✓（${weekendChecks.length}天），工作日和周末的落差说明工作日状态系统性偏差`
      );
    }
  }

  // === 来源2 & 3 & 4：复盘内容分析 ===
  for (const r of reviews) {
    const fields = [r.completed, r.good_things, r.problems, r.mood, r.reflections, r.tomorrow_todo];
    const text = fields.filter(Boolean).join(' ');
    if (!text.trim()) continue;

    // 来源2："应该"句式
    const shouldMatches = text.match(/应该[^\s，。！？；,\.!?;]{1,20}/g);
    if (shouldMatches) {
      for (const m of shouldMatches) {
        source2_shouldSentences.push(`"${m}"（${r.month}月${r.day}日）`);
      }
    }

    // 来源3："又"字句式
    const againMatches = text.match(/又[^\s，。！？；,\.!?;]{1,15}/g);
    if (againMatches) {
      for (const m of againMatches) {
        source3_againSentences.push(`"${m}"（${r.month}月${r.day}日）`);
      }
    }

    // 来源4：导入的笔记内容（复盘内容较长且completed字段有内容的，很可能是导入的）
    if (r.completed && r.completed.length > 50) {
      source4_noteContent.push(`${r.completed.slice(0, 80)}${r.completed.length > 80 ? '...' : ''}（${r.month}月${r.day}日）`);
    }
  }

  // === 来源5：反复创建但未完成的待办 ===
  const todoByText = new Map<string, { text: string; count: number; doneCount: number }>();
  for (const t of todos) {
    const key = t.text.trim().slice(0, 30);
    if (!key) continue;
    const existing = todoByText.get(key);
    if (existing) {
      existing.count++;
      if (t.done) existing.doneCount++;
    } else {
      todoByText.set(key, { text: t.text, count: 1, doneCount: t.done ? 1 : 0 });
    }
  }

  for (const [, info] of todoByText) {
    // 多次创建但完成率低
    if (info.count >= 2 && info.doneCount < info.count * 0.5) {
      source5_canceledTodos.push(
        `"${info.text.slice(0, 30)}" 创建${info.count}次仅完成${info.doneCount}次`
      );
    }
  }

  // 拼接所有复盘原文
  const allReviewText = reviews
    .map(r => {
      const parts = [r.completed, r.good_things, r.problems, r.mood, r.reflections, r.tomorrow_todo]
        .filter(Boolean)
        .join(' ');
      return parts.trim() ? `[${r.month}月${r.day}日] ${parts.trim()}` : '';
    })
    .filter(Boolean)
    .join('\n');

  return {
    source1_checkPattern,
    source2_shouldSentences,
    source3_againSentences,
    source4_noteContent,
    source5_canceledTodos,
    source6_aiThemes,
    allReviewText,
  };
}

/**
 * 找出日期列表中的连续序列
 */
function findConsecutiveStreaks(dates: string[]): string[][] {
  if (dates.length === 0) return [];
  const streaks: string[][] = [];
  let current: string[] = [dates[0]];

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(current[current.length - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      current.push(dates[i]);
    } else {
      if (current.length >= 3) streaks.push(current);
      current = [dates[i]];
    }
  }
  if (current.length >= 3) streaks.push(current);
  return streaks;
}

// Simple keyword extraction as fallback
function extractThemesSimple(reviews: ReviewRow[]): Array<{ keyword: string; count: number; pattern: string; suggestion: string; source: string }> {
  const keywordPatterns: Record<string, RegExp> = {
    '熬夜': /熬夜|晚睡|凌晨|2点睡|3点睡/,
    '拖延': /拖延|推迟|没做完|又没/,
    '运动': /运动|跑步|锻炼|健身|没去跑/,
    '焦虑': /焦虑|焦虑|压力大|压力|烦躁/,
    '学习': /学习|读书|看书|课程|没学/,
    '早起': /早起|起晚了|赖床|睡过头/,
    '饮食': /饮食|暴饮暴食|外卖|吃太多|减肥/,
    '专注': /分心|走神|刷手机|摸鱼|不专注/,
  };

  const results: Array<{ keyword: string; count: number; pattern: string; suggestion: string; source: string }> = [];

  for (const [keyword, regex] of Object.entries(keywordPatterns)) {
    const matches = reviews.filter((r) => {
      const text = [r.completed, r.good_things, r.problems, r.mood, r.reflections, r.tomorrow_todo].join(' ');
      return regex.test(text);
    });

    if (matches.length >= 2) {
      const youCount = matches.filter((r) => {
        const text = [r.completed, r.good_things, r.problems, r.mood, r.reflections, r.tomorrow_todo].join(' ');
        return text.includes('又') && regex.test(text);
      }).length;

      const shouldCount = matches.filter((r) => {
        const text = [r.completed, r.good_things, r.problems, r.mood, r.reflections, r.tomorrow_todo].join(' ');
        return text.includes('应该') && regex.test(text);
      }).length;

      let source = '复盘内容';
      if (youCount > 0) source = '又字句式';
      else if (shouldCount > 0) source = '应该句式';

      results.push({
        keyword,
        count: matches.length,
        pattern: youCount > 0 ? `说了${youCount}次"又${keyword}了"` : `有${matches.length}天提到了${keyword}`,
        suggestion: getSuggestion(keyword),
        source,
      });
    }
  }

  return results.sort((a, b) => b.count - a.count).slice(0, 5);
}

function getSuggestion(keyword: string): string {
  const suggestions: Record<string, string> = {
    '熬夜': '重建作息规律',
    '拖延': '拆解小步骤行动',
    '运动': '从每天10分钟开始',
    '焦虑': '练习正念冥想',
    '学习': '设定每日微目标',
    '早起': '先调整入睡时间',
    '饮食': '记录饮食规律',
    '专注': '番茄工作法练习',
  };
  return suggestions[keyword] || '从小步骤开始改变';
}
