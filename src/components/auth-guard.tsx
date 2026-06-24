'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClientAsync } from '@/lib/supabase-browser';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSupabaseBrowserClientAsync()
      .then(async (supabase) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) {
          if (!session) {
            router.replace('/login');
          } else {
            setChecking(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          router.replace('/login');
        }
      });
    return () => { cancelled = true; };
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-muted-foreground">正在验证登录状态...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}