'use client';

import { ReactNode } from 'react';
import AuthGuard from '@/components/auth-guard';

export default function AuthGuardWrapper({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}