import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const client = getSupabaseClient();

    // Build update payload — only include fields that were actually sent
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.industry !== undefined) updates.industry = body.industry?.trim() || body.name?.trim() || '';
    if (body.description !== undefined) updates.description = body.description;
    if (body.species !== undefined) updates.species = body.species;
    if (body.link !== undefined) updates.link = body.link?.trim() || null;
    if (body.position !== undefined) {
      updates.position_x = body.position?.x ?? null;
      updates.position_y = body.position?.y ?? null;
    }
    if (body.scale !== undefined) updates.scale = Math.round(body.scale * 100);
    if (body.nodes !== undefined) {
      updates.nodes = body.nodes;
      updates.node_count = body.nodes.length;
    }

    const { data, error } = await client
      .from('knowledge_trees')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });

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

    return NextResponse.json(tree);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    const detail = JSON.stringify({ msg, url: process.env.COZE_SUPABASE_URL ? 'set' : 'unset', stack: stack?.slice(0, 300) });
    // Write to stderr so it shows in dev.log
    console.error('[PUT /api/trees/[id]]', detail);
    try {
      require('fs').appendFileSync('/app/work/logs/bypass//dev.log', `[PUT-ERROR] ${detail}\n`);
    } catch {}
    return NextResponse.json({ error: msg, detail }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = getSupabaseClient();

  const { error } = await client.from('knowledge_trees').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}