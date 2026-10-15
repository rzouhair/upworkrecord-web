'use server';

import { updateTag } from 'next/cache';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { complete, MissingKeyError } from '@/features/proposal/proposal-ai';
import { callTool } from '@/features/upwork/upwork-mcp';
import { putObject } from '@/lib/storage';
import type { Profile } from '@/features/profile/profile-queries';
import { PROFILE_JSON_RULES } from '@/features/profile/profile-shape';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const url = z.union([z.literal(''), z.url('Enter a full link, starting with https://')]);
// Profile photos are copied into our storage (Upwork photo links expire), then served from /media.
const photo = z.union([url, z.string().regex(/^\/media\/profile\/photo-[a-f0-9]+\.(jpg|png|webp)$/)]);
const list = z.array(z.string().trim().min(1).max(40)).max(20);

const schema = z.object({
  name: z.string().trim().max(80),
  headline: z.string().trim().max(120),
  bio: z.string().trim().max(2000),
  photoUrl: photo,
  profileUrl: url,
  jobSuccess: z.number().int().min(0).max(100).nullable(),
  badge: z.string().trim().max(40),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0).nullable(),
  totalJobs: z.number().int().min(0).nullable(),
  totalHours: z.number().int().min(0).nullable(),
  totalEarned: z.string().trim().max(20),
  skills: list,
  experiences: z
    .array(
      z.object({
        title: z.string().trim().min(1, 'Each experience needs a title').max(100),
        org: z.string().trim().max(100),
        period: z.string().trim().max(40),
        summary: z.string().trim().max(500),
      }),
    )
    .max(12),
  certifications: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(150),
        issuer: z.string().trim().max(100),
        date: z.string().trim().max(40),
      }),
    )
    .max(20),
  reviews: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(2000),
        rating: z.number().min(0).max(5).nullable(),
        title: z.string().trim().max(150),
        client: z.string().trim().max(100),
        date: z.string().trim().max(40),
      }),
    )
    .max(30),
});

export async function saveProfile(input: z.input<typeof schema>) {
  await verifyAuth();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  if (/^https?:\/\//.test(parsed.data.photoUrl)) {
    const copied = await copyPhoto(parsed.data.photoUrl);
    if ('error' in copied) return { ok: false as const, error: copied.error };
    parsed.data.photoUrl = copied.url;
  }
  await prisma.profile.upsert({ where: { id: 'me' }, create: { id: 'me', ...parsed.data }, update: parsed.data });
  updateTag('profile');
  return { ok: true as const, photoUrl: parsed.data.photoUrl };
}

const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Store an image under a content-hashed key (new photo = new URL, so caches never serve the old one). */
async function storePhoto(bytes: Uint8Array, type: string) {
  const ext = PHOTO_TYPES[type.split(';')[0].trim()];
  if (!ext) return { error: 'Use a JPG, PNG or WebP image.' };
  // Vercel caps request bodies at 4.5 MB, so uploads above ~4 MB never reach this action there.
  if (bytes.byteLength > 4 * 1024 * 1024) return { error: 'Photo is over 4 MB.' };
  const key = `profile/photo-${createHash('sha1').update(bytes).digest('hex').slice(0, 12)}.${ext}`;
  await putObject(key, bytes, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
  return { url: `/media/${key}` };
}

async function copyPhoto(link: string) {
  const res = await fetch(link, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) {
    return { error: "Couldn't download that photo link (Upwork photo links expire). Upload the image instead." };
  }
  return storePhoto(new Uint8Array(await res.arrayBuffer()), res.headers.get('content-type') ?? '');
}

/** Settings → "Upload photo". */
export async function uploadProfilePhoto(form: FormData) {
  await verifyAuth();
  const file = form.get('photo');
  if (!(file instanceof File) || !file.size) return { ok: false as const, error: 'Choose an image' };
  const stored = await storePhoto(new Uint8Array(await file.arrayBuffer()), file.type);
  return 'error' in stored ? { ok: false as const, error: stored.error } : { ok: true as const, url: stored.url };
}

/** Upwork tool call that throws on tool errors, so failures surface instead of being mapped. */
async function upwork(name: string, args: Record<string, unknown>) {
  const res = await callTool(name, args);
  if (res.isError) throw new Error(`${name}: ${String(res.data).slice(0, 200)}`);
  return res.structured ?? res.data;
}

/**
 * Pull profile, work history, certifications and client feedback over Upwork's MCP and map them
 * onto the profile shape. Returns a draft for the form; nothing is saved until the owner saves.
 */
export async function importFromUpwork() {
  await verifyAuth();
  let raw: unknown[];
  try {
    let profile: unknown;
    let orgUid: string | undefined;
    try {
      profile = await upwork('get_profile', { action: 'get' });
    } catch {
      // ponytail: first long numeric id in list_accounts = the freelancer org; pick by type if it has several
      orgUid = JSON.stringify(await upwork('list_accounts', {})).match(/\d{15,}/)?.[0];
      if (!orgUid) throw new Error('No Upwork account found');
      profile = await upwork('get_profile', { action: 'get', org_uid: orgUid });
    }
    const highlights = await upwork('get_profile', {
      action: 'list_highlights',
      ...(orgUid ? { org_uid: orgUid } : {}),
    }).catch(() => null);
    raw = [profile, highlights];
  } catch (e) {
    const message = (e as Error).message;
    return {
      ok: false as const,
      error: /not connected|No public base URL|Unauthorized|401/i.test(message)
        ? 'Connect Upwork below first.'
        : `Upwork: ${message}`,
    };
  }

  const prompt = `Copy a freelancer's Upwork data into JSON.
${PROFILE_JSON_RULES}

Upwork data:
${JSON.stringify(raw).slice(0, 60_000)}`;

  try {
    return toProfile(await complete(prompt, process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-nano', { json: true }));
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof MissingKeyError ? e.message : `Import failed: ${(e as Error).message}`,
    };
  }
}

/** JSON from Claude/Codex (the copy-paste prompt) → profile draft for the form. */
export async function parseProfileJson(text: string) {
  await verifyAuth();
  return toProfile(text);
}

/** Model reply (may carry ``` fences or chatter) → validated profile draft. */
function toProfile(reply: string) {
  let data: unknown;
  try {
    data = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
  } catch {
    return { ok: false as const, error: "That isn't JSON. Paste the whole reply, starting with {" };
  }
  if (!data || typeof data !== 'object') return { ok: false as const, error: 'Expected a JSON object' };
  const parsed = schema.safeParse(normalize(data as Record<string, unknown>));
  if (!parsed.success)
    return { ok: false as const, error: `Couldn't read the profile: ${parsed.error.issues[0].message}` };
  return { ok: true as const, profile: parsed.data satisfies Profile };
}

/** Model output → schema input: trim oversize lists/strings and drop malformed items instead of failing. */
function normalize(v: Record<string, unknown>) {
  const s = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
  const arr = (x: unknown) =>
    Array.isArray(x) ? (x as Record<string, unknown>[]).filter(i => i && typeof i === 'object') : [];
  const strings = (x: unknown) =>
    Array.isArray(x)
      ? x
          .map(i => s(i, 40))
          .filter(Boolean)
          .slice(0, 20)
      : [];
  const int = (x: unknown, max = Infinity) =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max ? Math.round(x) : null;
  const url = (x: unknown) => (typeof x === 'string' && URL.canParse(x) ? x : '');
  return {
    name: s(v.name, 80),
    headline: s(v.headline, 120),
    bio: s(v.bio, 2000),
    photoUrl: url(v.photoUrl),
    profileUrl: url(v.profileUrl),
    jobSuccess: int(v.jobSuccess, 100),
    badge: s(v.badge, 40),
    rating: typeof v.rating === 'number' && v.rating >= 0 && v.rating <= 5 ? v.rating : null,
    reviewCount: int(v.reviewCount),
    totalJobs: int(v.totalJobs),
    totalHours: int(v.totalHours),
    totalEarned: s(v.totalEarned, 20),
    skills: strings(v.skills),
    experiences: arr(v.experiences)
      .map(e => ({ title: s(e.title, 100), org: s(e.org, 100), period: s(e.period, 40), summary: s(e.summary, 500) }))
      .filter(e => e.title)
      .slice(0, 12),
    certifications: arr(v.certifications)
      .map(c => ({ name: s(c.name, 150), issuer: s(c.issuer, 100), date: s(c.date, 40) }))
      .filter(c => c.name)
      .slice(0, 20),
    reviews: arr(v.reviews)
      .map(r => ({
        text: s(r.text, 2000),
        rating: typeof r.rating === 'number' && r.rating >= 0 && r.rating <= 5 ? r.rating : null,
        title: s(r.title, 150),
        client: s(r.client, 100),
        date: s(r.date, 40),
      }))
      .filter(r => r.text)
      .slice(0, 30),
  };
}
