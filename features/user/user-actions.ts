'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSessionToken, isValidPassword, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';

const schema = z.object({
  password: z.string().min(1, 'Enter the password'),
  next: z.string().startsWith('/').catch('/'),
});

export async function signIn(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = schema.safeParse({ password: formData.get('password'), next: formData.get('next') ?? '/' });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!isValidPassword(parsed.data.password)) return { error: 'Wrong password' };

  (await cookies()).set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  // Plain form, not a dialog awaiting the result, so redirect() is fine here.
  redirect(parsed.data.next.startsWith('//') ? '/' : (parsed.data.next as '/'));
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
