import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  let text = "";
  let context = "";
  try {
    const body = (await request.json()) as { text: string; context?: string };
    text = body.text || "";
    context = body.context || "";
    if (!text.trim()) {
      return NextResponse.json({ result: text });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const systemPrompt = `你是一个目标文字润色助手。用户通过语音输入说出了自己的目标或计划，语音识别可能产生啰嗦、口语化、重复的表达。请将其润色为简洁、精准、书面化的目标描述。

规则：
1. 保持原意不变，不添加用户没说的内容
2. 去除口语化表达（"就是"、"那个"、"然后"等）
3. 去除重复内容
4. 目标描述用动宾结构，如"完成XX"、"建立XX"、"提升XX"
5. 输出只保留润色后的文字，不要解释、不要引号、不要前缀`;

    const userContent = context
      ? `上下文：这是目标"${context}"下的子目标\n\n语音识别原文：${text}`
      : `语音识别原文：${text}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userContent },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-2-0-lite-260215",
      temperature: 0.3,
    });

    return NextResponse.json({ result: response.content.trim() });
  } catch (error) {
    // If polish fails, return original text
    console.error("Polish text error:", error);
    return NextResponse.json({ result: text || "语音识别结果" });
  }
}
