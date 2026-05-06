import { createLLMStream } from '@/lib/llm';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, highlights, reflections, takeaways, nextActions, gratitude, mood, energy, events, doneTodos, pendingTodos } = body;

    // Support both string (textarea) and array formats
    const toArray = (v: unknown): string[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string' && v.trim()) return v.split('\n').filter((l: string) => l.trim());
      return [];
    };
    const hlArr = toArray(highlights);
    const refArr = toArray(reflections);
    const tkArr = toArray(takeaways);
    const naArr = toArray(nextActions);
    const grArr = toArray(gratitude);

    const userContent = `
日期：${date}
心情：${mood}，精力：${energy}

【今日亮点】
${hlArr.length > 0 ? hlArr.map((a: string, i: number) => `${i+1}. ${a}`).join('\n') : '（未填写）'}

【今日反思】
${refArr.length > 0 ? refArr.map((r: string, i: number) => `${i+1}. ${r}`).join('\n') : '（未填写）'}

【今日收获】
${tkArr.length > 0 ? tkArr.map((ins: string, i: number) => `${i+1}. ${ins}`).join('\n') : '（未填写）'}

【明日行动】
${naArr.length > 0 ? naArr.map((t: string, i: number) => `${i+1}. ${t}`).join('\n') : '（未填写）'}

【今日感恩】
${grArr.length > 0 ? grArr.map((g: string, i: number) => `${i+1}. ${g}`).join('\n') : '（未填写）'}

【日程完成情况】
已完成：${Array.isArray(doneTodos) && doneTodos.length > 0 ? doneTodos.join('、') : '无'}
未完成：${Array.isArray(pendingTodos) && pendingTodos.length > 0 ? pendingTodos.join('、') : '无'}
日程：${Array.isArray(events) && events.length > 0 ? events.join('；') : '无'}
`;

    const systemPrompt = `你是每日复盘教练，专注帮用户从日常中提炼行动智慧。
要求：
1. 先给一句话总结今天的整体评价
2. 再给2-3条关键发现（每条1-2行）
3. 最后给1-2条具体可执行的改进建议
特别关注用户的亮点和感恩内容，给予正向反馈；对反思内容给出建设性意见而非批判。
禁止寒暄、禁止鸡汤、禁止空泛鼓励，直接给有价值的洞察`;

    return createLLMStream(request, [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userContent },
    ], { temperature: 0.7 });
  } catch (err) {
    console.error('[daily-review] Error:', err);
    return new Response(JSON.stringify({ error: '复盘分析失败', detail: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
