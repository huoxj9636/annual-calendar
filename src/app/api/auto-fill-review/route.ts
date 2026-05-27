import { createLLMStream } from '@/lib/llm';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, okrData, events, doneTodos, pendingTodos } = body as {
      date: string;
      okrData: {
        objectives: {
          title: string;
          period: string;
          children: {
            title: string;
            targetValue: number;
            children: { title: string; done: boolean }[];
          }[];
        }[];
      };
      events: string[];
      doneTodos: string[];
      pendingTodos: string[];
    };

    // Build OKR summary
    const okrSummary = okrData.objectives
      .filter(o => o.period === date.slice(0, 4) || o.period.includes('Q'))
      .map(o => {
        const krLines = o.children.map(kr => {
          const doneTasks = kr.children.filter(t => t.done);
          const pct = kr.children.length > 0 ? Math.round((doneTasks.length / kr.children.length) * 100) : 0;
          const taskLines = kr.children.map(t => `      ${t.done ? '✓' : '○'} ${t.title}`).join('\n');
          return `  KR: ${kr.title} (${pct}%, 目标值${kr.targetValue})\n${taskLines}`;
        }).join('\n');
        const oPct = o.children.length > 0
          ? Math.round(o.children.reduce((sum, kr) => {
              const d = kr.children.filter(t => t.done).length;
              return sum + (kr.children.length > 0 ? d / kr.children.length : 0);
            }, 0) / o.children.length * 100)
          : 0;
        return `O: ${o.title} (进度${oPct}%)\n${krLines}`;
      }).join('\n\n');

    const todayDoneTasks: string[] = [];
    const todayPendingTasks: string[] = [];
    okrData.objectives.forEach(o => {
      o.children.forEach(kr => {
        kr.children.forEach(t => {
          if (t.done) todayDoneTasks.push(`[${o.title}] ${t.title}`);
          else todayPendingTasks.push(`[${o.title}] ${t.title}`);
        });
      });
    });

    const userContent = `
日期：${date}

【OKR 目标与进度】
${okrSummary || '（暂无OKR）'}

【今日完成的任务】
${todayDoneTasks.length > 0 ? todayDoneTasks.map((t, i) => `${i + 1}. ${t}`).join('\n') : '（无已完成任务）'}

【今日未完成的任务】
${todayPendingTasks.length > 0 ? todayPendingTasks.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join('\n') : '（无未完成任务）'}

【日程安排】
${events.length > 0 ? events.join('；') : '（无日程）'}

【待办完成情况】
已完成待办：${doneTodos.length > 0 ? doneTodos.join('、') : '无'}
未完成待办：${pendingTodos.length > 0 ? pendingTodos.join('、') : '无'}
`;

    const systemPrompt = `你是每日复盘助手，根据用户的OKR目标和当日任务完成情况，自动填写每日复盘的5个维度。

要求：
1. 基于OKR目标和任务完成数据，生成具体、真实的内容，不要泛泛而谈
2. 每个维度生成1-3条，每条用 "1. " "2. " 编号格式
3. 内容要具体到OKR中的实际目标和任务名称
4. 如果有任务完成，今日亮点要提到；如果有任务未完成，今日反思要分析原因
5. 明日行动要从OKR中未完成的任务里提炼
6. 今日感恩可以从完成的工作、获得的进展等方面展开

5个维度的填写要求：
- 今日亮点：基于今日完成的任务，提炼值得骄傲的进展
- 今日反思：基于未完成的任务或低进度的KR，分析原因
- 今日收获：从OKR推进过程中提炼认知和经验
- 明日行动：从OKR中未完成的KR/任务中提炼下一步行动
- 今日感恩：围绕工作进展、目标推进中值得感恩的事

禁止寒暄，禁止空泛鼓励，禁止鸡汤。只输出5个维度的内容，每个维度用【】标注标题。`;

    return createLLMStream(request, [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userContent },
    ], { temperature: 0.6 });
  } catch (err) {
    console.error('[auto-fill-review] Error:', err);
    return new Response(JSON.stringify({ error: '自动填充失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
