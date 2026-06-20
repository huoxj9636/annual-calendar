import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  requireUser,
  parseJsonBody,
  apiError,
  yearSchema,
  monthSchema,
  daySchema,
} from '@/lib/api-auth';

// ─── Zod schemas ───
const okrTaskSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  done: z.boolean(),
  plannedYear: yearSchema.optional(),
  plannedMonth: monthSchema.optional(),
  plannedDay: daySchema.optional(),
  createdAt: z.union([z.string().max(50), z.number()]).optional(),
}).strict();

const okrKeyResultSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  targetValue: z.number().min(0).max(999999),
  children: z.array(okrTaskSchema).max(200),
  createdAt: z.union([z.string().max(50), z.number()]).optional(),
}).strict();

const okrObjectiveSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  period: z.string().max(50),
  children: z.array(okrKeyResultSchema).max(100),
  createdAt: z.union([z.string().max(50), z.number()]).optional(),
}).strict();

const postBodySchema = z.object({
  objectives: z.array(okrObjectiveSchema).max(200),
}).strict();

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const client = getSupabaseClient();

  const { data: objectives, error: oErr } = await client
    .from('okr_objectives')
    .select('*, okr_key_results(*, okr_tasks(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (oErr) return apiError('加载 OKR 失败', 500, oErr);

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
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsed = await parseJsonBody(request, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;
  const { objectives } = parsed;

  const client = getSupabaseClient();

  // 收集所有客户端传来的 id
  const incomingOIds = new Set<string>();
  const incomingKRIds = new Set<string>();
  const incomingTaskIds = new Set<string>();
  for (const o of objectives) {
    incomingOIds.add(o.id);
    for (const kr of o.children) {
      incomingKRIds.add(kr.id);
      for (const t of kr.children) {
        incomingTaskIds.add(t.id);
      }
    }
  }

  // 关键安全检查: 所有 id 必须经过校验
  // - 存在的 id 必须属于当前用户 (不能越权修改别人的数据)
  // - 不存在的 id 才能作为新建
  const idArr = [...incomingOIds];
  const { data: ownedO } = await client
    .from('okr_objectives')
    .select('id, user_id')
    .in('id', idArr);
  const ownedOById = new Map<string, string>(((ownedO || []) as Array<{ id: string; user_id: string }>).map((o) => [o.id, o.user_id]));
  for (const id of incomingOIds) {
    if (ownedOById.has(id) && ownedOById.get(id) !== userId) {
      return apiError('权限拒绝:Objective 属于其他用户', 403);
    }
  }

  const krIdArr = [...incomingKRIds];
  const { data: ownedKR } = await client
    .from('okr_key_results')
    .select('id, okr_objectives!inner(user_id)')
    .in('id', krIdArr);
  const ownedKRById = new Map<string, string>(((ownedKR || []) as unknown as Array<{ id: string; okr_objectives: { user_id: string } }>).map((kr) => [kr.id, kr.okr_objectives.user_id]));
  for (const id of incomingKRIds) {
    if (ownedKRById.has(id) && ownedKRById.get(id) !== userId) {
      return apiError('权限拒绝:KeyResult 属于其他用户', 403);
    }
  }

  const taskIdArr = [...incomingTaskIds];
  const { data: ownedTask } = await client
    .from('okr_tasks')
    .select('id, okr_key_results!inner(okr_objectives!inner(user_id))')
    .in('id', taskIdArr);
  const ownedTaskById = new Map<string, string>(((ownedTask || []) as unknown as Array<{ id: string; okr_key_results: { okr_objectives: { user_id: string } } }>).map((t) => [t.id, t.okr_key_results.okr_objectives.user_id]));
  for (const id of incomingTaskIds) {
    if (ownedTaskById.has(id) && ownedTaskById.get(id) !== userId) {
      return apiError('权限拒绝:Task 属于其他用户', 403);
    }
  }

  // Get existing IDs for current user only (用于计算待删除)
  const { data: existingO } = await client.from('okr_objectives').select('id').eq('user_id', userId);
  const existingOIds = new Set<string>((existingO || []).map((o: Record<string, string>) => o.id));

  const { data: existingKR } = await client.from('okr_key_results').select('id, okr_objectives!inner(user_id)').eq('okr_objectives.user_id', userId);
  const existingKRIds = new Set<string>(((existingKR || []) as unknown as Array<{ id: string }>).map((kr) => kr.id));

  const { data: existingTask } = await client.from('okr_tasks').select('id, okr_key_results!inner(okr_objectives!inner(user_id))').eq('okr_key_results.okr_objectives.user_id', userId);
  const existingTaskIds = new Set<string>(((existingTask || []) as unknown as Array<{ id: string }>).map((t) => t.id));

  const taskToDelete = [...existingTaskIds].filter(id => !incomingTaskIds.has(id));
  const krToDelete = [...existingKRIds].filter(id => !incomingKRIds.has(id));
  const oToDelete = [...existingOIds].filter(id => !incomingOIds.has(id));

  // 关键安全: delete 必须带 user_id 过滤(double check 防越权)
  if (taskToDelete.length > 0) {
    const { error } = await client.from('okr_tasks').delete().in('id', taskToDelete).eq('user_id', userId);
    if (error) return apiError('删除 Task 失败', 500, error);
  }
  if (krToDelete.length > 0) {
    const { error } = await client.from('okr_key_results').delete().in('id', krToDelete).eq('user_id', userId);
    if (error) return apiError('删除 KeyResult 失败', 500, error);
  }
  if (oToDelete.length > 0) {
    const { error } = await client.from('okr_objectives').delete().in('id', oToDelete).eq('user_id', userId);
    if (error) return apiError('删除 Objective 失败', 500, error);
  }

  for (const o of objectives) {
    const { error: oErr } = await client
      .from('okr_objectives')
      .upsert({
        user_id: userId,
        id: o.id,
        title: o.title,
        period: o.period,
        created_at: typeof o.createdAt === 'number' ? new Date(o.createdAt).toISOString() : (o.createdAt || new Date().toISOString()),
      }, { onConflict: 'id' });

    if (oErr) return apiError('保存 Objective 失败', 500, oErr);

    for (const kr of o.children) {
      const { error: krErr } = await client
        .from('okr_key_results')
        .upsert({
          user_id: userId,
          id: kr.id,
          objective_id: o.id,
          title: kr.title,
          target_value: kr.targetValue ?? 1,
          created_at: typeof kr.createdAt === 'number' ? new Date(kr.createdAt).toISOString() : (kr.createdAt || new Date().toISOString()),
        }, { onConflict: 'id' });

      if (krErr) return apiError('保存 KeyResult 失败', 500, krErr);

      for (const t of kr.children) {
        const { error: tErr } = await client
          .from('okr_tasks')
          .upsert({
            user_id: userId,
            id: t.id,
            key_result_id: kr.id,
            title: t.title,
            done: t.done ?? false,
            planned_year: t.plannedYear ?? null,
            planned_month: t.plannedMonth ?? null,
            planned_day: t.plannedDay ?? null,
            created_at: typeof t.createdAt === 'number' ? new Date(t.createdAt).toISOString() : (t.createdAt || new Date().toISOString()),
          }, { onConflict: 'id' });

        if (tErr) return apiError('保存 Task 失败', 500, tErr);
      }
    }
  }

  return NextResponse.json({ success: true });
}
