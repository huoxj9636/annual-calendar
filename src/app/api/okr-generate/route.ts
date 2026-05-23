import { NextRequest } from 'next/server';
import { createLLMStream } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const { objective } = await request.json();
    if (!objective) return new Response(JSON.stringify({ error: '请输入目标' }), { status: 400 });

    const systemPrompt = `你是一个OKR专家。请根据用户的目标(Objective)，生成3-5个可量化的关键结果(Key Results)。
规则：
1. 每个KR必须是具体可量化的，包含明确的数值指标
2. KR格式：描述 | 当前值 | 目标值（如：发布技术文章 | 0 | 12）
3. KR之间要有互补性，覆盖目标的不同维度
4. 目标值要具有挑战性但可实现（70%完成率即算成功）
5. 不要废话，每条KR一行
6. 格式严格为：KR描述 | 当前值 | 目标值`;

    const userContent = `我的目标："${objective}"。请生成3-5个Key Results。`;

    return createLLMStream(request, [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userContent },
    ], { temperature: 0.7 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '生成失败';
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
