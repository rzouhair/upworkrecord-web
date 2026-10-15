import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { isSignedIn } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { json, parseBody } from '@/lib/http';

const VIEWER_COOKIE = 'ur_viewer';

const schema = z.object({
  percent: z.number().min(0).max(100),
  watchedSec: z.number().min(0),
  referrer: z.string().max(500).optional(),
});

/** Public progress beacon from the share page. One row per viewer, keeps the furthest point. */
export async function POST(req: Request, ctx: RouteContext<'/api/v/[slug]/view'>) {
  // Your own views don't count, like Loom.
  if (await isSignedIn()) return json({ ok: true, counted: false });

  const { slug } = await ctx.params;
  const body = await parseBody(req, schema);
  if ('error' in body) return body.error;

  const video = await prisma.video.findUnique({ where: { slug }, select: { id: true } });
  if (!video) return json({ error: 'Not found' }, 404);

  const store = await cookies();
  let viewerId = store.get(VIEWER_COOKIE)?.value;
  if (!viewerId) {
    viewerId = randomUUID();
    store.set(VIEWER_COOKIE, viewerId, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/' });
  }

  const percent = Math.round(body.data.percent);
  const existing = await prisma.viewEvent.findUnique({ where: { videoId_viewerId: { videoId: video.id, viewerId } } });
  if (existing) {
    await prisma.viewEvent.update({
      where: { id: existing.id },
      data: {
        maxPercent: Math.max(existing.maxPercent, percent),
        watchedSec: Math.max(existing.watchedSec, body.data.watchedSec),
      },
    });
  } else {
    await prisma.viewEvent.create({
      data: {
        videoId: video.id,
        viewerId,
        maxPercent: percent,
        watchedSec: body.data.watchedSec,
        referrer: body.data.referrer || null,
        userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      },
    });
    revalidateTag('videos', { expire: 0 }); // view counts in the library (first view per viewer only)
  }
  // Immediate, not 'max': a stale-while-revalidate mark after the owner's immediate expiries
  // brought back an outdated entry. Beacons are rare (a few milestones per viewer).
  revalidateTag(`views-${video.id}`, { expire: 0 });
  return json({ ok: true, counted: true });
}
