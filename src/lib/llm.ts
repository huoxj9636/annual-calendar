/**
 * LLM Client - 支持两种运行模式：
 * 
 * 1. 平台模式（默认）：使用 coze-coding-dev-sdk，自动从请求头提取鉴权信息
 * 2. 本地模式：使用 OpenAI 兼容 API，需配置 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
 */

import { NextRequest } from 'next/server';

// 检测是否为本地模式
const isLocalMode = !!process.env.LLM_API_KEY;

// 获取模型名称
const getModel = () => process.env.LLM_MODEL || 'doubao-seed-2-0-mini-260215';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 创建 LLM 流式响应
 */
export async function createLLMStream(
  request: NextRequest,
  messages: ChatMessage[],
  options?: { temperature?: number }
) {
  const temperature = options?.temperature ?? 0.7;

  if (isLocalMode) {
    return createLocalStream(messages, temperature);
  } else {
    return createPlatformStream(request, messages, temperature);
  }
}

/** 平台模式：使用 coze-coding-dev-sdk */
async function createPlatformStream(
  request: NextRequest,
  messages: ChatMessage[],
  temperature: number
) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LLMClient, Config, HeaderUtils } = require('coze-coding-dev-sdk');
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const llmStream = client.stream(messages, {
          model: getModel(),
          temperature,
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

/** 本地模式：使用 OpenAI 兼容 API */
async function createLocalStream(
  messages: ChatMessage[],
  temperature: number
) {
  const apiKey = process.env.LLM_API_KEY!;
  const baseUrl = process.env.LLM_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
  const model = getModel();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(
      JSON.stringify({ error: `LLM API error: ${response.status} - ${errorText}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'No response body' })}\n\n`));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch {
              // skip malformed JSON
            }
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

/**
 * Fetch URL 内容 - 支持平台模式和本地模式
 */
export async function fetchUrlContent(
  request: NextRequest,
  url: string
): Promise<{ title: string; url: string; content: string } | { error: string }> {
  if (isLocalMode) {
    return fetchUrlLocal(url);
  } else {
    return fetchUrlPlatform(request, url);
  }
}

async function fetchUrlPlatform(
  request: NextRequest,
  url: string
) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FetchClient, Config, HeaderUtils } = require('coze-coding-dev-sdk');
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  const client = new FetchClient(config, customHeaders);

  const response = await client.fetch(url);
  if (response.status_code !== 0) {
    return { error: response.status_message || 'Fetch failed' };
  }
  return {
    title: response.title,
    url: response.url,
    content: response.content,
  };
}

async function fetchUrlLocal(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnnualCalendar/1.0)',
      },
    });
    const html = await response.text();

    // 简单提取 title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // 简单提取正文（移除标签）
    const content = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);

    return { title, url, content };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Fetch failed' };
  }
}
