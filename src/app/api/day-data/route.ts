import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  const day = Number(searchParams.get('day'));

  if (!year || !month || !day) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const [eventsRes, todosRes] = await Promise.all([
    client.from('day_events').select('*').eq('user_id', userId).eq('year', year).eq('month', month).eq('day', day).order('start_hour', { ascending: true }),
    client.from('day_todos').select('*').eq('user_id', userId).eq('year', year).eq('month', month).eq('day', day).order('created_at', { ascending: true }),
  ]);

  if (eventsRes.error) return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });
  if (todosRes.error) return NextResponse.json({ error: todosRes.error.message }, { status: 500 });

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

  const body = await request.json();
  const { year, month, day, type, data: rawData } = body as {
    year: number; month: number; day: number;
    type?: string;
    data?: unknown[];
    events?: { id: string; title: string; time?: string; endTime?: string; startHour?: number; startMin?: number; endHour?: number; endMin?: number; color?: string; done?: boolean }[];
    todos?: { id: string; text: string; done: boolean }[];
  };

  type EventInput = { id: string; title: string; time?: string; endTime?: string; startHour?: number; startMin?: number; endHour?: number; endMin?: number };
  type TodoInput = { id: string; text: string; done: boolean };
  const events: EventInput[] | undefined = body.events || (type === 'events' ? rawData as EventInput[] : undefined);
  const todos: TodoInput[] | undefined = body.todos || (type === 'todos' ? rawData as TodoInput[] : undefined);

  if (!year || !month || !day) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = getSupabaseClient();

  // Delete existing events and todos for this user on this date
  await client.from('day_events').delete().eq('user_id', userId).eq('year', year).eq('month', month).eq('day', day);
  await client.from('day_todos').delete().eq('user_id', userId).eq('year', year).eq('month', month).eq('day', day);

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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (todos && todos.length > 0) {
    const rows = todos.map(t => ({
      user_id: userId,
      id: t.id, year, month, day,
      text: t.text,
      done: t.done ?? false,
      created_at: new Date().toISOString(),
    }));
    const { error } = await client.from('day_todos').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
