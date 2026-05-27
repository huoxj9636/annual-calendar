import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { objective, period, age } = body as { objective: string; period?: string; age?: number };

    if (!objective) {
      return NextResponse.json({ error: 'Missing objective' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const prompt = `你是一位OKR目标拆解专家。根据以下目标，自动拆解为3-5个关键结果(KR)，每个KR下拆解2-4个具体可执行的任务(Task)。

目标：${objective}
${period ? `周期：${period}` : ''}
${age ? `用户年龄：${age}岁` : ''}

要求：
1. KR必须是可衡量的关键结果，带有具体数字目标
2. Task必须是具体的、可执行的动作，不是模糊的方向
3. 符合OKR方法论：O是方向，KR是衡量标准，Task是执行动作
4. 考虑用户年龄和周期，给出切实可行的拆解

严格按以下JSON格式输出，不要输出任何其他内容：
{
  "keyResults": [
    {
      "title": "KR标题（含具体数字目标）",
      "targetValue": 数字,
      "tasks": [
        "任务1描述",
        "任务2描述"
      ]
    }
  ]
}`;

    const messages = [
      { role: 'system' as const, content: '你是OKR拆解专家，只输出JSON，不要输出其他内容。' },
      { role: 'user' as const, content: prompt },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.7,
    });

    const content = response.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI decompose error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
