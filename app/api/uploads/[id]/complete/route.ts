import { revalidateTag } from 'next/cache';
import { after } from 'next/server';

// Upload/asset changes come from the Mac app or uploader and the owner looks right away:
// expire now instead of stale-while-revalidate.
const NOW = { expire: 0 };
import { z } from 'zod';
import { verifyOwner } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { appUrl, json, parseBody, unauthorized } from '@/lib/http';
import { completeMultipart, objectSize } from '@/lib/storage';
import { summarizeVideo } from '@/features/video/video-ai';

const schema = z.object({
  parts: z.array(z.object({ partNumber: z.number().int().min(1), etag: z.string().min(1) })).min(1),
  durationSec: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  // Optional extras from the Mac app. A transcript without a summary gets title/summary/chapters
  // generated here, after the response.
  title: z.string().trim().min(1).max(120).optional(),
  summary: z.string().max(2000).optional(),
  transcript: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })).optional(),
  chapters: z.array(z.object({ start: z.number(), title: z.string() })).optional(),
});

export async function POST(req: Request, ctx: RouteContext<'/api/uploads/[id]/complete'>) {
  if (!(await verifyOwner(req))) return unauthorized();
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  if ('error' in body) return body.error;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return json({ error: 'Video not found' }, 404);
  if (!video.uploadId) return json({ error: 'Upload already completed' }, 409);

  try {
    await completeMultipart(video.videoKey, video.uploadId, body.data.parts);
  } catch (e) {
    await prisma.video.update({ where: { id }, data: { status: 'FAILED' } });
    return json({ error: `Storage rejected the upload: ${(e as Error).message}` }, 502);
  }

  const { parts: _parts, ...meta } = body.data;
  const size = await objectSize(video.videoKey);
  const updated = await prisma.video.update({
    where: { id },
    data: { ...meta, status: 'READY', uploadId: null, ...(size ? { sizeBytes: size } : {}) },
  });

  after(() => summarizeVideo(id));

  revalidateTag('videos', NOW);
  revalidateTag(`video-${id}`, NOW);
  revalidateTag(`video-slug-${updated.slug}`, NOW);
  return json({ videoId: id, slug: updated.slug, shareUrl: `${appUrl()}/v/${updated.slug}` });
}
