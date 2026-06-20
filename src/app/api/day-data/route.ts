import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  requireUser,
  parseJsonBody,
  parseSearchParams,
  apiError,
  yearSchema,
  monthSchema,
  daySchema,
} from '@/lib/api-auth';

// ─── Zod schemas ───
const dateParamsSchema = z.object({
  year: yearSchema,
  month: monthSchema,
  day: daySchema,
});

const eventSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  time: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  startHour: z.number().int().min(0).max(23).optional(),
  startMin: z.number().int().min(0).max(59).optional(),
  endHour: z.number().int().min(0).max(23).optional(),
  endMin: z.number().int().min(0).max(59).optional(),
  color: z.string().max(50).optional(),
  done: z.boolean().optional(),
}).strict();

const todoSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(2000),
  done: z.boolean(),
}).strict();

const postBodySchema = z.object({
  year: yearSchema,
  month: monthSchema,
  day: daySchema,
  type: z.enum(['events', 'todos']).optional(),
  data: z.array(z.unknown()).max(500).optional(),
  events: z.array(eventSchema).max(500).optional(),
  todos: z.array(todoSchema).max(500).optional(),
}).strict();

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(searchParams, dateParamsSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { year, month, day } = parsed;

  const client = getSupabaseClient();
  const [eventsRes, todosRes] = await Promise.all([
    client.from('day_events').select('*').eq('user_id', userId).eq('year', year).eq('month', month).eq('day', day).order('start_hour', { ascending: true }),
    client.from('day_todos').select('*').eq('user_id', userId).eq('year', year).eq('month', month).eq('day', day).order('created_at', { ascending: true }),
  ]);

  if (eventsRes.error) return apiError('加载日程失败', 500, eventsRes.error);
  if (todosRes.error) return apiError('加载待办失败', 500, todosRes.error);

  const pad = (n: number) => String(n).padStart(2, '0');
  const events = (eventsRes.data || []).map((e: Record<string, unknown>) => ({
    id: e.id,
    title: e.title,
    time: `${pad((e.start_hour as number) ?? 0)}:${pad((e.start_min as number) ?? 0)}`,
    endTime: e.end_hour != null || e.end_min != null
      ? `${pad((e.end_hour as number) ?? 0)}:${pad((e.end_min as number) ?? 0)}`
      : undefined,
  }));

  const todos = (todosRes.data || []).map((t: Record<string, unknown>) => ({
    id: t.id,
    text: t.text,
    done: t.done ?? false,
  }));

  return NextResponse.json({ events, todos });
}

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsed = await parseJsonBody(request, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;
  const { year, month, day, events, todos } = parsed;

  const client = getSupabaseClient();

  // Delete existing events and todos for this user on this date
  const [delEvents, delTodos] = await Promise.all([
    client.from('day_events').delete().eq('user_id', userId).eq('year', year).eq('month', month).eq('day', day),
    client.from('day_todos').delete().eq('user_id', userId).eq('year', year).eq('month', month).eq('day', day),
  ]);
  if (delEvents.error) return apiError('清理日程失败', 500, delEvents.error);
  if (delTodos.error) return apiError('清理待办失败', 500, delTodos.error);

  if (events && events.length > 0) {
    const parseTime = (t?: string) => {
      if (!t) return { h: 0, m: 0 };
      const parts = t.split(':').map(Number);
      return { h: parts[0] ?? 0, m: parts[1] ?? 0 };
    };
    const rows = events.map(e => {
      const start = e.startHour != null ? { h: e.startHour, m: e.startMin ?? 0 } : parseTime(e.time);
      const end = e.endHour != null ? { h: e.endHour, m: e.endMin ?? 0 } : parseTime(e.endTime);
      return {
        user_id: userId,
        id: e.id, year, month, day,
        title: e.title,
        start_hour: start.h,
        start_min: start.m,
        end_hour: end.h,
        end_min: end.m,
        created_at: new Date().toISOString(),
      };
    });
    const { error } = await client.from('day_events').insert(rows);
    if (error) return apiError('保存日程失败', 500, error);
  }

  if (todos && todos.length > 0) {
    const rows = todos.map(t => ({
      user_id: userId,
      id: t.id, year, month, day,
      text: t.text,
      done: t.done,
      created_at: new Date().toISOString(),
    }));
    const { error } = await client.from('day_todos').insert(rows);
    if (error) return apiError('保存待办失败', 500, error);
  }

  return NextResponse.json({ success: true });
}
