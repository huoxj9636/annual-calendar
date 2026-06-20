/**
 * 接管或清空 legacy 数据
 * POST: { action: 'claim' | 'clear' }
 *  - claim: 把 user_id = 'legacy' 的所有数据改为当前用户
 *  - clear: 删除 user_id = 'legacy' 的所有数据
 *
 * 适用场景:生产环境升级账号系统后, 旧访客数据已标为 'legacy',
 * 第一个登录的用户可以选择接管(把数据归到自己名下)或清空(从零开始)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getUserIdFromRequest, requireUser } from '@/lib/api-auth';

const LEGACY_TABLES = [
  'calendar_overrides',
  'calendar_notes',
  'calendar_drawings',
  'day_events',
  'day_todos',
  'daily_reviews',
  'month_reviews',
  'okr_objectives',
  'okr_key_results',
  'okr_tasks',
] as const;

export async function GET(request: NextRequest) {
  // 统计 legacy 数据条数
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;

  const supabase = getSupabaseClient();
  let total = 0;
  const byTable: Record<string, number> = {};

  for (const table of LEGACY_TABLES) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', 'legacy');
    const c = count || 0;
    byTable[table] = c;
    total += c;
  }

  return NextResponse.json({ total, byTable });
}

export async function POST(request: NextRequest) {
  const userIdOrResp = await requireUser(request);
  if (userIdOrResp instanceof NextResponse) return userIdOrResp;
  const userId = userIdOrResp;

  const body = await request.json();
  const action = body?.action as 'claim' | 'clear' | undefined;
  if (action !== 'claim' && action !== 'clear') {
    return NextResponse.json({ error: 'action 必须是 claim 或 clear' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const result: Record<string, number> = {};

  for (const table of LEGACY_TABLES) {
    if (action === 'claim') {
      // 把 legacy 改为当前用户
      const { data, error } = await supabase
        .from(table)
        .update({ user_id: userId })
        .eq('user_id', 'legacy')
        .select('id');
      if (error) {
        return NextResponse.json({ error: `${table} 接管失败: ${error.message}` }, { status: 500 });
      }
      result[table] = data?.length || 0;
    } else {
      // 删除 legacy
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', 'legacy')
        .select('id');
      if (error) {
        return NextResponse.json({ error: `${table} 清空失败: ${error.message}` }, { status: 500 });
      }
      result[table] = data?.length || 0;
    }
  }

  return NextResponse.json({ success: true, action, total: Object.values(result).reduce((a, b) => a + b, 0), byTable: result });
}
