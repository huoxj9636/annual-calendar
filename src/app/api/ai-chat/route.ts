import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  const { messages, selectedEvent } = await request.json();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const systemPrompt = `你是日程拆解助手。

回复格式（金字塔结构）：
1. **核心目标**（1句话）
2. **执行步骤**（2-5条，每条1行：步骤+预估时间）
3. **关键提醒**（1-2条，最需要注意的）

要求：
- 极度精简，每条不超过1行
- 不铺垫，不寒暄，直击重点
- 中文，markdown格式`;

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
