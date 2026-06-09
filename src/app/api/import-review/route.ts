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
 * 浮木笔记结构化解析
 * 格式: <div class="time">2026-06-09 19:30:11</div><div class="content"><p>...</p></div>
 */
function parseFumuHTML(html: string, reqYear?: number): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  // 匹配 <div class="time">...</div> 后面紧跟 <div class="content">...</div>
  const pattern = /<div[^>]*class=["'][^"']*time[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const timeStr = match[1].trim();
    const contentHtml = match[2].trim();

    // 从时间字符串提取日期
    const dateMatch = timeStr.match(/(\d{4})[\/\-\.]\s*(\d{1,2})[\/\-\.]\s*(\d{1,2})/);
    if (!dateMatch) continue;

    const y = parseInt(dateMatch[1]);
    const m = parseInt(dateMatch[2]);
    const d = parseInt(dateMatch[3]);

    // 从 content HTML 中提取纯文本
    const contentText = contentHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (contentText) {
      entries.push({ date: `${y}-${m}-${d}`, content: contentText });
    }
  }

  // 如果没有匹配到结构化格式，返回空数组（让通用解析接管）
  return entries;
}

/**
 * 从 HTML 中提取日期+内容条目
 * 优先支持浮木笔记格式: <div class="time">YYYY-MM-DD HH:mm:ss</div><div class="content">...</div>
 * 通用回退：常见笔记导出格式
 */
function parseHTMLEntries(html: string, reqYear?: number): ParsedEntry[] {
  // === 第一优先：浮木笔记结构化解析 ===
  const fumuEntries = parseFumuHTML(html, reqYear);
  if (fumuEntries.length > 0) return fumuEntries;

  // === 回退：通用解析 ===
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

  // 日期正则（更宽松的匹配）
  const datePatterns = [
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/,  // 2024年1月1日 / 1月1号
    /(\d{4})[\/\-\.]\s*(\d{1,2})[\/\-\.]\s*(\d{1,2})/,       // 2024-01-01 / 2024/01/01 / 2024.01.01
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,                 // 01/01/2024
    /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/,                    // 6月9日 / 6月9号（无年份）
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
        } else if (pat === datePatterns[3]) {
          // 无年份格式: M月D日 → 用请求年份
          y = String(reqYear || new Date().getFullYear()); m = matched[1]; d = matched[2];
        } else {
          y = matched[1]; m = matched[2]; d = matched[3];
        }
        break;
      }
    }

    if (matched && m && d) {
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
function parseTextEntries(text: string, reqYear?: number): ParsedEntry[] {
  const currentYear = reqYear || new Date().getFullYear();
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

    if (matched && m && d) {
      if (!y) y = String(currentYear);
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
 * 修复JSON字符串中字符串值内的裸换行符
 * 逐字符扫描，仅在字符串值内部将 \n 替换为 \\n
 */
function fixJsonNewlines(json: string): string {
  let result = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escape) {
      result += ch;
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      result += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (ch === '\n' && inString) {
      result += '\\n';
      continue;
    }
    if (ch === '\r' && inString) {
      result += '\\r';
      continue;
    }
    if (ch === '\t' && inString) {
      result += '\\t';
      continue;
    }
    result += ch;
  }
  return result;
}

/**
 * 使用 LLM 将笔记内容分类到6个复盘维度
 */
async function classifyWithAI(entries: ParsedEntry[], request: NextRequest, fallbackDate?: { year?: number; month?: number; day?: number }): Promise<ClassifiedEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LLMClient, Config, HeaderUtils } = require('coze-coding-dev-sdk');

  const isLocalMode = !!process.env.LLM_API_KEY;
  let aiResult: string;

  const prompt = `你是一个每日复盘助手。用户从笔记应用导入了以下日记条目，请将每一条内容智能分类到6个复盘维度中。

⚠️ 严格分类规则（极其重要，违反将导致严重错误）：
1. 你必须将内容归入6个维度，缺一不可
2. 每句话都必须准确归类，不能遗漏或错归
3. 特别注意区分以下容易混淆的维度：
   - goodThings（美好/值得关注的事）= 好事、开心的事、新发现、值得留意的事
   - problems（突发问题）= 坏事、困难、卡点、意外、突发状况、不顺的事
   - 这两个必须分开！好事归goodThings，坏事归problems
   - reflections（感想/总结）= 思考、感悟、经验教训、内心感受
   - tomorrowTodo（明日待办）= 明天要做的事、明天的计划安排
   - 感想和待办必须分开！感想是回顾，待办是计划
4. 已完成的事项归入 completed，计划中的事项归入 tomorrowTodo
5. 情绪描述归入 mood，反思感悟归入 reflections

6个维度（严格使用这些 key）：
- completed: 今天完成了什么
- goodThings: 今天发生了哪些美好或值得关注的事
- problems: 今天遇到了哪些突发问题
- mood: 今天心情如何
- reflections: 今天有哪些感想或总结
- tomorrowTodo: 明日待办

分类规则：
1. 仔细阅读每条内容，判断它属于哪个维度
2. 同一维度的多条内容用分号（；）分隔，不要换行
3. 如果某维度没有对应内容，填空字符串 ""
4. 不要遗漏任何内容，每句话都必须归入某个维度
5. 字符串值中不要包含换行符（用分号代替）

输入数据：
${entries.map((e, i) => `[${i}] 日期:${e.date}\n${e.content}`).join('\n\n')}

请严格按以下 JSON 格式输出，不要输出任何其他文字，字符串值中不要有换行符：
[
  {"date":"YYYY-M-D","completed":"...","goodThings":"...","problems":"...","mood":"...","reflections":"...","tomorrowTodo":"..."}
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
  // 尝试多种提取方式，兼容 markdown 代码块、非标准格式等
  let jsonStr: string | null = null;

  // 方式1: 提取 markdown 代码块中的 JSON
  const codeBlockMatch = aiResult.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // 方式2: 直接匹配 JSON 数组
  if (!jsonStr) {
    const arrayMatch = aiResult.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }
  }

  // 方式3: 匹配 JSON 对象（单条记录）
  if (!jsonStr) {
    const objMatch = aiResult.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = `[${objMatch[0]}]`;
    }
  }

  if (!jsonStr) {
    console.error('[Import Review] AI raw response (first 500):', aiResult.substring(0, 500));
    throw new Error('AI 返回格式错误，无法解析。请检查导入内容是否有效。');
  }

  // 清理可能的尾随逗号等常见JSON问题
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

  let parsed: unknown[];
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e1) {
    // 修复策略：暴力重建JSON，确保字符串值中的换行符被正确转义
    console.log('[Import Review] First parse failed, attempting robust fix...');
    try {
      // 将整个JSON字符串中的真实换行替换（仅在字符串值内部）
      // 策略：逐字符扫描，跟踪是否在字符串内部，仅转义字符串内的裸换行
      const fixed = fixJsonNewlines(jsonStr);
      parsed = JSON.parse(fixed);
    } catch (e2) {
      // 最后尝试：提取所有 {...} 对象
      console.log('[Import Review] Second parse failed, extracting individual objects...');
      try {
        const objects: unknown[] = [];
        let depth = 0;
        let start = -1;
        for (let i = 0; i < jsonStr.length; i++) {
          if (jsonStr[i] === '{' && depth === 0) start = i;
          if (jsonStr[i] === '{') depth++;
          if (jsonStr[i] === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
              const objStr = fixJsonNewlines(jsonStr.substring(start, i + 1));
              try {
                objects.push(JSON.parse(objStr));
              } catch { /* skip malformed objects */ }
              start = -1;
            }
          }
        }
        if (objects.length > 0) {
          parsed = objects;
        } else {
          console.error('[Import Review] All parse attempts failed. Raw (first 2000):', jsonStr.substring(0, 2000));
          console.error('[Import Review] Original error:', e1);
          console.error('[Import Review] Fix error:', e2);
          throw new Error('AI 返回的JSON解析失败，请重试。');
        }
      } catch (e3) {
        if (e3 instanceof Error && e3.message.includes('AI 返回的JSON')) throw e3;
        console.error('[Import Review] Final parse failed. Raw (first 2000):', jsonStr.substring(0, 2000));
        throw new Error('AI 返回的JSON解析失败，请重试。');
      }
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('AI 返回的数据为空，请重试。');
  }

  const classified: ClassifiedEntry[] = (parsed as Record<string, string>[]).map((item) => {
    const parts = (item.date || '').split('-').map(Number);
    if (parts.length < 3 || parts.some(isNaN)) {
      // 如果日期解析失败，使用回退日期
      const now = new Date();
      parts[0] = fallbackDate?.year || now.getFullYear();
      parts[1] = fallbackDate?.month || (now.getMonth() + 1);
      parts[2] = fallbackDate?.day || now.getDate();
    }
    return {
      date: `${parts[0]}-${parts[1]}-${parts[2]}`,
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
      entries = parseHTMLEntries(html!, reqYear);
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: '未能从 HTML 中解析出任何日期条目。请确保内容中包含日期（如 2024年1月1日 或 2024-01-01）。' }, { status: 400 });
    }

    // Step 2: AI 分类
    const classified = await classifyWithAI(entries, request, { year: reqYear, month: reqMonth, day: reqDay });

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
