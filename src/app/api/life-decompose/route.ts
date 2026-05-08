import { NextRequest } from 'next/server';
import { createLLMStream } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const { vision, targetYear } = await request.json();
    if (!vision) return new Response(JSON.stringify({ error: '请输入目标愿景' }), { status: 400 });

    const systemPrompt = '你是一个高效规划师。请将用户的目标拆解为可执行步骤。规则：1.每个步骤必须具体可执行 2.标注性质：[线上]或[线下]或[协作] 3.按时间先后排列 4.不要废话 5.每步不超过20字 6.步骤数量根据周期调整：1周3-5步，1个月5-8步，3个月8-10步，1年10-15步，3年以上15-20步';

    const userContent = `我的目标："${vision}"，计划周期：${targetYear}。请拆解为步骤，格式：序号. 步骤描述 [线上/线下/协作]`;

    return createLLMStream(request, [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userContent },
    ], { temperature: 0.7 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '拆解失败';
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
