import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

const USER_ID = 'legacy';

function parseTime(t: string): { hour: number; min: number } {
  if (!t || typeof t !== 'string') return { hour: 0, min: 0 };
  const [h, m] = t.split(':').map((v) => parseInt(v, 10) || 0);
  return { hour: h, min: m };
}

// GET /api/day-data?year=&month=&day= — 读该日 events + todos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  const day = Number(searchParams.get('day'));

  if (!year || !month || !day) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = getSupabaseClient();

  const { data: events, error: e1 } = await client
    .from('day_events')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('year', year)
    .eq('month', month)
    .eq('day', day)
    .order('start_hour', { ascending: true })
    .order('start_min', { ascending: true });
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  const { data: todos, error: e2 } = await client
    .from('day_todos')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('year', year)
    .eq('month', month)
    .eq('day', day)
    .order('created_at', { ascending: true });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({ events: events || [], todos: todos || [] });
}

// POST /api/day-data — body: { type: 'events'|'todos'|'note', year, month, day, data }
//  type='events' : data = EventItem[] （用 time/endTime/title/desc 字段）
//  type='todos'  : data = TodoItem[]  （用 text/checked 字段）
//  type='note'   : data = string（暂不持久化，前端有 dayview-note 单独 API）
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, year, month, day, data } = body as {
    type: string;
    year: number;
    month: number;
    day: number;
    data: unknown;
  };

  if (!type || !year || !month || !day) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = getSupabaseClient();

  if (type === 'events') {
    const items = Array.isArray(data) ? (data as Array<{ time?: string; endTime?: string; title?: string; desc?: string; color?: string }>) : [];
    if (items.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }
    const rows = items.map((e) => {
      const start = parseTime(e.time || '');
      const end = parseTime(e.endTime || '');
      return {
        user_id: USER_ID,
        year,
        month,
        day,
        title: e.title || '',
        notes: e.desc || '',
        start_hour: start.hour,
        start_min: start.min,
        end_hour: end.hour,
        end_min: end.min,
        color: e.color || null,
      };
    });
    const { error } = await client.from('day_events').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, count: rows.length });
  }

  if (type === 'todos') {
    const items = Array.isArray(data) ? (data as Array<{ text?: string; checked?: boolean }>) : [];
    if (items.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }
    const rows = items.map((t) => ({
      user_id: USER_ID,
      year,
      month,
      day,
      text: t.text || '',
      done: !!t.checked,
    }));
    const { error } = await client.from('day_todos').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, count: rows.length });
  }

  if (type === 'note') {
    return NextResponse.json({ success: true, note: 'persisted client-side' });
  }

  return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
}
