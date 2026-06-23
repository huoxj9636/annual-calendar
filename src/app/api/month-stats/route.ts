import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/month-stats?year=2025
// Returns monthly stats: overrides, event counts, todo counts, memo counts per month
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));

  if (!year) {
    return NextResponse.json({ error: 'Missing year' }, { status: 400 });
  }

  const client = getSupabaseClient();

  try {
    // Get overrides
    const { data: overridesData } = await client
      .from('calendar_overrides')
      .select('date_key, value')
      .eq('year', year);

    const overrides: Record<string, string> = {};
    for (const row of (overridesData || []) as Record<string, string>[]) {
      overrides[row.date_key] = row.value;
    }

    // Get notes
    const { data: notesData } = await client
      .from('calendar_notes')
      .select('date_key, content')
      .eq('year', year);

    const noteKeys = new Set<string>();
    for (const row of (notesData || []) as Record<string, string>[]) {
      if (row.content && row.content.trim()) noteKeys.add(row.date_key);
    }

    // Get event counts per month
    const { data: eventsData } = await client
      .from('day_events')
      .select('month, id')
      .eq('year', year);

    const eventCounts: Record<number, number> = {};
    // Count unique days with events per month
    const eventDaysPerMonth: Record<string, Set<string>> = {};
    for (const row of (eventsData || []) as Record<string, number>[]) {
      const key = String(row.month);
      if (!eventDaysPerMonth[key]) eventDaysPerMonth[key] = new Set();
      // We count rows, each is an event on some day
      eventDaysPerMonth[key].add(String(row.id)); // just count events
    }
    for (const [m, ids] of Object.entries(eventDaysPerMonth)) {
      eventCounts[Number(m)] = ids.size;
    }

    // Get todo counts per month
    const { data: todosData } = await client
      .from('day_todos')
      .select('month, done')
      .eq('year', year);

    const todoCounts: Record<number, { total: number; done: number }> = {};
    for (const row of (todosData || []) as Record<string, number>[]) {
      const m = Number(row.month);
      if (!todoCounts[m]) todoCounts[m] = { total: 0, done: 0 };
      todoCounts[m].total++;
      if (row.done) todoCounts[m].done++;
    }

    return NextResponse.json({ overrides, noteKeys: Array.from(noteKeys), eventCounts, todoCounts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
