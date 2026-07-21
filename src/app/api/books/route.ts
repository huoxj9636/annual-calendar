import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET /api/books?list_id=xxx — 获取书籍列表 */
export async function GET(req: NextRequest) {
  const client = getSupabaseClient();
  const { searchParams } = new URL(req.url);
  const listId = searchParams.get('list_id');

  let query = client.from('books').select('*').order('created_at', { ascending: false });

  if (listId) {
    query = query.eq('book_list_id', listId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const books = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    title: row.title,
    author: row.author || '',
    coverUrl: row.cover_url || '',
    wereadUrl: row.weread_url || '',
    status: row.status as 'want' | 'reading' | 'done',
    bookListId: row.book_list_id,
    createdAt: new Date(row.created_at as string).getTime(),
  }));

  return NextResponse.json(books);
}

/** POST /api/books — 添加书籍 */
export async function POST(req: NextRequest) {
  const client = getSupabaseClient();
  const body = await req.json();
  const { title, author, coverUrl, wereadUrl, status, bookListId } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: '书名不能为空' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from('books')
    .insert({
      title: title.trim(),
      author: author?.trim() || '',
      cover_url: coverUrl?.trim() || '',
      weread_url: wereadUrl?.trim() || '',
      status: status || 'want',
      book_list_id: bookListId || null,
      created_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      id: data.id,
      title: data.title,
      author: data.author || '',
      coverUrl: data.cover_url || '',
      wereadUrl: data.weread_url || '',
      status: data.status,
      bookListId: data.book_list_id,
      createdAt: new Date(data.created_at).getTime(),
    },
    { status: 201 }
  );
}

/** PUT /api/books — 更新书籍信息 */
export async function PUT(req: NextRequest) {
  const client = getSupabaseClient();
  const body = await req.json();
  const { id, ...fields } = body;

  if (!id) {
    return NextResponse.json({ error: '缺少书籍 id' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (fields.title !== undefined) updates.title = fields.title.trim();
  if (fields.author !== undefined) updates.author = fields.author.trim();
  if (fields.coverUrl !== undefined) updates.cover_url = fields.coverUrl.trim();
  if (fields.wereadUrl !== undefined) updates.weread_url = fields.wereadUrl.trim();
  if (fields.status !== undefined) updates.status = fields.status;
  if (fields.bookListId !== undefined) updates.book_list_id = fields.bookListId;

  const { data, error } = await client
    .from('books')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: data.id,
    title: data.title,
    author: data.author || '',
    coverUrl: data.cover_url || '',
    wereadUrl: data.weread_url || '',
    status: data.status,
    bookListId: data.book_list_id,
    createdAt: new Date(data.created_at).getTime(),
  });
}

/** DELETE /api/books — 删除书籍 */
export async function DELETE(req: NextRequest) {
  const client = getSupabaseClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少书籍 id' }, { status: 400 });
  }

  const { error } = await client.from('books').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
