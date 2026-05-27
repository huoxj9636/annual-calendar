import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const client = getSupabaseClient();

  // Fetch all objectives with nested KRs and tasks
  const { data: objectives, error: oErr } = await client
    .from('okr_objectives')
    .select('*, okr_key_results(*, okr_tasks(*))')
    .order('created_at', { ascending: true });

  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  // Transform to match existing localStorage structure
  const result = (objectives || []).map((o: Record<string, unknown>) => ({
    id: o.id,
    title: o.title,
    period: o.period,
    children: ((o.okr_key_results as Record<string, unknown>[]) || []).map((kr: Record<string, unknown>) => ({
      id: kr.id,
      title: kr.title,
      targetValue: kr.target_value ?? 1,
      children: ((kr.okr_tasks as Record<string, unknown>[]) || []).map((t: Record<string, unknown>) => ({
        id: t.id,
        title: t.title,
        done: t.done ?? false,
      })),
      createdAt: kr.created_at,
    })),
    createdAt: o.created_at,
  }));

  return NextResponse.json({ objectives: result });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { objectives } = body as {
    objectives: {
      id: string; title: string; period: string; createdAt?: string | number;
      children: {
        id: string; title: string; targetValue: number; createdAt?: string | number;
        children: { id: string; title: string; done: boolean; createdAt?: string | number }[];
      }[];
    }[];
  };

  const client = getSupabaseClient();

  // Get existing IDs for diff
  const { data: existingO } = await client.from('okr_objectives').select('id');
  const existingOIds = new Set<string>((existingO || []).map((o: Record<string, string>) => o.id));

  const { data: existingKR } = await client.from('okr_key_results').select('id');
  const existingKRIds = new Set<string>((existingKR || []).map((kr: Record<string, string>) => kr.id));

  const { data: existingTask } = await client.from('okr_tasks').select('id');
  const existingTaskIds = new Set<string>((existingTask || []).map((t: Record<string, string>) => t.id));

  const currentOIds = new Set<string>();
  const currentKRIds = new Set<string>();
  const currentTaskIds = new Set<string>();

  for (const o of objectives) {
    currentOIds.add(o.id);
    for (const kr of o.children) {
      currentKRIds.add(kr.id);
      for (const t of kr.children) {
        currentTaskIds.add(t.id);
      }
    }
  }

  // Delete removed items
  const oToDelete = [...existingOIds].filter(id => !currentOIds.has(id));
  const krToDelete = [...existingKRIds].filter(id => !currentKRIds.has(id));
  const taskToDelete = [...existingTaskIds].filter(id => !currentTaskIds.has(id));

  if (taskToDelete.length > 0) {
    await client.from('okr_tasks').delete().in('id', taskToDelete);
  }
  if (krToDelete.length > 0) {
    await client.from('okr_key_results').delete().in('id', krToDelete);
  }
  if (oToDelete.length > 0) {
    await client.from('okr_objectives').delete().in('id', oToDelete);
  }

  // Upsert objectives, KRs, tasks
  for (const o of objectives) {
    const { error: oErr } = await client
      .from('okr_objectives')
      .upsert({
        id: o.id,
        title: o.title,
        period: o.period,
        created_at: typeof o.createdAt === 'number' ? new Date(o.createdAt).toISOString() : (o.createdAt || new Date().toISOString()),
      }, { onConflict: 'id' });

    if (oErr) console.error('[OKR upsert O]', oErr.message);

    for (const kr of o.children) {
      const { error: krErr } = await client
        .from('okr_key_results')
        .upsert({
          id: kr.id,
          objective_id: o.id,
          title: kr.title,
          target_value: kr.targetValue ?? 1,
          created_at: typeof kr.createdAt === 'number' ? new Date(kr.createdAt).toISOString() : (kr.createdAt || new Date().toISOString()),
        }, { onConflict: 'id' });

      if (krErr) console.error('[OKR upsert KR]', krErr.message);

      for (const t of kr.children) {
        const { error: tErr } = await client
          .from('okr_tasks')
          .upsert({
            id: t.id,
            key_result_id: kr.id,
            title: t.title,
            done: t.done ?? false,
            created_at: typeof t.createdAt === 'number' ? new Date(t.createdAt).toISOString() : (t.createdAt || new Date().toISOString()),
          }, { onConflict: 'id' });

        if (tErr) console.error('[OKR upsert Task]', tErr.message);
      }
    }
  }

  return NextResponse.json({ success: true });
}
