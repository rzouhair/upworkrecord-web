import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';
import { notFound, permanentRedirect } from 'next/navigation';
import { toVideo } from '@/features/video/types/video';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Owner reads check the session outside the cache (cookies can't be read in 'use cache'),
// then hit a cached function keyed by plain arguments.

export async function getVideos(query: string) {
  await verifyAuth();
  return getVideosCached(query.trim());
}

async function getVideosCached(query: string) {
  'use cache';
  cacheTag('videos');
  cacheLife('minutes');

  const rows = await prisma.video.findMany({
    where: {
      status: { not: 'FAILED' },
      ...(query ? { title: { contains: query, mode: 'insensitive' as const } } : {}),
    },
    include: { _count: { select: { views: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toVideo);
}

export async function getVideo(id: string) {
  await verifyAuth();
  return getVideoCached(id);
}

async function getVideoCached(id: string) {
  'use cache';
  cacheTag('videos', `video-${id}`);
  cacheLife('minutes');

  const row = await prisma.video.findUnique({ where: { id }, include: { _count: { select: { views: true } } } });
  if (!row) notFound();
  return toVideo(row);
}

/**
 * Public share page + generateMetadata: cached so link-preview bots get a fast, complete <head>.
 * A renamed slug permanently redirects to the current one.
 */
export async function getPublicVideo(slug: string) {
  const found = await getPublicVideoCached(slug);
  if (found.video) return found.video;
  if (found.movedTo) permanentRedirect(`/v/${found.movedTo}`);
  notFound();
}

async function getPublicVideoCached(slug: string) {
  'use cache';
  cacheTag('videos', `video-slug-${slug}`);
  cacheLife('minutes');

  const row = await prisma.video.findUnique({ where: { slug }, include: { proposal: { select: { clientName: true } } } });
  if (row?.status === 'READY') return { video: { ...toVideo(row), clientName: row.proposal?.clientName ?? '' }, movedTo: null };
  const moved = row ? null : await prisma.video.findFirst({ where: { previousSlugs: { has: slug } }, select: { slug: true } });
  return { video: null, movedTo: moved?.slug ?? null };
}

export type ViewerRow = {
  id: string;
  maxPercent: number;
  watchedSec: number;
  referrer: string | null;
  userAgent: string | null;
  lastSeen: string;
};

export async function getInsights(videoId: string) {
  await verifyAuth();
  return getInsightsCached(videoId);
}

async function getInsightsCached(videoId: string) {
  'use cache';
  cacheTag(`views-${videoId}`);
  cacheLife('seconds');

  const rows = await prisma.viewEvent.findMany({ where: { videoId }, orderBy: { updatedAt: 'desc' }, take: 100 });
  const viewers: ViewerRow[] = rows.map(r => ({
    id: r.id,
    maxPercent: r.maxPercent,
    watchedSec: r.watchedSec,
    referrer: r.referrer,
    userAgent: r.userAgent,
    lastSeen: r.updatedAt.toISOString(),
  }));
  const avgPercent = rows.length ? Math.round(rows.reduce((s, r) => s + r.maxPercent, 0) / rows.length) : 0;
  return {
    viewers,
    uniqueViewers: rows.length,
    avgPercent,
    completed: rows.filter(r => r.maxPercent >= 90).length,
  };
}
