import { Suspense } from 'react';
import { Logo } from '@/components/logo';
import { LoginForm } from '@/features/user/components/login-form';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <div className="flex flex-1 items-center justify-center px-5">
      <div className="uw-card w-full max-w-sm p-8!">
        <Logo className="mb-6" />
        <h1 className="mb-1">Welcome back</h1>
        <p className="text-muted-foreground mb-6 text-sm">Sign in to your recordings.</p>
        <Suspense fallback={<LoginForm next="/" />}>
          {searchParams.then(sp => (
            <LoginForm next={typeof sp.next === 'string' ? sp.next : '/'} />
          ))}
        </Suspense>
      </div>
    </div>
  );
}
