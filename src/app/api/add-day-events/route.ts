import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const body = await request.json();
  const { year, month, day, events } = body as {
    year: number; month: number; day: number;
    events: Array<{ id?: string; title: string; startHour: number; startMin: number; endHour?: number; endMin?: number; color?: string }>;
  };

  if (!year || !month || !day || !Array.isArray(events)) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = getSupabaseClient();

  const rows = events.map(e => ({
    user_id: userId,
    id: e.id,
    year, month, day,
    title: e.title,
    start_hour: e.startHour,
    start_min: e.startMin,
    end_hour: e.endHour ?? null,
    end_min: e.endMin ?? null,
    color: e.color ?? null,
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await client
    .from('day_events')
    .upsert(rows, { onConflict: 'id' })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: data?.length ?? 0 });
}
