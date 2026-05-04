import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  const { startDate, endDate, summary } = await request.json();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const systemPrompt = `你是一个人生轨迹分析助手。用户会给你一段时间内的活动记录，你需要：

1. **轨迹回顾**：梳理这段时间用户主要在做什么，有什么规律
2. **方向判断**：判断用户当前的方向是否与长期目标一致
3. **盲点发现**：指出用户可能忽视的方面或机会
4. **方向建议**：给出未来1-3个月的方向性建议，帮助用户聚焦最有价值的事

回答要有洞察力，不要泛泛而谈，要给出具体可执行的方向建议。用中文回答，格式清晰。`;

  const userContent = `请分析我 ${startDate} 到 ${endDate} 这段时间的轨迹：

${summary}

请分析我的方向，并给出建议。`;

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
