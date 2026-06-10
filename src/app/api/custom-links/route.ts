import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('custom_links')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  const body = await req.json();
  const { id, title, url, sort_order } = body;
  if (!title || !url) return NextResponse.json({ error: 'title and url required' }, { status: 400 });

  const linkId = id || `link_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase
    .from('custom_links')
    .upsert({ id: linkId, title, url, sort_order: sort_order ?? 0 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: linkId });
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseClient();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabase.from('custom_links').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
