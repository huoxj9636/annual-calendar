import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser, parseJsonBody, apiError } from '@/lib/api-auth';
import { z } from 'zod';

const postBodySchema = z.object({
  action: z.enum(['push', 'pull']),
  // push: data + timestamp
  // pull: keys
  data: z.unknown().optional(),
  timestamp: z.number().optional(),
  keys: z.array(z.string().max(200)).optional(),
}).passthrough();

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsedBody = await parseJsonBody(request, postBodySchema);
  if (parsedBody instanceof NextResponse) return parsedBody;
  const body = parsedBody as z.infer<typeof postBodySchema>;

  const client = getSupabaseClient();

  try {
    if (body.action === 'push') {
      if (!body.data || typeof body.data !== 'object') {
        return apiError('push 需要 data 字段', 400);
      }
      const entries = Object.entries(body.data as Record<string, unknown>);
      if (entries.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }
      let success = 0;
      for (const [key, value] of entries) {
        if (!key || key.length > 200) continue;
        const { error } = await client
          .from('user_kv_store')
          .upsert(
            { user_id: userId, key, value, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,key' }
          );
        if (!error) success++;
        else console.error('[user-data] push error:', error, 'key:', key);
      }
      return NextResponse.json({ success: true, count: success });
    }
    if (body.action === 'pull') {
      if (!body.keys || body.keys.length === 0) {
        return NextResponse.json({ data: {} });
      }
      const { data, error } = await client
        .from('user_kv_store')
        .select('key, value, updated_at')
        .eq('user_id', userId)
        .in('key', body.keys);
      if (error) {
        console.error('[user-data] pull error:', error);
        return apiError('查询失败', 500);
      }
      const result: Record<string, { value: unknown; updated_at: string }> = {};
      for (const row of data || []) {
        result[row.key] = { value: row.value, updated_at: row.updated_at };
      }
      return NextResponse.json({ data: result });
    }
    return apiError('不支持的 action', 400);
  } catch (e) {
    console.error('[user-data] POST exception:', e);
    return apiError('服务器内部错误', 500);
  }
}

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const { searchParams } = new URL(request.url);
  const keysParam = searchParams.get('keys');
  if (!keysParam) {
    return NextResponse.json({ data: {} });
  }
  const keys = keysParam.split(',').map(s => s.trim()).filter(Boolean);
  if (keys.length === 0) {
    return NextResponse.json({ data: {} });
  }

  const client = getSupabaseClient();
  try {
    const { data, error } = await client
      .from('user_kv_store')
      .select('key, value, updated_at')
      .eq('user_id', userId)
      .in('key', keys);
    if (error) {
      console.error('[user-data] GET error:', error);
      return apiError('查询失败', 500);
    }
    const result: Record<string, { value: unknown; updated_at: string }> = {};
    for (const row of data || []) {
      result[row.key] = { value: row.value, updated_at: row.updated_at };
    }
    return NextResponse.json({ data: result });
  } catch (e) {
    console.error('[user-data] GET exception:', e);
    return apiError('服务器内部错误', 500);
  }
}
