import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** AES-256-GCM with a key derived from SESSION_SECRET: `iv.tag.ciphertext`, base64url. */
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing env SESSION_SECRET');
  return createHash('sha256').update(`crypto-box:${secret}`).digest();
}

export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
}

export function open<T>(sealed: string | null | undefined): T | undefined {
  if (!sealed) return undefined;
  try {
    const [iv, tag, data] = sealed.split('.').map(p => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')) as T;
  } catch {
    return undefined; // secret rotated or corrupted → treat as not connected
  }
}
