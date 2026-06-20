import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser, parseJsonBody, apiError } from '@/lib/api-auth';
import { z } from 'zod';

// 真实 schema:
// okr_objectives(id, title, period, created_at, user_id)
// okr_key_results(id, objective_id, title, target_value, progress, user_id)
// okr_tasks(id, key_result_id, objective_id, title, done, status, planned_year/month/day, user_id)

// 命名空间化 id(因表 PK 是单列 id,必须用 userId 前缀避免不同用户 id 冲突)
function namespacedId(userId: string, kind: 'obj' | 'kr' | 't', origId: string): string {
  const u8 = userId.replace(/-/g, '').slice(0, 8);
  return `${u8}_${kind}_${origId}`;
}
function unNamespacedId(namespaced: string): string {
  // 8位hex_kind_origId  ->  origId
  const m = namespaced.match(/^[a-f0-9]{8}_(?:obj|kr|t)_(.+)$/);
  return m ? m[1] : namespaced;
}

const postBodySchema = z.object({
  // 整树同步: { objectives: [...] } 或 { goals: [...] }
  objectives: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().max(500).optional(),
    period: z.string().max(50).optional(),
    createdAt: z.union([z.number(), z.string()]).optional(),
    children: z.array(z.object({
      id: z.string().min(1).max(100),
      title: z.string().max(500).optional(),
      progress: z.number().min(0).max(1).optional(),
      target_value: z.number().optional(),
      tasks: z.array(z.object({
        id: z.string().min(1).max(100),
        title: z.string().max(500).optional(),
        done: z.boolean().optional(),
        status: z.string().max(50).optional(),
      }).passthrough()).optional(),
    }).passthrough()).optional(),
  }).passthrough()).optional(),
  // 兼容前端: goals 字段
  goals: z.array(z.unknown()).optional(),
  // 兼容老 action 模式
  action: z.string().max(50).optional(),
  ids: z.object({
    objectives: z.array(z.string()).optional(),
    keyResults: z.array(z.string()).optional(),
    tasks: z.array(z.string()).optional(),
  }).optional(),
}).passthrough();

function createdAtToIso(v: unknown): string {
  if (typeof v === 'number') return new Date(v).toISOString();
  if (typeof v === 'string') return v;
  return new Date().toISOString();
}

export async function GET(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const client = getSupabaseClient();
  try {
    const { data: objectives, error: objErr } = await client
      .from('okr_objectives')
      .select('*')
      .eq('user_id', userId);
    if (objErr) {
      console.error('[okr] objectives select error:', objErr);
      return apiError('查询失败', 500);
    }
    if (!objectives || objectives.length === 0) {
      return NextResponse.json({ objectives: [], goals: [] });
    }

    const objIds = objectives.map(o => o.id);
    const [{ data: krs, error: krErr }, { data: tasks, error: taskErr }] = await Promise.all([
      client.from('okr_key_results').select('*').eq('user_id', userId).in('objective_id', objIds),
      client.from('okr_tasks').select('*').eq('user_id', userId).in('objective_id', objIds),
    ]);

    if (krErr) {
      console.error('[okr] key_results select error:', krErr);
      return apiError('查询失败', 500);
    }
    if (taskErr) {
      console.error('[okr] tasks select error:', taskErr);
      return apiError('查询失败', 500);
    }

    const tree = objectives.map(o => ({
      id: unNamespacedId(o.id),
      title: o.title,
      period: o.period,
      createdAt: o.created_at,
      children: (krs || [])
        .filter(kr => kr.objective_id === o.id)
        .map(kr => {
          const krTasks = (tasks || []).filter(t => t.key_result_id === kr.id);
          return {
            id: unNamespacedId(kr.id),
            title: kr.title,
            progress: typeof kr.progress === 'number' ? kr.progress : 0,
            target_value: kr.target_value,
            tasks: krTasks.map(t => ({
              id: unNamespacedId(t.id),
              title: t.title,
              status: t.status || (t.done ? 'done' : 'pending'),
              done: t.done,
              planned_year: t.planned_year,
              planned_month: t.planned_month,
              planned_day: t.planned_day,
            })),
          };
        }),
    }));
    return NextResponse.json({ objectives: tree, goals: tree });
  } catch (e) {
    console.error('[okr] GET exception:', e);
    return apiError('服务器内部错误', 500);
  }
}

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsedBody = await parseJsonBody(request, postBodySchema);
  if (parsedBody instanceof NextResponse) return parsedBody;
  const body = parsedBody as {
    objectives?: Array<Record<string, unknown>>;
    goals?: unknown[];
    action?: string;
    ids?: { objectives?: string[]; keyResults?: string[]; tasks?: string[] };
  };

  const client = getSupabaseClient();

  try {
    // delete 分支
    if (body.action === 'delete') {
      const ids = body.ids || {};
      const tasksAll = await client.from('okr_tasks').select('id').eq('user_id', userId);
      const krAll = await client.from('okr_key_results').select('id').eq('user_id', userId);
      const objAll = await client.from('okr_objectives').select('id').eq('user_id', userId);
      if (ids.tasks && ids.tasks.length > 0) {
        const taskIds = ids.tasks.map(id => namespacedId(userId, 't', id));
        await client.from('okr_tasks').delete().eq('user_id', userId).in('id', taskIds);
      }
      if (ids.keyResults && ids.keyResults.length > 0) {
        const krIds = ids.keyResults.map(id => namespacedId(userId, 'kr', id));
        await client.from('okr_tasks').delete().eq('user_id', userId).in('key_result_id', krIds);
        await client.from('okr_key_results').delete().eq('user_id', userId).in('id', krIds);
      }
      if (ids.objectives && ids.objectives.length > 0) {
        const objIds = ids.objectives.map(id => namespacedId(userId, 'obj', id));
        await client.from('okr_tasks').delete().eq('user_id', userId).in('objective_id', objIds);
        await client.from('okr_key_results').delete().eq('user_id', userId).in('objective_id', objIds);
        await client.from('okr_objectives').delete().eq('user_id', userId).in('id', objIds);
      }
      return NextResponse.json({ success: true });
    }

    // 整树同步: 取 objectives 或 goals
    const objectives = body.objectives || (Array.isArray(body.goals) ? (body.goals as Array<Record<string, unknown>>) : null);
    if (!objectives) {
      return apiError('缺少 objectives', 400);
    }

    // 全删全插(简化,适合中小量 OKR)
    await client.from('okr_tasks').delete().eq('user_id', userId);
    await client.from('okr_key_results').delete().eq('user_id', userId);
    await client.from('okr_objectives').delete().eq('user_id', userId);

    let objCount = 0, krCount = 0, taskCount = 0;
    for (const o of objectives) {
      const objOrigId = String(o.id || '').slice(0, 100);
      if (!objOrigId) continue;
      const objId = namespacedId(userId, 'obj', objOrigId);
      const { error: objErr } = await client.from('okr_objectives').insert({
        id: objId,
        user_id: userId,
        title: String(o.title || '').slice(0, 500),
        period: String(o.period || '').slice(0, 50),
        created_at: createdAtToIso(o.createdAt),
      });
      if (objErr) {
        console.error('[okr] objective insert error:', objErr);
        continue;
      }
      objCount++;
      const children = Array.isArray(o.children) ? (o.children as Array<Record<string, unknown>>) : [];
      for (const kr of children) {
        const krOrigId = String(kr.id || '').slice(0, 100);
        if (!krOrigId) continue;
        const krId = namespacedId(userId, 'kr', krOrigId);
        const { error: krErr } = await client.from('okr_key_results').insert({
          id: krId,
          user_id: userId,
          objective_id: objId,
          title: String(kr.title || '').slice(0, 500),
          target_value: typeof kr.target_value === 'number' ? kr.target_value : null,
          progress: typeof kr.progress === 'number' ? kr.progress : 0,
        });
        if (krErr) {
          console.error('[okr] key_result insert error:', krErr);
          continue;
        }
        krCount++;
        const tasks = Array.isArray(kr.tasks) ? (kr.tasks as Array<Record<string, unknown>>) : [];
        for (const t of tasks) {
          const tOrigId = String(t.id || '').slice(0, 100);
          if (!tOrigId) continue;
          const tId = namespacedId(userId, 't', tOrigId);
          const { error: tErr } = await client.from('okr_tasks').insert({
            id: tId,
            user_id: userId,
            objective_id: objId,
            key_result_id: krId,
            title: String(t.title || '').slice(0, 500),
            done: !!t.done,
            status: String(t.status || (t.done ? 'done' : 'pending')).slice(0, 50),
          });
          if (tErr) {
            console.error('[okr] task insert error:', tErr);
            continue;
          }
          taskCount++;
        }
      }
    }
    return NextResponse.json({ success: true, objectives: objCount, keyResults: krCount, tasks: taskCount });
  } catch (e) {
    console.error('[okr] POST exception:', e);
    return apiError('服务器内部错误', 500);
  }
}
