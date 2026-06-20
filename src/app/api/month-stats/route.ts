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

  // 1. 总勾选数
  const { count: totalChecked } = await client
    .from('calendar_overrides')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('year', year)
    .neq('value', 'crossed');

  // 2. 已复习日(完成复盘或记录明天计划)
  const { data: reviewDays } = await client
    .from('daily_reviews')
    .select('month, day, mood_score, energy, completed, tomorrow_todo, good_things, problems, reflections')
    .eq('user_id', userId)
    .eq('year', year);

  // 3. 满意度
  const moodScores = (reviewDays || []).map((r: Record<string, unknown>) => r.mood_score).filter((s): s is number => typeof s === 'number');
  const energies = (reviewDays || []).map((r: Record<string, unknown>) => r.energy).filter((s): s is number => typeof s === 'number');

  // 4. 已完结的 OKR 任务数
  const { count: okrDone } = await client
    .from('okr_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('done', true);

  // 5. 日程总数
  const { count: eventCount } = await client
    .from('day_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('year', year);

  // 6. 待办总数
  const { count: todoCount } = await client
    .from('day_todos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('year', year);

  return NextResponse.json({
    totalChecked: totalChecked ?? 0,
    reviewCount: (reviewDays || []).length,
    okrDone: okrDone ?? 0,
    eventCount: eventCount ?? 0,
    todoCount: todoCount ?? 0,
    avgMood: moodScores.length ? Number((moodScores.reduce((a, b) => a + b, 0) / moodScores.length).toFixed(2)) : 0,
    avgEnergy: energies.length ? Number((energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(2)) : 0,
  });
}
