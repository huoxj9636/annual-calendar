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
} from '@/lib/api-auth';

// ─── Zod schemas ───
const getParamsSchema = z.object({
  type: z.enum(['overrides', 'notes', 'month-review', 'drawing']),
  year: yearSchema,
  month: monthSchema.optional(),
});

const postBodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('overrides'),
    year: yearSchema,
    data: z.record(z.string().regex(/^\d{1,2}-\d{1,2}$/), z.string().max(50)),
  }),
  z.object({
    type: z.literal('notes'),
    year: yearSchema,
    data: z.record(z.string().regex(/^\d{1,2}-\d{1,2}$/), z.string().max(10000)),
  }),
  z.object({
    type: z.literal('month-review'),
    year: yearSchema,
    month: monthSchema,
    sectionKey: z.string().min(1).max(100).regex(/^[\w-]+$/),
    data: z.string().max(50000),
  }),
  z.object({
    type: z.literal('drawing'),
    year: yearSchema,
    data: z.array(z.unknown()).max(5000), // 笔画数组
  }),
]);

// GET /api/calendar-data?type=overrides|notes|month-review|drawing&year=2025[&month=7][&sectionKey=goals]
export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(searchParams, getParamsSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { type, year, month } = parsed;

  const client = getSupabaseClient();

  if (type === 'overrides') {
    const { data, error } = await client
      .from('calendar_overrides')
      .select('date_key, value')
      .eq('user_id', userId)
      .eq('year', year);

    if (error) return apiError('加载勾选状态失败', 500, error);

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
      .eq('user_id', userId)
      .eq('year', year);

    if (error) return apiError('加载备注失败', 500, error);

    const notes: Record<string, string> = {};
    for (const row of (data || []) as Record<string, string>[]) {
      if (row.content) notes[row.date_key] = row.content;
    }
    return NextResponse.json(notes);
  }

  if (type === 'month-review') {
    if (month == null) return apiError('month-review 需要 month 参数', 400);

    const { data, error } = await client
      .from('month_reviews')
      .select('section_key, content')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month);

    if (error) return apiError('加载月度复盘失败', 500, error);

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
      .eq('user_id', userId)
      .eq('year', year)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') return apiError('加载涂鸦失败', 500, error);
    return NextResponse.json({ strokes: (data as Record<string, unknown>)?.strokes || [] });
  }

  // 不应到达这里(zod 已限制 type 取值)
  return apiError('Invalid type', 400);
}

// POST /api/calendar-data
export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsed = await parseJsonBody(request, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const client = getSupabaseClient();

  // ── overrides ──
  if (parsed.type === 'overrides') {
    const { year, data: overrideData } = parsed;
    await client.from('calendar_overrides').delete().eq('user_id', userId).eq('year', year);

    const entries = Object.entries(overrideData);
    if (entries.length > 0) {
      const rows = entries.map(([dateKey, value]) => ({
        user_id: userId,
        year,
        date_key: dateKey,
        value,
      }));
      const { error } = await client.from('calendar_overrides').insert(rows);
      if (error) return apiError('保存勾选状态失败', 500, error);
    }
    return NextResponse.json({ success: true });
  }

  // ── notes ──
  if (parsed.type === 'notes') {
    const { year, data: notesData } = parsed;
    await client.from('calendar_notes').delete().eq('user_id', userId).eq('year', year);

    const entries = Object.entries(notesData).filter(([, v]) => v && v.trim());
    if (entries.length > 0) {
      const rows = entries.map(([dateKey, content]) => ({
        user_id: userId,
        year,
        date_key: dateKey,
        content,
      }));
      const { error } = await client.from('calendar_notes').insert(rows);
      if (error) return apiError('保存备注失败', 500, error);
    }
    return NextResponse.json({ success: true });
  }

  // ── month-review ──
  if (parsed.type === 'month-review') {
    const { year, month, sectionKey, data: content } = parsed;

    // Upsert: delete existing then insert (限定当前用户)
    await client
      .from('month_reviews')
      .delete()
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .eq('section_key', sectionKey);

    const { error } = await client.from('month_reviews').insert({
      user_id: userId,
      year,
      month,
      section_key: sectionKey,
      content,
    });
    if (error) return apiError('保存月度复盘失败', 500, error);
    return NextResponse.json({ success: true });
  }

  // ── drawing ──
  if (parsed.type === 'drawing') {
    const { year, data: strokes } = parsed;

    // Upsert (限定当前用户)
    const { data: existing } = await client
      .from('calendar_drawings')
      .select('id')
      .eq('user_id', userId)
      .eq('year', year)
      .maybeSingle();

    if (existing) {
      const { error } = await client
        .from('calendar_drawings')
        .update({ strokes, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('year', year);
      if (error) return apiError('更新涂鸦失败', 500, error);
    } else {
      const { error } = await client.from('calendar_drawings').insert({
        user_id: userId,
        year,
        strokes,
      });
      if (error) return apiError('保存涂鸦失败', 500, error);
    }
    return NextResponse.json({ success: true });
  }

  return apiError('Invalid type', 400);
}
