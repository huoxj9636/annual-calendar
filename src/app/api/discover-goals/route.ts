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

export async function GET(request: NextRequest) {
  try {
    const year = new Date().getFullYear();
    const client = getSupabaseClient();

    // Fetch all reviews for this year
    const { data: reviews, error } = await client
      .from('daily_reviews')
      .select('month, day, completed, good_things, problems, mood, reflections, tomorrow_todo')
      .eq('year', year)
      .order('month', { ascending: false })
      .order('day', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({
        hasData: false,
        themes: [],
        message: '暂无复盘数据，请先开始每日复盘',
      });
    }

    // Combine all review text for analysis
    const allText = (reviews as ReviewRow[])
      .map((r) => {
        const parts = [r.completed, r.good_things, r.problems, r.mood, r.reflections, r.tomorrow_todo]
          .filter(Boolean)
          .join(' ');
        return parts.trim();
      })
      .filter(Boolean)
      .join('\n');

    if (allText.length < 10) {
      return NextResponse.json({
        hasData: true,
        themes: [],
        message: '复盘内容太少，继续积累后将发现你的模式',
      });
    }

    // Use LLM to extract recurring themes
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    const prompt = `分析以下每日复盘内容，提取用户反复出现的困扰、未实现的愿望和"应该做但没做"的事情。

重点关注：
1. 用户反复提到但没解决的问题（如"又熬夜了""又拖延了"）
2. 用户"应该"做但一直没做的事
3. 用户反复表达的不满或焦虑
4. 用户反复提到的想尝试但没行动的事

复盘内容：
${allText.slice(0, 8000)}

请以JSON数组格式返回3-6个发现的主题，结构如下：
[
  {
    "keyword": "关键词（2-4字）",
    "count": 出现次数,
    "pattern": "反复模式描述（如'说了8次又熬夜了'）",
    "suggestion": "简短的改善建议（10字以内）"
  }
]

只返回JSON数组，不要其他文字。如果没有明显的反复模式，返回空数组。`;

    const messages = [{ role: 'user' as const, content: prompt }];
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.2,
    });

    let themes: Array<{ keyword: string; count: number; pattern: string; suggestion: string }> = [];
    try {
      if (response?.content) {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          themes = JSON.parse(jsonMatch[0]);
        }
      }
    } catch {
      // Fallback: simple keyword extraction
      themes = extractThemesSimple(reviews as ReviewRow[]);
    }

    // If LLM failed to extract, use simple extraction
    if (themes.length === 0) {
      themes = extractThemesSimple(reviews as ReviewRow[]);
    }

    return NextResponse.json({
      hasData: true,
      themes,
      reviewCount: reviews.length,
      message: themes.length > 0 ? `从${reviews.length}天复盘中发现了${themes.length}个反复出现的主题` : '暂未发现明显反复模式',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[discover-goals] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Simple keyword extraction as fallback
function extractThemesSimple(reviews: ReviewRow[]): Array<{ keyword: string; count: number; pattern: string; suggestion: string }> {
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

  const results: Array<{ keyword: string; count: number; pattern: string; suggestion: string }> = [];

  for (const [keyword, regex] of Object.entries(keywordPatterns)) {
    const matches = reviews.filter((r) => {
      const text = [r.completed, r.good_things, r.problems, r.mood, r.reflections, r.tomorrow_todo].join(' ');
      return regex.test(text);
    });

    if (matches.length >= 2) {
      // Check for "又" pattern
      const youCount = matches.filter((r) => {
        const text = [r.completed, r.good_things, r.problems, r.mood, r.reflections, r.tomorrow_todo].join(' ');
        return text.includes('又') && regex.test(text);
      }).length;

      results.push({
        keyword,
        count: matches.length,
        pattern: youCount > 0 ? `说了${youCount}次"又${keyword}了"` : `有${matches.length}天提到了${keyword}`,
        suggestion: getSuggestion(keyword),
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
