import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

// Use 'legacy' as default user_id — matches the RLS policy exception:
//   (user_id = 'legacy' OR auth.uid()::text = user_id)
// This ensures data persists for the anonymous/single-user scenario.
const OKR_USER_ID = 'legacy';

export async function GET() {
  const client = getSupabaseClient();

  // Fetch only the current user's objectives with nested KRs and tasks
  const { data: objectives, error: oErr } = await client
    .from('okr_objectives')
    .select('*, okr_key_results(*, okr_tasks(*))')
    .eq('user_id', OKR_USER_ID)
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
        plannedYear: t.planned_year ?? undefined,
        plannedMonth: t.planned_month ?? undefined,
        plannedDay: t.planned_day ?? undefined,
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
        children: { id: string; title: string; done: boolean; plannedYear?: number; plannedMonth?: number; plannedDay?: number; createdAt?: string | number }[];
      }[];
    }[];
  };

  const client = getSupabaseClient();
  const errors: string[] = [];

  // Get existing IDs for diff (only for this user)
  const { data: existingO } = await client.from('okr_objectives').select('id').eq('user_id', OKR_USER_ID);
  const existingOIds = new Set<string>((existingO || []).map((o: Record<string, string>) => o.id));

  const { data: existingKR } = await client.from('okr_key_results').select('id, objective_id').eq('user_id', OKR_USER_ID);
  const existingKRIds = new Set<string>((existingKR || []).map((kr: Record<string, string>) => kr.id));

  // Get tasks for this user's KRs only
  const userKRRIds = (existingKR || []).map((kr: Record<string, string>) => kr.id);
  const existingTaskIds = new Set<string>();
  if (userKRRIds.length > 0) {
    const { data: existingTask } = await client.from('okr_tasks').select('id').in('key_result_id', userKRRIds);
    (existingTask || []).forEach((t: Record<string, string>) => existingTaskIds.add(t.id));
  }

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

  // Delete removed items (only for this user)
  const oToDelete = [...existingOIds].filter(id => !currentOIds.has(id));
  const krToDelete = [...existingKRIds].filter(id => !currentKRIds.has(id));
  const taskToDelete = [...existingTaskIds].filter(id => !currentTaskIds.has(id));

  if (taskToDelete.length > 0) {
    const { error: delErr } = await client.from('okr_tasks').delete().in('id', taskToDelete);
    if (delErr) errors.push(`Delete tasks: ${delErr.message}`);
  }
  if (krToDelete.length > 0) {
    const { error: delErr } = await client.from('okr_key_results').delete().in('id', krToDelete);
    if (delErr) errors.push(`Delete KRs: ${delErr.message}`);
  }
  if (oToDelete.length > 0) {
    const { error: delErr } = await client.from('okr_objectives').delete().in('id', oToDelete);
    if (delErr) errors.push(`Delete objectives: ${delErr.message}`);
  }

  // Upsert objectives, KRs, tasks — WITH user_id
  for (const o of objectives) {
    const { error: oErr } = await client
      .from('okr_objectives')
      .upsert({
        id: o.id,
        title: o.title,
        period: o.period,
        user_id: OKR_USER_ID,
        created_at: typeof o.createdAt === 'number' ? new Date(o.createdAt).toISOString() : (o.createdAt || new Date().toISOString()),
      }, { onConflict: 'id' });

    if (oErr) errors.push(`Upsert O[${o.id}]: ${oErr.message}`);

    for (const kr of o.children) {
      const { error: krErr } = await client
        .from('okr_key_results')
        .upsert({
          id: kr.id,
          objective_id: o.id,
          title: kr.title,
          target_value: kr.targetValue ?? 1,
          user_id: OKR_USER_ID,
          created_at: typeof kr.createdAt === 'number' ? new Date(kr.createdAt).toISOString() : (kr.createdAt || new Date().toISOString()),
        }, { onConflict: 'id' });

      if (krErr) errors.push(`Upsert KR[${kr.id}]: ${krErr.message}`);

      for (const t of kr.children) {
        const { error: tErr } = await client
          .from('okr_tasks')
          .upsert({
            id: t.id,
            key_result_id: kr.id,
            title: t.title,
            done: t.done ?? false,
            planned_year: t.plannedYear ?? null,
            planned_month: t.plannedMonth ?? null,
            planned_day: t.plannedDay ?? null,
            user_id: OKR_USER_ID,
            created_at: typeof t.createdAt === 'number' ? new Date(t.createdAt).toISOString() : (t.createdAt || new Date().toISOString()),
          }, { onConflict: 'id' });

        if (tErr) errors.push(`Upsert Task[${t.id}]: ${tErr.message}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('[OKR POST errors]', errors);
    return NextResponse.json({ success: false, errors }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
