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
const eventInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(500),
  startHour: z.number().int().min(0).max(23),
  startMin: z.number().int().min(0).max(59),
  endHour: z.number().int().min(0).max(23).optional(),
  endMin: z.number().int().min(0).max(59).optional(),
  color: z.string().max(50).optional(),
}).strict();

const postBodySchema = z.object({
  year: yearSchema,
  month: monthSchema,
  day: daySchema,
  events: z.array(eventInputSchema).max(500),
}).strict();

/**
 * POST /api/add-day-events
 * 批量添加日程事件(快捷接口)
 *
 * 关键安全:
 * - day_events 主键是 id(没有 user_id 复合),upsert(id) 可能跨用户劫持
 * - 改用 select-then-insert-or-update 模式:只更新当前用户拥有的 id
 * - 其他用户的 id 一律拒绝(用新生成的 id 重新插入)
 */
export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const parsed = await parseJsonBody(request, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;
  const { year, month, day, events } = parsed;

  if (events.length === 0) {
    return NextResponse.json({ success: true, count: 0 });
  }

  const client = getSupabaseClient();

  // 1) 收集所有传入的 id,查询哪些属于当前用户
  const incomingIds = events.map(e => e.id).filter((id): id is string => Boolean(id));
  let ownedIds = new Set<string>();
  if (incomingIds.length > 0) {
    const { data, error } = await client
      .from('day_events')
      .select('id')
      .eq('user_id', userId)
      .in('id', incomingIds);
    if (error) return apiError('查询事件失败', 500, error);
    ownedIds = new Set((data || []).map((r: { id: string }) => r.id));
  }

  // 2) 拆成 update / insert 两批
  const toUpdate: Array<{ id: string; fields: Record<string, unknown> }> = [];
  const toInsert: Array<Record<string, unknown>> = [];

  for (const e of events) {
    const baseFields = {
      year, month, day,
      title: e.title,
      start_hour: e.startHour,
      start_min: e.startMin,
      end_hour: e.endHour ?? null,
      end_min: e.endMin ?? null,
      color: e.color ?? null,
    };
    if (e.id && ownedIds.has(e.id)) {
      // 已存在且属于当前用户 → update
      toUpdate.push({ id: e.id, fields: baseFields });
    } else {
      // 1) 没传 id,或 2) id 属于其他用户 → 强制生成新 id 走 insert
      //    (防止跨用户劫持)
      const newId = crypto.randomUUID();
      toInsert.push({ id: newId, user_id: userId, ...baseFields, created_at: new Date().toISOString() });
    }
  }

  // 3) 批量 update(限定 user_id 防越权 double check)
  for (const u of toUpdate) {
    const { error } = await client
      .from('day_events')
      .update(u.fields)
      .eq('id', u.id)
      .eq('user_id', userId);
    if (error) return apiError('更新事件失败', 500, error);
  }

  // 4) 批量 insert
  if (toInsert.length > 0) {
    const { error } = await client.from('day_events').insert(toInsert);
    if (error) return apiError('插入事件失败', 500, error);
  }

  return NextResponse.json({ success: true, count: events.length, updated: toUpdate.length, inserted: toInsert.length });
}
