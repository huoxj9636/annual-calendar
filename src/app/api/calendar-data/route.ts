import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/calendar-data?type=overrides|notes|month-review|drawing&year=2025[&month=7][&sectionKey=goals]
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const year = Number(searchParams.get('year'));

  if (!type || !year) {
    return NextResponse.json({ error: 'Missing type/year' }, { status: 400 });
  }

  const client = getSupabaseClient();

  if (type === 'overrides') {
    const { data, error } = await client
      .from('calendar_overrides')
      .select('date_key, value')
      .eq('year', year);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const overrides: Record<string, string> = {};
    for (const row of (data || []) as Record<string, string>[]) {
      overrides[row.date_key] = row.value;
    }
    return NextResponse.json(overrides);
  }

  if (type === 'notes') {
    const { data, error } = await client
      .from('calendar_notes')
      .select('date_key, content')
      .eq('year', year);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const notes: Record<string, string> = {};
    for (const row of (data || []) as Record<string, string>[]) {
      if (row.content) notes[row.date_key] = row.content;
    }
    return NextResponse.json(notes);
  }

  if (type === 'month-review') {
    const month = Number(searchParams.get('month'));
    if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 });

    const { data, error } = await client
      .from('month_reviews')
      .select('section_key, content')
      .eq('year', year)
      .eq('month', month);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result: Record<string, string> = {};
    for (const row of (data || []) as Record<string, string>[]) {
      if (row.content) result[row.section_key] = row.content;
    }
    return NextResponse.json(result);
  }

  if (type === 'drawing') {
    const { data, error } = await client
      .from('calendar_drawings')
      .select('strokes')
      .eq('year', year)
      .single();

    if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ strokes: (data as Record<string, unknown>)?.strokes || [] });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}

// POST /api/calendar-data
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, year, data, month, sectionKey } = body as {
    type: 'overrides' | 'notes' | 'month-review' | 'drawing';
    year: number;
    data: unknown;
    month?: number;
    sectionKey?: string;
  };

  if (!type || !year) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = getSupabaseClient();

  if (type === 'overrides') {
    const overrideData = data as Record<string, string>;
    await client.from('calendar_overrides').delete().eq('year', year);

    const entries = Object.entries(overrideData);
    if (entries.length > 0) {
      const rows = entries.map(([dateKey, value]) => ({
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
    await client.from('calendar_notes').delete().eq('year', year);

    const entries = Object.entries(notesData).filter(([, v]) => v && v.trim());
    if (entries.length > 0) {
      const rows = entries.map(([dateKey, content]) => ({
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
      .eq('year', year)
      .eq('month', month)
      .eq('section_key', sectionKey);

    const { error } = await client.from('month_reviews').insert({
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
      .eq('year', year)
      .single();

    if (existing) {
      const { error } = await client
        .from('calendar_drawings')
        .update({ strokes, updated_at: new Date().toISOString() })
        .eq('year', year);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await client.from('calendar_drawings').insert({
        year,
        strokes,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
