import { createLLMStream } from '@/lib/llm';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, achievements, regrets, insights, tomorrowFocus, mood, energy, events, doneTodos, pendingTodos } = body;

    const userContent = `
日期：${date}
心情：${mood}，精力：${energy}

【今日成就】
${achievements.length > 0 ? achievements.map((a: string, i: number) => `${i+1}. ${a}`).join('\n') : '（未填写）'}

【今日遗憾】
${regrets.length > 0 ? regrets.map((r: string, i: number) => `${i+1}. ${r}`).join('\n') : '（未填写）'}

【关键洞察】
${insights.length > 0 ? insights.map((ins: string, i: number) => `${i+1}. ${ins}`).join('\n') : '（未填写）'}

【明日重点】
${tomorrowFocus.length > 0 ? tomorrowFocus.map((t: string, i: number) => `${i+1}. ${t}`).join('\n') : '（未填写）'}

【日程完成情况】
已完成：${doneTodos.length > 0 ? doneTodos.join('、') : '无'}
未完成：${pendingTodos.length > 0 ? pendingTodos.join('、') : '无'}
日程：${events.length > 0 ? events.join('；') : '无'}
`;

    const systemPrompt = `你是每日复盘教练，专注帮用户从日常中提炼行动智慧。
要求：
1. 先给一句话总结今天的整体评价
2. 再给2-3条关键发现（每条1-2行）
3. 最后给1-2条具体可执行的改进建议
禁止寒暄、禁止鸡汤、禁止空泛鼓励，直接给有价值的洞察`;

    return createLLMStream(request, [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userContent },
    ], { temperature: 0.7 });
  } catch {
    return new Response(JSON.stringify({ error: '复盘分析失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
