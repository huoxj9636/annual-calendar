import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('knowledge_trees')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Transform DB rows → frontend KnowledgeTree shape
  const trees = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    industry: row.industry || '',
    description: row.description || '',
    species: row.species || 'oak',
    nodes: (row.nodes as unknown[]) || [],
    createdAt: new Date(row.created_at as string).getTime(),
    ...(row.position_x != null ? { position: { x: row.position_x, y: row.position_y ?? 50 } } : {}),
    scale: ((row.scale as number) ?? 100) / 100,
    ...(row.link ? { link: row.link as string } : {}),
  }));

  return NextResponse.json(trees);
}

export async function POST(req: NextRequest) {
  const client = getSupabaseClient();

  const body = await req.json();
  const { name, industry, description, species, link, nodes, position, nodeCount } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '名称不能为空' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data, error } = await client
    .from('knowledge_trees')
    .insert({
      name: name.trim(),
      industry: industry?.trim() || name.trim(),
      description: description || '',
      species: species || 'oak',
      link: link?.trim() || null,
      position_x: position?.x ?? null,
      position_y: position?.y ?? null,
      scale: body.scale ? Math.round(body.scale * 100) : 100,
      nodes: nodes || [],
      node_count: nodeCount ?? (nodes?.length || 0),
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tree = {
    id: data.id,
    name: data.name,
    industry: data.industry || '',
    description: data.description || '',
    species: data.species || 'oak',
    nodes: (data.nodes as unknown[]) || [],
    createdAt: new Date(data.created_at as string).getTime(),
    ...(data.position_x != null ? { position: { x: data.position_x, y: data.position_y ?? 50 } } : {}),
    scale: (data.scale ?? 100) / 100,
    ...(data.link ? { link: data.link as string } : {}),
  };

  return NextResponse.json(tree, { status: 201 });
}