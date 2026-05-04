import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  const { messages, selectedEvent } = await request.json();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const systemPrompt = `你是一个高效的日程分析助手。用户会给你一个日程或待办事项，你需要：
1. 分析这个日程的核心目标
2. 将其拆解为具体可执行的子任务（2-5个）
3. 给出每个子任务的预估时间
4. 如果有优化建议，简短给出

回答要简洁直接，用中文，格式清晰。不要废话。`;

  const userContent = selectedEvent
    ? `请分析以下日程：\n${selectedEvent}\n\n请帮我拆分任务，让我直接执行。`
    : messages[messages.length - 1]?.content || '你好';

  const chatMessages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userContent },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const llmStream = client.stream(chatMessages, {
          model: 'doubao-seed-2-0-mini-260215',
          temperature: 0.7,
        });

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
