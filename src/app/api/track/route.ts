import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  const { date, plannedVsActual, satisfaction } = await request.json();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const systemPrompt = `你是时间轨迹对照分析助手。分析计划vs实际的偏差。

回复格式（金字塔结构，先结论后展开）：
1. **核心结论**（1-2句话）
2. **偏差概览**（每条任务1句话：延迟/提前多少）
3. **模式发现**（2-3条，什么类型任务/什么时段容易偏）
4. **行动建议**（2-3条可操作建议）

要求：
- 精简！每条不超过2行
- 不啰嗦，不铺垫，不寒暄
- 直击重点，用数据和事实说话
- 中文，markdown格式`;

  const userContent = `请分析我 ${date} 的计划与实际时间对照：

${plannedVsActual}

${satisfaction ? `背景信息：${satisfaction}` : ''}

请进行轨迹对照分析。`;

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
