import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser, parseJsonBody, apiError } from '@/lib/api-auth';
import { z } from 'zod';

const postBodySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200),
  month: z.coerce.number().int().min(1).max(12),
  day: z.coerce.number().int().min(1).max(31),
  events: z.array(z.object({
    title: z.string().min(1).max(500),
    startHour: z.number().int().min(0).max(23).optional(),
    startMin: z.number().int().min(0).max(59).optional(),
    endHour: z.number().int().min(0).max(23).optional(),
    endMin: z.number().int().min(0).max(59).optional(),
  }).passthrough()).optional(),
  todos: z.array(z.object({
    content: z.string().min(1).max(2000).optional(),
    text: z.string().min(1).max(2000).optional(),
    priority: z.string().max(20).optional(),
    done: z.boolean().optional(),
  }).passthrough().refine(
    (t) => !!(t.content || t.text),
    { message: '需要 content 或 text' },
  )).optional(),
}).passthrough();

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsedBody = await parseJsonBody(request, postBodySchema);
  if (parsedBody instanceof NextResponse) return parsedBody;
  const body = parsedBody as {
    year: number;
    month: number;
    day: number;
    events?: Array<Record<string, unknown>>;
    todos?: Array<Record<string, unknown>>;
  };

  const client = getSupabaseClient();
  try {
    // 先删除当天的 events 和 todos(整树替换)
    await Promise.all([
      client.from('day_events').delete().eq('user_id', userId).eq('year', body.year).eq('month', body.month).eq('day', body.day),
      client.from('day_todos').delete().eq('user_id', userId).eq('year', body.year).eq('month', body.month).eq('day', body.day),
    ]);

    let insertedEvents = 0;
    let insertedTodos = 0;

    if (body.events && body.events.length > 0) {
      const rows = body.events
        .filter(e => e && typeof e === 'object' && (e.title || '').toString().trim())
        .map(e => ({
          user_id: userId,
          year: body.year,
          month: body.month,
          day: body.day,
          title: String(e.title || '').slice(0, 500),
          start_hour: typeof e.startHour === 'number' ? e.startHour : null,
          start_min: typeof e.startMin === 'number' ? e.startMin : null,
          end_hour: typeof e.endHour === 'number' ? e.endHour : null,
          end_min: typeof e.endMin === 'number' ? e.endMin : null,
        }));
      if (rows.length > 0) {
        const { error } = await client.from('day_events').insert(rows);
        if (error) {
          console.error('[add-day-events] events insert error:', error);
          return apiError('保存失败', 500);
        }
        insertedEvents = rows.length;
      }
    }

    if (body.todos && body.todos.length > 0) {
      const rows = body.todos
        .filter(t => t && typeof t === 'object' && (t.content || t.text))
        .map(t => {
          const text = String(t.content || t.text || '').slice(0, 2000);
          return {
            user_id: userId,
            year: body.year,
            month: body.month,
            day: body.day,
            text,
            content: text,
            priority: typeof t.priority === 'string' ? t.priority : null,
            done: !!t.done,
          };
        });
      if (rows.length > 0) {
        const { error } = await client.from('day_todos').insert(rows);
        if (error) {
          console.error('[add-day-events] todos insert error:', error);
          return apiError('保存失败', 500);
        }
        insertedTodos = rows.length;
      }
    }

    return NextResponse.json({ success: true, insertedEvents, insertedTodos });
  } catch (e) {
    console.error('[add-day-events] POST exception:', e);
    return apiError('服务器内部错误', 500);
  }
}
