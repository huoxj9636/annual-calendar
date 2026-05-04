import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  const { date, plannedVsActual, satisfaction } = await request.json();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const systemPrompt = `你是一个时间轨迹对照分析助手。用户会给你一天的计划与实际时间对照数据，你需要：

1. **时间偏差分析**：分析每个任务的延迟/提前情况，找出最大的时间偏差
2. **执行力评估**：基于计划与实际的吻合度，评估执行纪律性（1-10分）
3. **拖延模式识别**：识别哪些类型的任务容易拖延，什么时间段执行力最差
4. **时间黑洞发现**：指出时间浪费最严重的环节
5. **对照建议**：给出具体的改善建议，帮助用户缩小计划与实际的差距

注意：这是"计划 vs 实际"的对照分析，核心是找出偏差并给出改善建议。回答要犀利中肯，不要说废话。用中文回答，格式清晰。`;

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
