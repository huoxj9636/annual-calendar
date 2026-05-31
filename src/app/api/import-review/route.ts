import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface ParsedEntry {
  date: string; // YYYY-M-D format
  content: string;
}

interface ClassifiedEntry {
  date: string;
  year: number;
  month: number;
  day: number;
  completed: string;
  goodThings: string;
  problems: string;
  mood: string;
  reflections: string;
  tomorrowTodo: string;
}

/**
 * 从 HTML 中提取日期+内容条目
 * 支持常见笔记导出格式：
 * - <h1/h2/h3> 标题含日期
 * - <time datetime="..."> 标签
 * - 日期行（2024年1月1日 / 2024-01-01 / Jan 1, 2024 等）
 */
function parseHTMLEntries(html: string): ParsedEntry[] {
  // 移除 script/style
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);

  // 日期正则
  const datePatterns = [
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/,  // 2024年1月1日
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,           // 2024-01-01 / 2024/01/01 / 2024.01.01
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,               // 01/01/2024
  ];

  const entries: ParsedEntry[] = [];
  let currentDate: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    let matched: RegExpMatchArray | null = null;
    let y = '', m = '', d = '';

    for (const pat of datePatterns) {
      matched = line.match(pat);
      if (matched) {
        if (pat === datePatterns[2]) {
          // MM/DD/YYYY 格式
          d = matched[1]; m = matched[2]; y = matched[3];
        } else {
          y = matched[1]; m = matched[2]; d = matched[3];
        }
        break;
      }
    }

    if (matched && y && m && d) {
      // 遇到新日期，保存之前的条目
      if (currentDate && currentContent.length > 0) {
        entries.push({ date: currentDate, content: currentContent.join('\n').trim() });
      }
      currentDate = `${y}-${parseInt(m)}-${parseInt(d)}`;
      // 日期行本身可能后面还有内容
      const rest = line.replace(matched[0], '').trim();
      currentContent = rest ? [rest] : [];
    } else if (currentDate) {
      currentContent.push(line);
    }
  }

  // 最后一个条目
  if (currentDate && currentContent.length > 0) {
    entries.push({ date: currentDate, content: currentContent.join('\n').trim() });
  }

  return entries;
}

/**
 * 从纯文本中提取日期+内容条目
 * 支持格式同 HTML，但不去除标签
 */
function parseTextEntries(text: string): ParsedEntry[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const datePatterns = [
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/,
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
  ];

  const entries: ParsedEntry[] = [];
  let currentDate: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    let matched: RegExpMatchArray | null = null;
    let y = '', m = '', d = '';

    for (const pat of datePatterns) {
      matched = line.match(pat);
      if (matched) {
        if (pat === datePatterns[2]) {
          d = matched[1]; m = matched[2]; y = matched[3];
        } else {
          y = matched[1]; m = matched[2]; d = matched[3];
        }
        break;
      }
    }

    if (matched && y && m && d) {
      if (currentDate && currentContent.length > 0) {
        entries.push({ date: currentDate, content: currentContent.join('\n').trim() });
      }
      currentDate = `${y}-${parseInt(m)}-${parseInt(d)}`;
      const rest = line.replace(matched[0], '').trim();
      currentContent = rest ? [rest] : [];
    } else if (currentDate) {
      currentContent.push(line);
    }
  }

  if (currentDate && currentContent.length > 0) {
    entries.push({ date: currentDate, content: currentContent.join('\n').trim() });
  }

  return entries;
}

/**
 * 使用 LLM 将笔记内容分类到6个复盘维度
 */
async function classifyWithAI(entries: ParsedEntry[], request: NextRequest): Promise<ClassifiedEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LLMClient, Config, HeaderUtils } = require('coze-coding-dev-sdk');

  const isLocalMode = !!process.env.LLM_API_KEY;
  let aiResult: string;

  const prompt = `你是一个每日复盘助手。用户从笔记应用导入了以下日记条目，请将每一条内容智能分类到6个复盘维度中。

6个维度（严格使用这些 key）：
- completed: 今天完成了什么
- goodThings: 今天发生了哪些美好或值得关注的事
- problems: 今天遇到了哪些突发问题
- mood: 今天心情如何
- reflections: 今天有哪些感想或总结
- tomorrowTodo: 明日待办

分类规则：
1. 仔细阅读每条内容，判断它属于哪个维度
2. 同一维度的多条内容用编号列表，换行分隔
3. 如果某维度没有对应内容，填空字符串 ""
4. 不要遗漏任何内容，每句话都必须归入某个维度
5. 情绪描述归入 mood，反思感悟归入 reflections
6. 已完成的事项归入 completed，计划中的事项归入 tomorrowTodo
7. 积极的见闻归入 goodThings，困难和问题归入 problems

输入数据：
${entries.map((e, i) => `[${i}] 日期:${e.date}\n${e.content}`).join('\n\n')}

请严格按以下 JSON 格式输出，不要输出任何其他文字：
[
  {"date":"YYYY-M-D","completed":"...","goodThings":"...","problems":"...","mood":"...","reflections":"...","tomorrowTodo":"..."},
  ...
]`;

  if (isLocalMode) {
    const apiKey = process.env.LLM_API_KEY!;
    const baseUrl = process.env.LLM_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
    const model = process.env.LLM_MODEL || 'doubao-seed-2-0-mini-260215';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是每日复盘助手，严格按JSON格式输出分类结果。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        stream: false,
      }),
    });

    const data = await response.json();
    aiResult = data.choices?.[0]?.message?.content || '';
  } else {
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const chunks: string[] = [];
    const stream = client.stream([
      { role: 'system', content: '你是每日复盘助手，严格按JSON格式输出分类结果。' },
      { role: 'user', content: prompt },
    ], {
      model: process.env.LLM_MODEL || 'doubao-seed-2-0-mini-260215',
      temperature: 0.3,
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        chunks.push(chunk.content.toString());
      }
    }
    aiResult = chunks.join('');
  }

  // 解析 AI 返回的 JSON
  const jsonMatch = aiResult.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('AI 返回格式错误，无法解析');
  }

  const classified: ClassifiedEntry[] = JSON.parse(jsonMatch[0]).map((item: Record<string, string>) => {
    const parts = item.date.split('-').map(Number);
    return {
      date: item.date,
      year: parts[0],
      month: parts[1],
      day: parts[2],
      completed: item.completed || '',
      goodThings: item.goodThings || '',
      problems: item.problems || '',
      mood: item.mood || '',
      reflections: item.reflections || '',
      tomorrowTodo: item.tomorrowTodo || '',
    };
  });

  return classified;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { html, text, year: reqYear, month: reqMonth, day: reqDay } = body as {
      html?: string; text?: string; year?: number; month?: number; day?: number;
    };

    const isTextMode = !!text;
    const input = isTextMode ? text : html;

    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: '缺少 text 或 html 参数' }, { status: 400 });
    }

    let entries: ParsedEntry[];

    if (isTextMode) {
      // 文本模式：不需要日期，整段文本直接归类到当前复盘日期
      const now = new Date();
      const fallbackDate = `${reqYear || now.getFullYear()}-${reqMonth || (now.getMonth() + 1)}-${reqDay || now.getDate()}`;
      entries = [{ date: fallbackDate, content: text.trim() }];
    } else {
      // HTML 模式：从HTML中解析多个日期条目
      entries = parseHTMLEntries(html!);
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: '未能从 HTML 中解析出任何日期条目。请确保内容中包含日期（如 2024年1月1日 或 2024-01-01）。' }, { status: 400 });
    }

    // Step 2: AI 分类
    const classified = await classifyWithAI(entries, request);

    // Step 3: 保存到数据库（追加模式）
    const supabase = getSupabaseClient();

    const savedCount: number[] = [];

    for (const entry of classified) {
      // 读取已有数据
      const { data: existing } = await supabase
        .from('daily_reviews')
        .select('*')
        .eq('year', entry.year)
        .eq('month', entry.month)
        .eq('day', entry.day)
        .maybeSingle();

      const fields = ['completed', 'goodThings', 'problems', 'mood', 'reflections', 'tomorrowTodo'] as const;

      if (existing) {
        // 追加模式：在已有内容后添加新内容
        const updated: Record<string, string | number> = {};
        for (const f of fields) {
          const oldVal = (existing as Record<string, string | number | null>)[f] as string || '';
          const newVal = entry[f];
          updated[f] = newVal ? (oldVal ? oldVal + '\n' + newVal : newVal) : oldVal;
        }
        updated.moodScore = existing.mood_score ?? 3;
        updated.energy = existing.energy ?? 3;

        const { error } = await supabase
          .from('daily_reviews')
          .update({
            completed: updated.completed,
            good_things: updated.goodThings,
            problems: updated.problems,
            mood: updated.mood,
            reflections: updated.reflections,
            tomorrow_todo: updated.tomorrowTodo,
          })
          .eq('year', entry.year)
          .eq('month', entry.month)
          .eq('day', entry.day);

        if (!error) savedCount.push(entry.day);
      } else {
        const { error } = await supabase
          .from('daily_reviews')
          .upsert({
            year: entry.year,
            month: entry.month,
            day: entry.day,
            completed: entry.completed,
            good_things: entry.goodThings,
            problems: entry.problems,
            mood: entry.mood,
            reflections: entry.reflections,
            tomorrow_todo: entry.tomorrowTodo,
            mood_score: 3,
            energy: 3,
          }, { onConflict: 'year,month,day' });

        if (!error) savedCount.push(entry.day);
      }
    }

    return NextResponse.json({
      success: true,
      total: entries.length,
      saved: savedCount.length,
      entries: classified.map(e => ({
        date: e.date,
        completed: e.completed,
        goodThings: e.goodThings,
        problems: e.problems,
        mood: e.mood,
        reflections: e.reflections,
        tomorrowTodo: e.tomorrowTodo,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Import Review Error]', msg);
    return NextResponse.json({ error: `导入失败: ${msg}` }, { status: 500 });
  }
}
