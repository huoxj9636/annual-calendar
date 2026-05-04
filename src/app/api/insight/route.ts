import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  const { year, month, day, events, todos, overrides, focus, goalName } = await request.json();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  // Build context from user's data
  const completedItems: string[] = [];
  const incompleteItems: string[] = [];

  if (todos && Array.isArray(todos)) {
    todos.forEach((t: { text: string; done?: boolean }) => {
      if (t.done) completedItems.push(t.text);
      else incompleteItems.push(t.text);
    });
  }
  if (events && Array.isArray(events)) {
    events.forEach((e: { title?: string; text?: string; startTime?: string; endTime?: string }) => {
      const label = e.title || e.text || '未命名日程';
      const time = e.startTime ? `(${e.startTime}${e.endTime ? '-' + e.endTime : ''})` : '';
      completedItems.push(`${label}${time}`);
    });
  }

  const satisfactionInfo = overrides
    ? `当日满意度状态：${overrides === 'checked' ? '✓ 满意' : overrides === 'crossed' ? '✗ 不满意' : '未标记'}`
    : '';

  const systemPrompt = `你是一个犀利的时间管理洞察助手。基于数据直击要害。

当前维度：${goalName || '综合分析'}

分析要求：
${focus || '1. **时间分析**：评估时间利用效率，找出时间黑洞\n2. **拖延诊断**：识别拖延模式和根因\n3. **执行力评分**：1-10分，一句话说明\n4. **行动建议**：2-3条具体可执行的建议'}

回复格式（金字塔结构，先结论后展开）：
1. **核心结论**（1-2句话，放在最前面）
2. **关键发现**（3-5条，每条1句话）
3. **具体建议**（2-3条，可操作）

要求：
- 精简！每条不超过2行
- 不啰嗦，不重复
- 直击重点，不要铺垫和寒暄
- 用中文，markdown格式`;

  const userContent = `请从「${goalName || '综合'}」维度分析 ${year}年${month}月${day}日 的时间使用情况：

${satisfactionInfo}

已完成的事项：
${completedItems.length > 0 ? completedItems.map((item, i) => `${i + 1}. ${item}`).join('\n') : '（无记录）'}

未完成的待办：
${incompleteItems.length > 0 ? incompleteItems.map((item, i) => `${i + 1}. ${item}`).join('\n') : '（全部完成或无待办）'}

请给出深度洞察。`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const llmStream = client.stream(
          [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: userContent },
          ],
          {
            model: 'doubao-seed-2-0-mini-260215',
            temperature: 0.7,
          }
        );

        for await (const chunk of llmStream) {
          if (chunk.content) {
            const text = chunk.content.toString();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
