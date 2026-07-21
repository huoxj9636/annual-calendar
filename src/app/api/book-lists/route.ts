import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET /api/book-lists — 获取所有书单（含每本书的数量） */
export async function GET() {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('book_lists')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 查询每个书单的书籍数量
  const lists = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at as string).getTime(),
  }));

  // 批量查书籍数量
  const { data: allBooks } = await client
    .from('books')
    .select('id, book_list_id');

  const countMap: Record<string, number> = {};
  (allBooks || []).forEach((b: Record<string, unknown>) => {
    const lid = b.book_list_id as string;
    countMap[lid] = (countMap[lid] || 0) + 1;
  });

  return NextResponse.json(
    lists.map((l) => ({ ...l, bookCount: countMap[l.id as string] || 0 }))
  );
}

/** POST /api/book-lists — 创建书单 */
export async function POST(req: NextRequest) {
  const client = getSupabaseClient();
  const body = await req.json();
  const { name } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '书单名称不能为空' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from('book_lists')
    .insert({ name: name.trim(), created_at: now })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { id: data.id, name: data.name, createdAt: new Date(data.created_at).getTime(), bookCount: 0 },
    { status: 201 }
  );
}

/** PUT /api/book-lists — 更新书单名称 */
export async function PUT(req: NextRequest) {
  const client = getSupabaseClient();
  const body = await req.json();
  const { id, name } = body;

  if (!id || !name?.trim()) {
    return NextResponse.json({ error: '缺少 id 或 name' }, { status: 400 });
  }

  const { data, error } = await client
    .from('book_lists')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id, name: data.name });
}

/** DELETE /api/book-lists — 删除书单（级联删除关联书籍） */
export async function DELETE(req: NextRequest) {
  const client = getSupabaseClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 });
  }

  // 先删关联书籍
  await client.from('books').delete().eq('book_list_id', id);
  // 再删书单
  const { error } = await client.from('book_lists').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
