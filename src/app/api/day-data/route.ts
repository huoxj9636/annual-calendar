import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  const day = Number(searchParams.get('day'));

  if (!year || !month || !day) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const [eventsRes, todosRes] = await Promise.all([
    client.from('day_events').select('*').eq('year', year).eq('month', month).eq('day', day).order('start_hour', { ascending: true }),
    client.from('day_todos').select('*').eq('year', year).eq('month', month).eq('day', day).order('created_at', { ascending: true }),
  ]);

  if (eventsRes.error) return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });
  if (todosRes.error) return NextResponse.json({ error: todosRes.error.message }, { status: 500 });

  const events = (eventsRes.data || []).map((e: Record<string, unknown>) => ({
    id: e.id,
    title: e.title,
    startHour: e.start_hour ?? 0,
    startMin: e.start_min ?? 0,
    endHour: e.end_hour ?? 0,
    endMin: e.end_min ?? 0,
  }));

  const todos = (todosRes.data || []).map((t: Record<string, unknown>) => ({
    id: t.id,
    text: t.text,
    done: t.done ?? false,
  }));

  return NextResponse.json({ events, todos });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { year, month, day, events, todos } = body as {
    year: number; month: number; day: number;
    events: { id: string; title: string; startHour: number; startMin: number; endHour: number; endMin: number }[];
    todos: { id: string; text: string; done: boolean }[];
  };

  if (!year || !month || !day) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = getSupabaseClient();

  // Delete existing events and todos for this date
  await client.from('day_events').delete().eq('year', year).eq('month', month).eq('day', day);
  await client.from('day_todos').delete().eq('year', year).eq('month', month).eq('day', day);

  // Insert new events
  if (events && events.length > 0) {
    const rows = events.map(e => ({
      id: e.id, year, month, day,
      title: e.title,
      start_hour: e.startHour,
      start_min: e.startMin,
      end_hour: e.endHour,
      end_min: e.endMin,
      created_at: new Date().toISOString(),
    }));
    const { error } = await client.from('day_events').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert new todos
  if (todos && todos.length > 0) {
    const rows = todos.map(t => ({
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
