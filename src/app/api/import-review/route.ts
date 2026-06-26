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

// ==================== 后台任务追踪 ====================

type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ImportTask {
  id: string;
  status: TaskStatus;
  total: number;
  processed: number;
  saved: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

// 内存中的任务追踪（单服务实例足够）
const tasks = new Map<string, ImportTask>();

function createTask(total: number): ImportTask {
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const task: ImportTask = { id, status: 'pending', total, processed: 0, saved: 0, createdAt: now, updatedAt: now };
  tasks.set(id, task);
  return task;
}

function updateTask(id: string, updates: Partial<ImportTask>): ImportTask | undefined {
  const task = tasks.get(id);
  if (!task) return undefined;
  Object.assign(task, updates, { updatedAt: Date.now() });
  return task;
}

// 清理超过1小时的已完成/失败任务
function cleanupOldTasks(): void {
  const now = Date.now();
  for (const [id, task] of tasks) {
    if ((task.status === 'completed' || task.status === 'failed') && now - task.updatedAt > 3600000) {
      tasks.delete(id);
    }
  }
}

// ==================== 解析函数 ====================

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

// ==================== AI 分类 ====================

/**
 * 使用 LLM 将笔记内容分类到6个复盘维度
 */
async function classifyWithAI(entries: ParsedEntry[], requestHeaders: Headers, fallbackDate?: { year?: number; month?: number; day?: number }): Promise<ClassifiedEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LLMClient, Config, HeaderUtils } = require('coze-coding-dev-sdk');

  const isLocalMode = !!process.env.LLM_API_KEY;
  let aiResult: string;

  const prompt = `你是一个每日复盘助手。用户从笔记应用导入了以下日记条目，请将每一条内容智能分类到6个复盘维度中。

⚠️ 核心原则：只分类，不润色！
- 原样保留用户原文，不要修改、精简、润色或改写任何内容
- 不要添加任何原文中没有的内容
- 只做归类，将原文放入合适的维度即可

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
6. 原文原样保留，不做任何改写

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
    const customHeaders = HeaderUtils.extractForwardHeaders(requestHeaders);
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
    console.log('[Import Review] First parse failed, attempting robust fix...');
    try {
      const fixed = fixJsonNewlines(jsonStr);
      parsed = JSON.parse(fixed);
    } catch (e2) {
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

// ==================== 后台处理核心 ====================

async function processImportTask(
  taskId: string,
  entries: ParsedEntry[],
  requestHeaders: Headers,
  fallbackDate: { year?: number; month?: number; day?: number }
): Promise<void> {
  try {
    updateTask(taskId, { status: 'processing' });

    const batchSize = 20;
    const allClassified: ClassifiedEntry[] = [];
    const totalBatches = Math.ceil(entries.length / batchSize);

    for (let i = 0; i < entries.length; i += batchSize) {
      const batchIdx = Math.floor(i / batchSize);
      const batch = entries.slice(i, i + batchSize);

      try {
        const batchResult = await classifyWithAI(batch, requestHeaders, fallbackDate);
        allClassified.push(...batchResult);
      } catch (err) {
        // 单批失败不影响其他批次，记录错误继续
        console.error(`[Import Task ${taskId}] Batch ${batchIdx + 1}/${totalBatches} failed:`, err instanceof Error ? err.message : err);
      }

      // 更新进度
      updateTask(taskId, { processed: Math.min(i + batchSize, entries.length) });
    }

    if (allClassified.length === 0) {
      updateTask(taskId, { status: 'failed', error: '所有批次AI分类均失败，请重试' });
      return;
    }

    // 保存到数据库
    const supabase = getSupabaseClient();
    let savedCount = 0;

    for (const entry of allClassified) {
      const { data: existing } = await supabase
        .from('daily_reviews')
        .select('*')
        .eq('user_id', 'legacy')
        .eq('year', entry.year)
        .eq('month', entry.month)
        .eq('day', entry.day)
        .maybeSingle();

      const fields = ['completed', 'goodThings', 'problems', 'mood', 'reflections', 'tomorrowTodo'] as const;

      if (existing) {
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
          .eq('user_id', 'legacy')
          .eq('year', entry.year)
          .eq('month', entry.month)
          .eq('day', entry.day);

        if (!error) savedCount++;
      } else {
        const { error } = await supabase
          .from('daily_reviews')
          .upsert({
            user_id: 'legacy',
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
          }, { onConflict: 'user_id,year,month,day' });

        if (!error) savedCount++;
      }
    }

    updateTask(taskId, { status: 'completed', saved: savedCount, processed: allClassified.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Import Task ${taskId}] Error:`, msg);
    updateTask(taskId, { status: 'failed', error: msg });
  }
}

// ==================== API 路由 ====================

// GET: 查询任务状态
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'tasks') {
    // 返回所有任务列表
    cleanupOldTasks();
    const taskList = Array.from(tasks.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(t => ({
        id: t.id,
        status: t.status,
        total: t.total,
        processed: t.processed,
        saved: t.saved,
        progress: t.total > 0 ? Math.round((t.processed / t.total) * 100) : 0,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        error: t.error,
      }));
    return NextResponse.json({ tasks: taskList });
  }

  if (action === 'status') {
    const taskId = searchParams.get('taskId');
    if (!taskId) {
      return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });
    }
    const task = tasks.get(taskId);
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    return NextResponse.json({
      id: task.id,
      status: task.status,
      total: task.total,
      processed: task.processed,
      saved: task.saved,
      progress: task.total > 0 ? Math.round((task.processed / task.total) * 100) : 0,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      error: task.error,
    });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

// POST: 创建导入任务（异步后台执行）
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
      const now = new Date();
      const fallbackDate = `${reqYear || now.getFullYear()}-${reqMonth || (now.getMonth() + 1)}-${reqDay || now.getDate()}`;
      entries = [{ date: fallbackDate, content: text.trim() }];
    } else {
      entries = parseHTMLEntries(html!, reqYear);
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: '未能从 HTML 中解析出任何日期条目。请确保内容中包含日期（如 2024年1月1日 或 2024-01-01）。' }, { status: 400 });
    }

    // 创建后台任务
    const task = createTask(entries.length);

    // 克隆 headers 以便在后台使用（原 request 可能被消费后关闭）
    const headerPairs: [string, string][] = [];
    request.headers.forEach((v, k) => headerPairs.push([k, v]));
    const clonedHeaders = new Headers(headerPairs);

    // 后台异步执行（不 await，立即返回 taskId）
    processImportTask(task.id, entries, clonedHeaders, { year: reqYear, month: reqMonth, day: reqDay })
      .catch(err => {
        console.error(`[Import Task ${task.id}] Unhandled error:`, err);
        updateTask(task.id, { status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' });
      });

    return NextResponse.json({
      taskId: task.id,
      total: entries.length,
      message: `已创建导入任务，共${entries.length}条记录正在后台处理`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Import Review Error]', msg);
    return NextResponse.json({ error: `导入失败: ${msg}` }, { status: 500 });
  }
}
