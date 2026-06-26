import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

// Use 'legacy' as default user_id — matches the RLS policy exception:
//   (user_id = 'legacy' OR auth.uid()::text = user_id)
const USER_ID = 'legacy';

// GET /api/calendar-data?type=overrides|notes|month-review|drawing&year=2025[&month=7][&sectionKey=goals]
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const year = Number(searchParams.get('year'));

  if (!type || !year) {
    return NextResponse.json({ error: 'Missing type/year' }, { status: 400 });
  }

  const month = Number(searchParams.get('month'));
  const sectionKey = searchParams.get('sectionKey') || '';
  const client = getSupabaseClient();

  if (type === 'overrides') {
    const { data, error } = await client
      .from('calendar_overrides')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('year', year);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const overrideMap: Record<string, string> = {};
    (data || []).forEach((row: { date_key: string; value: string }) => {
      overrideMap[row.date_key] = row.value;
    });
    return NextResponse.json(overrideMap);
  }

  if (type === 'notes') {
    const { data, error } = await client
      .from('calendar_notes')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('year', year);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const noteMap: Record<string, string> = {};
    (data || []).forEach((row: { date_key: string; content: string }) => {
      noteMap[row.date_key] = row.content;
    });
    return NextResponse.json(noteMap);
  }

  if (type === 'month-review') {
    if (!month) {
      return NextResponse.json({ error: 'Missing month' }, { status: 400 });
    }
    // 单 section 查询
    if (sectionKey) {
      const { data, error } = await client
        .from('month_reviews')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('year', year)
        .eq('month', month)
        .eq('section_key', sectionKey)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data?.content || '');
    }
    // 全 sections 一次性返回：{ [sectionKey]: content }
    const { data, error } = await client
      .from('month_reviews')
      .select('section_key, content')
      .eq('user_id', USER_ID)
      .eq('year', year)
      .eq('month', month);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const map: Record<string, string> = {};
    (data || []).forEach((row: { section_key: string; content: string }) => {
      map[row.section_key] = row.content;
    });
    return NextResponse.json(map);
  }

  if (type === 'drawing') {
    const { data, error } = await client
      .from('calendar_drawings')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('year', year)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data?.strokes || null);
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}

// POST /api/calendar-data
// body: { type, year, data }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, year, data, month, sectionKey } = body as {
    type: string; year: number; month?: number; sectionKey?: string; data: unknown;
  };

  if (!type || !year) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = getSupabaseClient();

  if (type === 'overrides') {
    const overrideData = data as Record<string, string>;
    await client.from('calendar_overrides').delete().eq('user_id', USER_ID).eq('year', year);

    const entries = Object.entries(overrideData);
    if (entries.length > 0) {
      const rows = entries.map(([dateKey, value]) => ({
        user_id: USER_ID,
        year,
        date_key: dateKey,
        value,
      }));
      const { error } = await client.from('calendar_overrides').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (type === 'notes') {
    const notesData = data as Record<string, string>;
    await client.from('calendar_notes').delete().eq('user_id', USER_ID).eq('year', year);

    const entries = Object.entries(notesData).filter(([, v]) => v && v.trim());
    if (entries.length > 0) {
      const rows = entries.map(([dateKey, content]) => ({
        user_id: USER_ID,
        year,
        date_key: dateKey,
        content,
      }));
      const { error } = await client.from('calendar_notes').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (type === 'month-review') {
    if (!month || !sectionKey) {
      return NextResponse.json({ error: 'Missing month/sectionKey' }, { status: 400 });
    }
    const content = (data as string) || '';

    // Upsert: delete existing then insert
    await client
      .from('month_reviews')
      .delete()
      .eq('user_id', USER_ID)
      .eq('year', year)
      .eq('month', month)
      .eq('section_key', sectionKey);

    const { error } = await client.from('month_reviews').insert({
      user_id: USER_ID,
      year,
      month,
      section_key: sectionKey,
      content,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (type === 'drawing') {
    const strokes = data;
    // Upsert
    const { data: existing } = await client
      .from('calendar_drawings')
      .select('id')
      .eq('user_id', USER_ID)
      .eq('year', year)
      .maybeSingle();

    if (existing) {
      const { error } = await client
        .from('calendar_drawings')
        .update({ strokes, updated_at: new Date().toISOString() })
        .eq('user_id', USER_ID)
        .eq('year', year);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await client.from('calendar_drawings').insert({
        user_id: USER_ID,
        year,
        strokes,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
