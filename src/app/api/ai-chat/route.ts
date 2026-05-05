import { NextRequest } from 'next/server';
import { createLLMStream } from '@/lib/llm';

export async function POST(request: NextRequest) {
  const { messages, selectedEvent } = await request.json();

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

  return createLLMStream(request, chatMessages, { temperature: 0.7 });
}
