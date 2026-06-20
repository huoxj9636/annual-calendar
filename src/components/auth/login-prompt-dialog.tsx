'use client';

import { useEffect, useState, useCallback, FormEvent, MouseEvent } from 'react';
import { Lock, X, Loader2, CheckCircle2 } from 'lucide-react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import {
  flushPendingWrites,
  clearPendingWrites,
  getPendingWritesCount,
  setInterceptorAuthStatus,
  registerRequireLoginHandler,
} from '@/lib/auth-interceptor';

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export function LoginPromptDialog() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // 监听拦截器:未登录时操作需要保存数据的功能 → 弹窗
  useEffect(() => {
    const unregister = registerRequireLoginHandler(() => {
      setPendingCount(getPendingWritesCount());
      setOpen(true);
      setError(null);
    });
    return unregister;
  }, []);

  // 监听 user-menu 主动唤起("open-login-dialog" 事件)
  useEffect(() => {
    const handler = () => {
      setPendingCount(0); // 主动登录,无待补写
      setOpen(true);
      setError(null);
    };
    window.addEventListener('open-login-dialog', handler);
    return () => window.removeEventListener('open-login-dialog', handler);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setPhone('');
    setPassword('');
  }, []);

  const handleCancel = useCallback(() => {
    clearPendingWrites();
    close();
  }, [close]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const cleanPhone = phone.replace(/\s/g, '');
    if (!PHONE_REGEX.test(cleanPhone)) {
      setError('请输入正确的 11 位手机号');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      // 内部邮箱(supabase 邮箱密码模式):把手机号映射为虚拟邮箱
      const email = `${cleanPhone}@calendar.local`;

      // 一体化登录/注册:先尝试登录 → 失败则注册 → 注册后自动登录
      let res = await supabase.auth.signInWithPassword({ email, password });

      if (res.error) {
        // 登录失败 → 尝试注册(用户不存在则注册,用户已存在则提示密码错)
        const signUpRes = await supabase.auth.signUp({
          email,
          password,
          options: { data: { phone: cleanPhone } },
        });
        if (signUpRes.error) {
          // 注册失败:说明用户已存在 → 密码错
          setError('密码错误,请重新输入');
          setBusy(false);
          return;
        }
        // 注册成功 → 自动登录
        res = await supabase.auth.signInWithPassword({ email, password });
        if (res.error) {
          setError(translateError(res.error.message));
          setBusy(false);
          return;
        }
      }

      // 登录成功
      // 1. 打开拦截器
      setInterceptorAuthStatus(true);
      // 2. 补写所有被拦截的操作(写入 localStorage,SyncProvider 会自动同步上云)
      const flushed = flushPendingWrites();
      // 3. 关闭弹窗
      close();
      // 4. 通知 SyncProvider 重新触发首次同步(由 user-context 的 auth listener 处理)
      console.info('[LoginPromptDialog] 登录成功,补写', flushed, '项操作');
    } catch (err) {
      console.error('[LoginPromptDialog]', err);
      setError(err instanceof Error ? err.message : '登录失败,请重试');
    } finally {
      setBusy(false);
    }
  }, [busy, phone, password, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in-0"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">登录后可保存数据</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pendingCount > 0
                  ? `您有 ${pendingCount} 项操作待保存`
                  : '数据将自动同步到云端,跨设备共享'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {pendingCount > 0 && (
          <div className="mb-4 rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/80">
              登录后您的操作将自动完成,无需重新操作。
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="prompt-phone" className="text-xs text-foreground/80 block mb-1.5">
              手机号
            </label>
            <input
              id="prompt-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
              maxLength={11}
              autoFocus
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="prompt-password" className="text-xs text-foreground/80 block mb-1.5">
              密码
            </label>
            <input
              id="prompt-password"
              type="password"
              autoComplete="current-password"
              placeholder="6 位以上密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              首次输入将自动注册账号
            </p>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="flex-1 h-9 rounded-md border border-input bg-background hover:bg-muted text-sm font-medium transition-colors disabled:opacity-50"
            >
              稍后再说
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 h-9 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium transition-opacity disabled:opacity-50 flex items-center justify-center"
            >
              {busy ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  登录中…
                </>
              ) : (
                '登录 / 注册'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  if (/invalid login credentials|invalid credentials/i.test(msg)) {
    return '密码错误,或账号不存在';
  }
  if (/user already registered|already exists/i.test(msg)) {
    return '该手机号已注册,请直接登录';
  }
  if (/password.*at least|password.*6/i.test(msg)) {
    return '密码至少 6 位';
  }
  if (/email|phone/i.test(msg)) {
    return '账号格式不正确';
  }
  if (/rate.limit|too many/i.test(msg)) {
    return '操作太频繁,请稍后再试';
  }
  return msg;
}
