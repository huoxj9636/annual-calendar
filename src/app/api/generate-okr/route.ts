import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { theme, userContext } = body as {
      theme: string;
      userContext?: string;
    };

    if (!theme) {
      return NextResponse.json({ error: 'theme is required' }, { status: 400 });
    }

    // Fetch recent review data for context
    const year = new Date().getFullYear();
    const client = getSupabaseClient();
    const { data: reviews } = await client
      .from('daily_reviews')
      .select('month, day, completed, good_things, problems, mood, reflections, tomorrow_todo')
      .eq('year', year)
      .order('month', { ascending: false })
      .order('day', { ascending: false })
      .limit(20);

    // Build context from reviews
    let reviewContext = '';
    if (reviews && reviews.length > 0) {
      const relevantTexts = reviews
        .map((r: Record<string, unknown>) => {
          const parts = [r.completed, r.good_things, r.problems, r.mood, r.reflections, r.tomorrow_todo]
            .filter(Boolean)
            .join(' ');
          return parts.trim() ? `${r.month}/${r.day}: ${parts}` : '';
        })
        .filter(Boolean)
        .slice(0, 10);
      reviewContext = relevantTexts.join('\n');
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const prompt = `你是OKR教练。根据用户的复盘数据和选定的改善方向，生成一个精准可执行的年度OKR。

严格约束：
1. Objective描述一个期望到达的状态，不超过15字，具体不空泛
2. 生成3个Key Results，每个KR必须包含量化指标
3. 每个KR附带2-3个具体的Task（下周就能做的第一步动作）
4. 每个Task必须指定计划执行日期（plannedDate），格式"YYYY-MM-DD"，从${todayStr}开始往后排，任务尽量分散在不同天，不要集中在同一天
5. KR要考虑用户的实际约束（从复盘数据推断），不要给出正确的废话
6. 不要用"提升""加强""改善"这类模糊词，用具体的动作和结果
7. 如果复盘数据中有"又XX了"的重复模式，优先解决这个重复问题

改善方向：${theme}
${userContext ? `用户补充：${userContext}` : ''}
${reviewContext ? `用户近期复盘数据：\n${reviewContext}` : '（暂无复盘数据）'}

请以JSON格式返回，结构如下：
{
  "objective": "目标描述",
  "keyResults": [
    {
      "title": "KR描述（包含量化指标）",
      "targetValue": 100,
      "tasks": [
        {"title": "具体任务1", "plannedDate": "2025-06-15"},
        {"title": "具体任务2", "plannedDate": "2025-06-20"}
      ]
    }
  ]
}

只返回JSON，不要其他文字。`;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    const messages = [{ role: 'user' as const, content: prompt }];
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.3,
    });

    if (!response?.content) {
      return NextResponse.json({ error: 'AI生成失败' }, { status: 500 });
    }

    // Parse JSON from result
    let okrData;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json({ error: 'AI返回格式错误' }, { status: 500 });
      }
      okrData = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: 'AI返回JSON解析失败' }, { status: 500 });
    }

    return NextResponse.json({
      objective: okrData.objective || theme,
      keyResults: (okrData.keyResults || []).map((kr: { title?: string; targetValue?: number; tasks?: Array<string | { title: string; plannedDate?: string }> }) => ({
        title: kr.title || '',
        targetValue: kr.targetValue || 100,
        tasks: (kr.tasks || []).map((t) => {
          if (typeof t === 'string') {
            return { title: t, plannedDate: '' };
          }
          return { title: t.title || '', plannedDate: t.plannedDate || '' };
        }),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[generate-okr] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
