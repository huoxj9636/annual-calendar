import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser, parseJsonBody, apiError } from '@/lib/api-auth';
import { z } from 'zod';

const LEGACY_USER_ID = 'legacy';

const TABLES = [
  'calendar_overrides',
  'calendar_notes',
  'calendar_drawings',
  'month_reviews',
  'daily_reviews',
  'day_events',
  'day_todos',
  'okr_objectives',
  'okr_key_results',
  'okr_tasks',
] as const;

const postBodySchema = z.object({
  action: z.enum(['claim', 'clear']),
  tables: z.array(z.string()).optional(),
}).passthrough();

async function getLegacyCounts(client: ReturnType<typeof getSupabaseClient>) {
  const result: Record<string, number> = {};
  for (const table of TABLES) {
    try {
      const { count, error } = await client
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', LEGACY_USER_ID);
      if (error) {
        result[table] = 0;
      } else {
        result[table] = count || 0;
      }
    } catch {
      result[table] = 0;
    }
  }
  return result;
}

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  // const userId = userIdOrResp; // 不需要,只需要鉴权

  const client = getSupabaseClient();
  try {
    const counts = await getLegacyCounts(client);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return NextResponse.json({ counts, total });
  } catch (e) {
    console.error('[migrate-legacy] GET exception:', e);
    return apiError('查询失败', 500);
  }
}

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsedBody = await parseJsonBody(request, postBodySchema);
  if (parsedBody instanceof NextResponse) return parsedBody;
  const body = parsedBody as z.infer<typeof postBodySchema>;

  const client = getSupabaseClient();
  const targetTables = body.tables && body.tables.length > 0
    ? TABLES.filter(t => body.tables!.includes(t))
    : TABLES;

  try {
    if (body.action === 'claim') {
      // 把 legacy 标记的数据所有权转给当前用户
      let claimed = 0;
      for (const table of targetTables) {
        const { data, error } = await client
          .from(table)
          .update({ user_id: userId })
          .eq('user_id', LEGACY_USER_ID)
          .select('id');
        if (error) {
          console.error(`[migrate-legacy] claim ${table} error:`, error);
        } else {
          claimed += (data || []).length;
        }
      }
      return NextResponse.json({ success: true, claimed });
    }
    if (body.action === 'clear') {
      let cleared = 0;
      for (const table of targetTables) {
        const { data, error } = await client
          .from(table)
          .delete()
          .eq('user_id', LEGACY_USER_ID)
          .select('id');
        if (error) {
          console.error(`[migrate-legacy] clear ${table} error:`, error);
        } else {
          cleared += (data || []).length;
        }
      }
      return NextResponse.json({ success: true, cleared });
    }
    return apiError('不支持的 action', 400);
  } catch (e) {
    console.error('[migrate-legacy] POST exception:', e);
    return apiError('服务器内部错误', 500);
  }
}
