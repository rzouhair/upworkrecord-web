import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { io } from 'next/cache';
import { cookies } from 'next/headers';

/**
 * Personal-use auth: one admin password for the web app (signed session cookie) and one bearer
 * token for the Mac app. Swap for Supabase Auth later — callers only use `isSignedIn`,
 * `verifyAuth` and `verifyOwner`.
 */

export const SESSION_COOKIE = 'ur_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function hmac(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing env SESSION_SECRET');
  return createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** `<expiresAtMs>.<hmac>` — stateless, nothing to store. */
export function createSessionToken() {
  const expires = `${Date.now() + SESSION_MAX_AGE * 1000}`;
  return `${expires}.${hmac(expires)}`;
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [expires, sig] = token.split('.');
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return safeEqual(sig, hmac(expires));
}

export function isValidPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  return !!expected && safeEqual(password, expected);
}

function isValidApiToken(req: Request) {
  const expected = process.env.API_TOKEN;
  const header = req.headers.get('authorization') ?? '';
  return !!expected && header.startsWith('Bearer ') && safeEqual(header.slice(7), expected);
}

export async function isSignedIn() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await io(); // expiry check reads the clock: keep it out of prerendered shells
  return isValidSessionToken(token);
}

/** Server actions / owner pages. */
export async function verifyAuth() {
  if (!(await isSignedIn())) throw new Error('Unauthorized');
}

/** Route handlers: the Mac app (bearer token) or the signed-in browser. */
export async function verifyOwner(req: Request) {
  return isValidApiToken(req) || (await isSignedIn());
}
