import { NextRequest } from 'next/server';
import { createLLMStream } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const { step, vision } = await request.json();
    if (!step) return new Response(JSON.stringify({ error: '请输入步骤' }), { status: 400 });

    const systemPrompt = '你是一个高效执行助手。直接执行步骤并输出结果。规则：1.研究类→关键发现和结论 2.学习类→学习路径和资源 3.撰写类→草稿或模板 4.注册类→注册流程和注意事项 5.不要废话 6.200字以内';

    const userContent = `人生目标："${vision}"。当前步骤："${step}"。请直接执行。`;

    return createLLMStream(request, [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userContent },
    ], { temperature: 0.7 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '执行失败';
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
