import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';

// 从请求 header 的 x-session 字段获取 supabase access_token，
// 调用 supabase.auth.getUser 验证身份，返回 user_id
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('x-session');
  if (!token) {
    return null;
  }
  try {
    const client = getSupabaseClient(token);
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return null;
    }
    return data.user.id;
  } catch {
    return null;
  }
}

// GET /api/user-data
// 拉取登录用户的所有 user_kv_store 数据，返回 { key, value }[] 格式
// 前端会把它逐个 setItem 到 localStorage
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('user_kv_store')
    .select('key, value')
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: `查询失败: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

// POST /api/user-data
// 批量 upsert 登录用户的 localStorage 数据到 user_kv_store
// body: { items: [{ key, value }, ...] }
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }

  let body: { items?: Array<{ key?: string; value?: unknown }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  // 过滤无效项
  const rows = items
    .filter((it): it is { key: string; value: unknown } =>
      typeof it?.key === 'string' && it.key.length > 0
    )
    .map((it) => ({
      user_id: userId,
      key: it.key,
      value: it.value as never,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const client = getSupabaseClient();
  const { error } = await client
    .from('user_kv_store')
    .upsert(rows, { onConflict: 'user_id,key' });

  if (error) {
    return NextResponse.json({ error: `同步失败: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}

// DELETE /api/user-data
// 登录用户主动删除某些 key（登出时清空 localStorage 不需要走这里）
// body: { keys: string[] }
export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }

  let body: { keys?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const keys = Array.isArray(body?.keys) ? body.keys.filter((k) => typeof k === 'string') : [];
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
    return NextResponse.json({ error: `删除失败: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: keys.length });
}
