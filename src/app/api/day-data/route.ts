import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser, parseJsonBody, apiError } from '@/lib/api-auth';
import { z } from 'zod';

const dayDataQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200),
  month: z.coerce.number().int().min(1).max(12),
  day: z.coerce.number().int().min(1).max(31),
});

const dayDataPostSchema = z.object({
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
  note: z.string().max(5000).optional(),
  // mode 字段: events / todos / all
  mode: z.string().optional(),
}).passthrough();

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const { searchParams } = new URL(request.url);
  const parsedQuery = dayDataQuerySchema.safeParse({
    year: searchParams.get('year') ?? 0,
    month: searchParams.get('month') ?? 0,
    day: searchParams.get('day') ?? 0,
  });
  if (!parsedQuery.success) {
    return apiError('日期参数无效', 400);
  }
  const { year, month, day } = parsedQuery.data;

  const client = getSupabaseClient();
  try {
    const [{ data: events, error: evErr }, { data: todos, error: tErr }, { data: noteRow, error: nErr }] = await Promise.all([
      client.from('day_events').select('*').eq('user_id', userId).eq('year', year).eq('month', month).eq('day', day).order('start_hour', { ascending: true }),
      client.from('day_todos').select('*').eq('user_id', userId).eq('year', year).eq('month', month).eq('day', day).order('created_at', { ascending: true }),
      client.from('calendar_notes').select('*').eq('user_id', userId).eq('year', year).eq('date_key', `${month}-${day}`).maybeSingle(),
    ]);
    if (evErr) {
      console.error('[day-data] events select error:', evErr);
      return apiError('查询失败', 500);
    }
    if (tErr) {
      console.error('[day-data] todos select error:', tErr);
      return apiError('查询失败', 500);
    }
    if (nErr) {
      console.error('[day-data] note select error:', nErr);
      return apiError('查询失败', 500);
    }
    return NextResponse.json({
      events: (events || []).map(e => ({
        id: e.id,
        title: e.title,
        startHour: e.start_hour,
        startMin: e.start_min,
        endHour: e.end_hour,
        endMin: e.end_min,
      })),
      todos: (todos || []).map(t => ({
        id: t.id,
        content: t.content || t.text,
        text: t.text || t.content,
        priority: t.priority,
        done: t.done,
      })),
      note: noteRow?.content || '',
    });
  } catch (e) {
    console.error('[day-data] GET exception:', e);
    return apiError('服务器内部错误', 500);
  }
}

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsedBody = await parseJsonBody(request, dayDataPostSchema);
  if (parsedBody instanceof NextResponse) return parsedBody;
  const body = parsedBody as z.infer<typeof dayDataPostSchema>;
  const mode = body.mode || 'all';

  const client = getSupabaseClient();
  try {
    if (mode === 'events' || mode === 'all') {
      await client.from('day_events').delete().eq('user_id', userId).eq('year', body.year).eq('month', body.month).eq('day', body.day);
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
            console.error('[day-data] events insert error:', error);
            return apiError('保存失败', 500);
          }
        }
      }
    }
    if (mode === 'todos' || mode === 'all') {
      await client.from('day_todos').delete().eq('user_id', userId).eq('year', body.year).eq('month', body.month).eq('day', body.day);
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
            console.error('[day-data] todos insert error:', error);
            return apiError('保存失败', 500);
          }
        }
      }
    }
    if (mode === 'note' || (mode === 'all' && body.note !== undefined)) {
      const dateKey = `${body.month}-${body.day}`;
      // 先删后插，避免 upsert 需要唯一约束
      await client.from('calendar_notes').delete().eq('user_id', userId).eq('year', body.year).eq('date_key', dateKey);
      if (body.note && body.note.trim()) {
        const { error } = await client.from('calendar_notes').insert(
          { user_id: userId, year: body.year, date_key: dateKey, content: body.note.slice(0, 5000) }
        );
        if (error) {
          console.error('[day-data] note insert error:', error);
          return apiError('保存失败', 500);
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[day-data] POST exception:', e);
    return apiError('服务器内部错误', 500);
  }
}
