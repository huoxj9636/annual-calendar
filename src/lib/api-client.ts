/**
 * 统一 API 请求 helper
 *
 * 关键功能：
 * 1. 自动从 supabase session 获取 access_token 并写入 'x-session' header
 * 2. 未登录用户**跳过请求**直接返回 null（避免 401 报错刷屏）
 * 3. 401 时**静默失败**返回 null（避免打断用户操作）
 * 4. 自动处理 JSON Content-Type 和 JSON 解析
 *
 * 用法：
 *   const data = await apiFetch('/api/calendar-data?type=overrides&year=2025');
 *   await apiFetch('/api/day-data', { method: 'POST', body: { type: 'events', ... } });
 *
 * 重要：所有需要鉴权的 API（/api/calendar-data, /api/day-data, /api/okr, /api/daily-review, /api/month-stats）
 * 都必须用这个 helper，否则已登录用户会因为缺 x-session 而 401 失败。
 */
import { getSessionToken } from './supabase-browser';

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** 当返回 401 时是否仍然 resolve（默认 true - 静默失败） */
  silentOn401?: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetch<T = any>(
  url: string,
  options: ApiFetchOptions = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const { body, headers, silentOn401 = true, ...rest } = options;

  // 未登录时直接跳过（避免 401 刷屏）
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const finalHeaders: Record<string, string> = {
    'x-session': token,
    ...(headers as Record<string, string> | undefined),
  };

  let finalBody: BodyInit | undefined;
  if (body !== undefined) {
    if (typeof body === 'string') {
      finalBody = body;
    } else {
      finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
      finalBody = JSON.stringify(body);
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: finalBody,
    });
  } catch {
    return null;
  }

  // 401 静默失败
  if (res.status === 401 && silentOn401) {
    return null;
  }

  if (!res.ok) {
    let errBody: unknown = null;
    try {
      errBody = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, errBody, `API ${res.status} ${res.statusText}: ${url}`);
  }

  // 204 / empty
  if (res.status === 204) return null;

  // 尝试解析 JSON
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * fire-and-forget 版本: 不抛出异常, 不等待结果
 * 适用于自动保存 / 同步等场景
 */
export function apiFire(url: string, options: ApiFetchOptions = {}): void {
  apiFetch(url, options).catch(() => {
    // 静默吞错
  });
}
