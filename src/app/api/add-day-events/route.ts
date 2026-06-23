import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { events } = body as {
    events: {
      id: string; year: number; month: number; day: number;
      title: string; start_hour: number; start_min: number;
      end_hour: number; end_min: number;
    }[];
  };

  if (!events || events.length === 0) {
    return NextResponse.json({ error: 'No events provided' }, { status: 400 });
  }

  const client = getSupabaseClient();

  const rows = events.map(e => ({
    id: e.id,
    year: e.year,
    month: e.month,
    day: e.day,
    title: e.title,
    start_hour: e.start_hour,
    start_min: e.start_min,
    end_hour: e.end_hour,
    end_min: e.end_min,
    created_at: new Date().toISOString(),
  }));

  const { error } = await client.from('day_events').upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('[add-day-events] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: rows.length });
}
