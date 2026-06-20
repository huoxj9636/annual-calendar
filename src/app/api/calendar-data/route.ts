import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser, parseJsonBody, apiError } from '@/lib/api-auth';
import { z } from 'zod';

// 真实 schema:
// calendar_overrides(id, user_id, year, date_key, value) - date_key 格式 "M-D" 或 "MM-DD"
// calendar_notes(id, user_id, year, date_key, content)
// calendar_drawings(id, user_id, year, date_key, strokes)
// month_reviews(id, user_id, year, month, section_key, content)

const getQuerySchema = z.object({
  type: z.enum(['overrides', 'notes', 'drawings', 'month_reviews', 'month_review']),
  year: z.coerce.number().int().min(1900).max(2200),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const postBodySchema = z.object({
  type: z.enum(['overrides', 'notes', 'drawings', 'month_reviews', 'month_review']),
  year: z.coerce.number().int().min(1900).max(2200),
  month: z.coerce.number().int().min(1).max(12).optional(),
  // overrides: { "3-15": "checked", "6-20": "crossed" }
  // notes: { "6-20": "今天..." }
  // drawings: { "6-20": { strokes: [...], color: "..." } }
  // month_reviews: { summary: "...", highlights: [...], ... }
  data: z.unknown().optional(),
}).passthrough();

function normalizeDateKey(k: string): string {
  // "3-15" -> "3-15", "03-15" -> "3-15", "2025-3-15" -> "3-15"
  const parts = k.split('-').map(s => s.trim()).filter(Boolean);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${Number(parts[0])}-${Number(parts[1])}`;
  if (parts.length >= 3) return `${Number(parts[1])}-${Number(parts[2])}`;
  return k;
}

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const { searchParams } = new URL(request.url);
  const parsed = getQuerySchema.safeParse({
    type: searchParams.get('type') ?? '',
    year: searchParams.get('year') ?? 0,
    month: searchParams.get('month') ?? undefined,
  });
  if (!parsed.success) {
    return apiError('参数无效', 400);
  }
  const { type, year, month } = parsed.data;
  const client = getSupabaseClient();

  try {
    if (type === 'overrides') {
      const { data, error } = await client
        .from('calendar_overrides')
        .select('*')
        .eq('user_id', userId)
        .eq('year', year);
      if (error) {
        console.error('[calendar-data] overrides GET error:', error);
        return apiError('查询失败', 500);
      }
      const result: Record<string, string> = {};
      for (const row of data || []) {
        result[row.date_key] = row.value;
      }
      return NextResponse.json({ data: result });
    }
    if (type === 'notes') {
      const { data, error } = await client
        .from('calendar_notes')
        .select('*')
        .eq('user_id', userId)
        .eq('year', year);
      if (error) {
        console.error('[calendar-data] notes GET error:', error);
        return apiError('查询失败', 500);
      }
      const result: Record<string, string> = {};
      for (const row of data || []) {
        result[row.date_key] = row.content;
      }
      return NextResponse.json({ data: result });
    }
    if (type === 'drawings') {
      const { data, error } = await client
        .from('calendar_drawings')
        .select('*')
        .eq('user_id', userId)
        .eq('year', year);
      if (error) {
        console.error('[calendar-data] drawings GET error:', error);
        return apiError('查询失败', 500);
      }
      const result: Record<string, { strokes: unknown }> = {};
      for (const row of data || []) {
        if (row.date_key) {
          result[row.date_key] = { strokes: row.strokes };
        }
      }
      return NextResponse.json({ data: result });
    }
    if (type === 'month_reviews' || type === 'month_review') {
      if (!month) return apiError('需要 month 参数', 400);
      const { data, error } = await client
        .from('month_reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month);
      if (error) {
        console.error('[calendar-data] month_reviews GET error:', error);
        return apiError('查询失败', 500);
      }
      const result: Record<string, string> = {};
      for (const row of data || []) {
        result[row.section_key] = row.content;
      }
      return NextResponse.json({ data: result });
    }
    return apiError('不支持的 type', 400);
  } catch (e) {
    console.error('[calendar-data] GET exception:', e);
    return apiError('服务器内部错误', 500);
  }
}

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsedBody = await parseJsonBody(request, postBodySchema);
  if (parsedBody instanceof NextResponse) return parsedBody;
  const body = parsedBody as z.infer<typeof postBodySchema> & { data?: unknown };
  const { type, year, month } = body;
  const data = body.data;
  const client = getSupabaseClient();

  try {
    if (type === 'overrides') {
      if (!data || typeof data !== 'object') return apiError('需要 data 字段', 400);
      const entries = Object.entries(data as Record<string, string>)
        .filter(([k, v]) => typeof v === 'string' && v.trim());
      if (entries.length === 0) {
        await client.from('calendar_overrides').delete().eq('user_id', userId).eq('year', year);
        return NextResponse.json({ success: true, count: 0 });
      }
      // 先删后插(简化,适合每天少量数据)
      await client.from('calendar_overrides').delete().eq('user_id', userId).eq('year', year);
      const rows = entries.map(([dateKey, value]) => ({
        user_id: userId,
        year,
        date_key: normalizeDateKey(dateKey),
        value: String(value).slice(0, 50),
      }));
      const { error } = await client.from('calendar_overrides').insert(rows);
      if (error) {
        console.error('[calendar-data] overrides POST error:', error);
        return apiError('保存失败', 500);
      }
      return NextResponse.json({ success: true, count: rows.length });
    }
    if (type === 'notes') {
      if (!data || typeof data !== 'object') return apiError('需要 data 字段', 400);
      const entries = Object.entries(data as Record<string, string>)
        .filter(([k, v]) => typeof v === 'string');
      await client.from('calendar_notes').delete().eq('user_id', userId).eq('year', year);
      if (entries.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }
      const rows = entries.map(([dateKey, content]) => ({
        user_id: userId,
        year,
        date_key: normalizeDateKey(dateKey),
        content: String(content).slice(0, 5000),
      }));
      const { error } = await client.from('calendar_notes').insert(rows);
      if (error) {
        console.error('[calendar-data] notes POST error:', error);
        return apiError('保存失败', 500);
      }
      return NextResponse.json({ success: true, count: rows.length });
    }
    if (type === 'drawings') {
      if (!data || typeof data !== 'object') return apiError('需要 data 字段', 400);
      const entries = Object.entries(data as Record<string, { strokes?: unknown }>);
      await client.from('calendar_drawings').delete().eq('user_id', userId).eq('year', year);
      const validRows = entries
        .filter(([_, v]) => v && typeof v === 'object' && v.strokes)
        .map(([dateKey, v]) => ({
          user_id: userId,
          year,
          date_key: normalizeDateKey(dateKey),
          strokes: v.strokes,
        }));
      if (validRows.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }
      const { error } = await client.from('calendar_drawings').insert(validRows);
      if (error) {
        console.error('[calendar-data] drawings POST error:', error);
        return apiError('保存失败', 500);
      }
      return NextResponse.json({ success: true, count: validRows.length });
    }
    if (type === 'month_reviews' || type === 'month_review') {
      if (!month) return apiError('需要 month 参数', 400);
      if (!data || typeof data !== 'object') return apiError('需要 data 字段', 400);
      const entries = Object.entries(data as Record<string, string | number | null | undefined>)
        .filter(([k, v]) => k && (typeof v === 'string' || typeof v === 'number'));
      await client.from('month_reviews').delete().eq('user_id', userId).eq('year', year).eq('month', month);
      if (entries.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }
      const rows = entries.map(([section_key, content]) => ({
        user_id: userId,
        year,
        month,
        section_key: section_key.slice(0, 100),
        content: String(content).slice(0, 10000),
      }));
      const { error } = await client.from('month_reviews').upsert(rows, { onConflict: 'user_id,year,month,section_key' });
      if (error) {
        console.error('[calendar-data] month_reviews POST error:', error);
        return apiError('保存失败', 500);
      }
      return NextResponse.json({ success: true, count: rows.length });
    }
    return apiError('不支持的 type', 400);
  } catch (e) {
    console.error('[calendar-data] POST exception:', e);
    return apiError('服务器内部错误', 500);
  }
}
