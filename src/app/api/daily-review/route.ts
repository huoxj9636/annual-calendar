import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser, parseJsonBody, apiError } from '@/lib/api-auth';
import { z } from 'zod';

const dailyReviewSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200),
  month: z.coerce.number().int().min(1).max(12),
  day: z.coerce.number().int().min(1).max(31),
  completed: z.boolean().optional(),
  goodThings: z.string().max(5000).optional(),
  problems: z.string().max(5000).optional(),
  mood: z.string().max(50).optional(),
  reflections: z.string().max(5000).optional(),
  tomorrowTodo: z.string().max(2000).optional(),
  moodScore: z.coerce.number().int().min(1).max(10).optional(),
  energy: z.coerce.number().int().min(1).max(10).optional(),
}).passthrough();

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const day = searchParams.get('day');

  const client = getSupabaseClient();
  try {
    if (year && month && day) {
      const y = Number(year), m = Number(month), d = Number(day);
      if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
        return apiError('无效日期', 400);
      }
      const { data, error } = await client
        .from('daily_reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('year', y)
        .eq('month', m)
        .eq('day', d)
        .maybeSingle();
      if (error) {
        console.error('[daily-review] GET error:', error);
        return apiError('查询失败', 500);
      }
      return NextResponse.json({ review: data });
    }
    // 无日期参数: 返回整月
    if (year && month) {
      const y = Number(year), m = Number(month);
      if (Number.isNaN(y) || Number.isNaN(m)) {
        return apiError('无效年月', 400);
      }
      const { data, error } = await client
        .from('daily_reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('year', y)
        .eq('month', m);
      if (error) {
        console.error('[daily-review] GET month error:', error);
        return apiError('查询失败', 500);
      }
      return NextResponse.json({ reviews: data || [] });
    }
    // 无参数: 返回当年
    const y = Number(year) || new Date().getFullYear();
    const { data, error } = await client
      .from('daily_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('year', y);
    if (error) {
      console.error('[daily-review] GET year error:', error);
      return apiError('查询失败', 500);
    }
    return NextResponse.json({ reviews: data || [] });
  } catch (e) {
    console.error('[daily-review] GET exception:', e);
    return apiError('服务器内部错误', 500);
  }
}

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsedBody = await parseJsonBody(request, dailyReviewSchema);
  if (parsedBody instanceof NextResponse) return parsedBody;
  const body = parsedBody as z.infer<typeof dailyReviewSchema>;

  const client = getSupabaseClient();
  try {
    const row = {
      user_id: userId,
      year: body.year,
      month: body.month,
      day: body.day,
      completed: !!body.completed,
      good_things: body.goodThings || null,
      problems: body.problems || null,
      mood: body.mood || null,
      reflections: body.reflections || null,
      tomorrow_todo: body.tomorrowTodo || null,
      mood_score: body.moodScore ?? null,
      energy: body.energy ?? null,
    };
    // delete + insert 代替 upsert（避免需要唯一约束）
    await client
      .from('daily_reviews')
      .delete()
      .eq('user_id', userId)
      .eq('year', body.year)
      .eq('month', body.month)
      .eq('day', body.day);
    const { error } = await client
      .from('daily_reviews')
      .insert(row);
    if (error) {
      console.error('[daily-review] POST error:', error);
      return apiError('保存失败', 500);
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[daily-review] POST exception:', e);
    return apiError('服务器内部错误', 500);
  }
}
