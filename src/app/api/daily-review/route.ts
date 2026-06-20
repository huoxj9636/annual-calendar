import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  requireUser,
  parseJsonBody,
  parseSearchParams,
  apiError,
  yearSchema,
  monthSchema,
  daySchema,
} from '@/lib/api-auth';

// ─── Zod schemas ───
const listDaysParamsSchema = z.object({
  action: z.literal('list-days'),
  year: yearSchema,
});

const singleDayParamsSchema = z.object({
  year: yearSchema,
  month: monthSchema,
  day: daySchema,
});

const reviewField = z.string().max(10000);
const scoreField = z.number().int().min(1).max(5);

const postBodySchema = z.object({
  year: yearSchema,
  month: monthSchema,
  day: daySchema,
  completed: reviewField.optional(),
  goodThings: reviewField.optional(),
  problems: reviewField.optional(),
  mood: reviewField.optional(),
  reflections: reviewField.optional(),
  tomorrowTodo: reviewField.optional(),
  moodScore: scoreField.optional(),
  energy: scoreField.optional(),
}).strict();

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  const client = getSupabaseClient();

  // List days that have review content for a year
  if (action === 'list-days') {
    const parsed = parseSearchParams(searchParams, listDaysParamsSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { year } = parsed;

    const { data, error } = await client
      .from('daily_reviews')
      .select('month, day, completed, good_things, problems, mood, reflections, tomorrow_todo')
      .eq('user_id', userId)
      .eq('year', year);
    if (error) return apiError('加载复盘列表失败', 500, error);
    const days = (data || [])
      .filter((r: Record<string, unknown>) =>
        !!(r.completed || r.good_things || r.problems || r.mood || r.reflections || r.tomorrow_todo))
      .map((r: { month: number; day: number }) => `${year}-${r.month}-${r.day}`);
    const actionDays = (data || [])
      .filter((r: Record<string, unknown>) => !!(r.completed || r.tomorrow_todo))
      .map((r: { month: number; day: number }) => `${year}-${r.month}-${r.day}`);
    return NextResponse.json({ days, actionDays });
  }

  // Single day lookup
  const parsed = parseSearchParams(searchParams, singleDayParamsSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { year, month, day } = parsed;

  const { data, error } = await client
    .from('daily_reviews')
    .select('completed, good_things, problems, mood, reflections, tomorrow_todo, mood_score, energy, updated_at')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .eq('day', day)
    .maybeSingle();

  if (error) return apiError('加载复盘失败', 500, error);

  if (!data) {
    return NextResponse.json({
      completed: '', goodThings: '', problems: '', mood: '',
      reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '',
    });
  }

  return NextResponse.json({
    completed: data.completed || '',
    goodThings: data.good_things || '',
    problems: data.problems || '',
    mood: data.mood || '',
    reflections: data.reflections || '',
    tomorrowTodo: data.tomorrow_todo || '',
    moodScore: data.mood_score ?? 3,
    energy: data.energy ?? 3,
    updatedAt: data.updated_at || '',
  });
}

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsed = await parseJsonBody(request, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;
  const {
    year, month, day,
    completed = '', goodThings = '', problems = '',
    mood = '', reflections = '', tomorrowTodo = '',
    moodScore = 3, energy = 3,
  } = parsed;

  const client = getSupabaseClient();
  const row = {
    user_id: userId,
    year, month, day,
    completed,
    good_things: goodThings,
    problems,
    mood,
    reflections,
    tomorrow_todo: tomorrowTodo,
    mood_score: moodScore,
    energy,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from('daily_reviews')
    .upsert(row, { onConflict: 'user_id,year,month,day' });

  if (error) return apiError('保存复盘失败', 500, error);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(searchParams, singleDayParamsSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { year, month, day } = parsed;

  const client = getSupabaseClient();
  const { error } = await client
    .from('daily_reviews')
    .delete()
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .eq('day', day);

  if (error) return apiError('删除复盘失败', 500, error);
  return NextResponse.json({ success: true });
}
