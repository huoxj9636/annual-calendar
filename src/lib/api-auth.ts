import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * API 鉴权共享工具
 *
 * 设计原则（账号系统 - 数据隔离）:
 * - 所有涉及"已迁库"表的 API 必须调用 requireUser() 验证身份
 * - 未登录 → 401 拒绝(防未授权写入)
 * - 已登录 → service_role + 强制 user_id 过滤(双保险:代码层 + RLS 层)
 * - 旧数据标 user_id='legacy',由第一个登录用户选择"接管"或"清空"
 *
 * 已迁库表清单(需要鉴权):
 *   calendar_overrides, calendar_notes, calendar_drawings,
 *   day_events, day_todos, daily_reviews, month_reviews,
 *   okr_objectives, okr_key_results, okr_tasks
 *   user_kv_store(已有 RLS,但 API 也用 requireUser 走统一流程)
 */

/** 保留的 "legacy" 用户 id - 给现有未登录产生的数据占位 */
export const LEGACY_USER_ID = 'legacy';

/** 从请求 header 的 x-session 字段获取 supabase access_token,返回 user_id */
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('x-session');
  if (!token) {
    return null;
  }
  try {
    const client = getSupabaseClient(token);
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return null;
    }
    return data.user.id;
  } catch {
    return null;
  }
}

/**
 * API 鉴权中间件 - 未登录返回 401
 * 用法: const userIdOrResp = await requireUser(request); if (userIdOrResp instanceof NextResponse) return userIdOrResp;
 *       const userId = userIdOrResp;
 */
export async function requireUser(req: NextRequest): Promise<string | NextResponse> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }
  return userId;
}

/**
 * API 鉴权中间件 - 允许 legacy 数据访问(给"旧数据迁移"接口专用)
 * 用法: const userIdOrResp = await requireUserOrLegacy(request); ...
 */
export async function requireUserOrLegacy(req: NextRequest): Promise<string | NextResponse> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }
  return userId;
}

/** 检测某行是否属于当前用户(或当前用户是 legacy 接管者) */
export function isOwnerOrLegacy(rowUserId: string | null | undefined, currentUserId: string): boolean {
  if (!rowUserId) return false; // NULL 数据视为"无主",不返回
  if (rowUserId === currentUserId) return true;
  return false;
}
