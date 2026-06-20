'use client';

import { useEffect, useState, Suspense, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';

// 把"手机号"映射为 supabase auth 使用的内部 email
// 用户感知是输入手机号+密码，后端实际使用 supabase 邮箱密码注册
function phoneToEmail(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '');
  return `${cleaned}@calendar.local`;
}

// 校验中国大陆 11 位手机号（1 开头，共 11 位数字）
function isValidPhone(phone: string): boolean {
  return /^1\d{10}$/.test(phone);
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 登录后回到 from 参数指定的页面（默认首页）
  const getRedirectPath = (): string => {
    const from = searchParams?.get('from');
    if (from && from.startsWith('/') && !from.startsWith('//') && from !== '/login') {
      return from;
    }
    return '/';
  };

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 已经在登录态的访问 /login 时直接跳到目标页
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = await getSupabaseBrowserClientWithRetry();
        const { data } = await supabase.auth.getSession();
        if (!cancelled && data.session) {
          router.replace(getRedirectPath());
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedPhone = phone.trim();
    if (!isValidPhone(trimmedPhone)) {
      setError('请输入有效的 11 位手机号');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const email = phoneToEmail(trimmedPhone);

      if (mode === 'signup') {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { phone: trimmedPhone },
          },
        });
        if (signUpErr) {
          setError(mapAuthError(signUpErr.message));
          return;
        }
        // mailer_autoconfirm: true 时注册成功直接得到 session
        if (data.session) {
          router.replace(getRedirectPath());
          return;
        }
        // 兜底：尝试登录
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) {
          setError('注册成功，请尝试登录');
          setMode('signin');
          return;
        }
        router.replace(getRedirectPath());
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) {
          setError(mapAuthError(signInErr.message));
          return;
        }
        router.replace(getRedirectPath());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(`请求失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-2xl">📅</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">年度计划日历</h1>
          <p className="mt-2 text-sm text-muted-foreground">手机号 + 密码登录，数据云端同步</p>
        </div>

        {/* 首次登录提示：让用户知道此设备的旧数据会被自动保留 */}
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          💡 首次登录此设备上的所有本地数据（如日程、待办、知识树、备忘录等）将<strong className="text-foreground">自动同步到云端</strong>，不会丢失。
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {/* 登录/注册 切换 */}
          <div className="mb-4 flex rounded-lg bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                mode === 'signin'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                mode === 'signup'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1.5">
                手机号
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="username"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                placeholder="请输入 11 位手机号"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                maxLength={11}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">
                  确认密码
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  minLength={6}
                  disabled={loading}
                />
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '处理中…' : mode === 'signup' ? '注册并登录' : '登录'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === 'signin' ? '还没有账号？' : '已有账号？'}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="ml-1 text-primary hover:underline"
            >
              {mode === 'signin' ? '去注册' : '去登录'}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          登录后，本地数据会自动同步到云端，换设备也不会丢失
        </p>
      </div>
    </div>
  );
}

// Suspense wrapper — useSearchParams 必须在 Suspense 内使用
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">正在加载…</div>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}

function mapAuthError(message: string): string {
  if (!message) return '登录失败，请重试';
  if (message.includes('Invalid login credentials')) return '手机号或密码错误';
  if (message.includes('User already registered')) return '该手机号已注册，请直接登录';
  if (message.includes('Password should be')) return '密码至少 6 位';
  if (message.includes('Email address') && message.includes('invalid'))
    return '手机号格式不正确';
  return message;
}
