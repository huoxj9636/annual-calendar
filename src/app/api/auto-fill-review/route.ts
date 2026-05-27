import { createLLMStream } from '@/lib/llm';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, okrData, events, doneTodos, pendingTodos, voiceText } = body as {
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
      voiceText?: string;
    };

    // Voice mode: polish and categorize spoken text
    if (voiceText && voiceText.trim()) {
      const systemPrompt = `你是每日复盘助手。用户通过语音口述了今天的复盘内容，请将其润色整理后归入以下6个维度。

要求：
1. 仔细理解用户口述内容，提取关键信息分配到对应维度
2. 润色语言使其更简洁清晰，但保留用户原意和关键细节
3. 每个维度1-3条，用 "1. " "2. " 编号格式
4. 如果用户口述中某个维度没有相关内容，写"无"
5. 禁止寒暄、禁止空泛鼓励、禁止鸡汤、禁止加粗标记
6. 只输出6个维度的内容，每个维度用【】标注标题

6个维度：
- 今天完成了什么：列出完成的任务和工作进展
- 今天发生了哪些美好或值得关注的事：值得记录的好事或新发现
- 今天遇到了哪些突发问题：遇到的困难或意外
- 今天心情如何：整体情绪状态
- 今天有哪些感想或总结：认知和经验提炼
- 明日待办：明天的行动计划`;

      const userContent = `日期：${date}

用户的语音口述内容：
${voiceText}`;

      return createLLMStream(request, [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userContent },
      ], { temperature: 0.3 });
    }

    // Original auto-fill mode
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

    const systemPrompt = `你是每日复盘助手，根据用户的OKR目标和当日任务完成情况，自动填写每日复盘的6个维度。

要求：
1. 基于OKR目标和任务完成数据，生成具体、真实的内容，不要泛泛而谈
2. 每个维度生成1-3条，每条用 "1. " "2. " 编号格式
3. 内容要具体到OKR中的实际目标和任务名称
4. 如果有任务完成，"今天完成了什么"要提到；如果遇到问题，"突发问题"要分析
5. "明日待办"要从OKR中未完成的任务里提炼
6. "今天发生了哪些美好或值得关注的事"可以从完成的进展、获得的新认知等方面写

6个维度的填写要求：
- 今天完成了什么：列出今日完成的任务和工作进展
- 今天发生了哪些美好或值得关注的事：记录值得留意的好事或新发现
- 今天遇到了哪些突发问题：记录遇到的困难、卡点或意外
- 今天心情如何：描述今天的整体情绪状态
- 今天有哪些感想或总结：提炼认知和经验
- 明日待办：从OKR中未完成的KR/任务中提炼下一步行动

禁止寒暄，禁止空泛鼓励，禁止鸡汤。只输出6个维度的内容，每个维度用【】标注标题。`;

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
