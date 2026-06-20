import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  requireUser,
  parseJsonBody,
  apiError,
} from '@/lib/api-auth';

export const runtime = 'nodejs';

// ─── Zod schemas ───
const kvItemSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.unknown(),
}).strict();

const postBodySchema = z.object({
  items: z.array(kvItemSchema).max(200),
}).strict();

const deleteBodySchema = z.object({
  keys: z.array(z.string().min(1).max(200)).max(500),
}).strict();

// GET /api/user-data
// 拉取登录用户的所有 user_kv_store 数据，返回 { key, value }[] 格式
// 前端会把它逐个 setItem 到 localStorage
export async function GET(req: NextRequest) {
  const userIdOrResp = await requireUser(req);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('user_kv_store')
    .select('key, value')
    .eq('user_id', userId);

  if (error) {
    return apiError('查询失败', 500, error);
  }

  return NextResponse.json({ items: data ?? [] });
}

// POST /api/user-data
// 批量 upsert 登录用户的 localStorage 数据到 user_kv_store
// body: { items: [{ key, value }, ...] }
export async function POST(req: NextRequest) {
  const userIdOrResp = await requireUser(req);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsed = await parseJsonBody(req, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;
  const { items } = parsed;

  if (items.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const rows = items.map((it) => ({
    user_id: userId,
    key: it.key,
    value: it.value as never,
    updated_at: new Date().toISOString(),
  }));

  const client = getSupabaseClient();
  const { error } = await client
    .from('user_kv_store')
    .upsert(rows, { onConflict: 'user_id,key' });

  if (error) {
    return apiError('同步失败', 500, error);
  }

  return NextResponse.json({ ok: true, count: rows.length });
}

// DELETE /api/user-data
// 登录用户主动删除某些 key（登出时清空 localStorage 不需要走这里）
// body: { keys: string[] }
export async function DELETE(req: NextRequest) {
  const userIdOrResp = await requireUser(req);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsed = await parseJsonBody(req, deleteBodySchema);
  if (parsed instanceof NextResponse) return parsed;
  const { keys } = parsed;

  if (keys.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const client = getSupabaseClient();
  const { error } = await client
    .from('user_kv_store')
    .delete()
    .eq('user_id', userId)
    .in('key', keys);

  if (error) {
    return apiError('删除失败', 500, error);
  }

  return NextResponse.json({ ok: true, count: keys.length });
}
