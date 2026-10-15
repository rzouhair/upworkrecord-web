import 'server-only';

import { NextResponse } from 'next/server';
import type { z } from 'zod';

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
export const unauthorized = () => json({ error: 'Unauthorized' }, 401);

/** Parse a JSON body against a schema; returns the data or a 400 response. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T) {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  return parsed.success
    ? ({ data: parsed.data as z.infer<T> } as const)
    : ({ error: json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, 400) } as const);
}

export const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
