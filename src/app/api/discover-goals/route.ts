import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));
  if (!year) return NextResponse.json({ error: 'Missing year' }, { status: 400 });

  const client = getSupabaseClient();

  // 收集该用户所有复盘日
  const { data: reviews } = await client
    .from('daily_reviews')
    .select('month, day, good_things, problems, reflections, tomorrow_todo, mood_score, energy, completed')
    .eq('user_id', userId)
    .eq('year', year);

  // 已勾选日期
  const { data: overrides } = await client
    .from('calendar_overrides')
    .select('date_key')
    .eq('user_id', userId)
    .eq('year', year)
    .neq('value', 'crossed');

  // 全部 OKR 完成情况
  const { data: tasks } = await client
    .from('okr_tasks')
    .select('id, title, done, okr_key_results!inner(title, okr_objectives!inner(title, period))')
    .eq('user_id', userId);

  return NextResponse.json({
    reviews: reviews || [],
    checkedDates: (overrides || []).map((o: Record<string, string>) => o.date_key),
    tasks: tasks || [],
  });
}
