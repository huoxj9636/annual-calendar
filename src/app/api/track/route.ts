import { NextRequest } from 'next/server';
import { createLLMStream } from '@/lib/llm';

export async function POST(request: NextRequest) {
  const { date, plannedVsActual, satisfaction } = await request.json();

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

  return createLLMStream(request, [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userContent },
  ], { temperature: 0.7 });
}
