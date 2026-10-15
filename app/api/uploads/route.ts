import { customAlphabet } from 'nanoid';
import { revalidateTag } from 'next/cache';

// Upload/asset changes come from the Mac app or uploader and the owner looks right away:
// expire now instead of stale-while-revalidate.
const NOW = { expire: 0 };
import { z } from 'zod';
import { verifyOwner } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { appUrl, json, parseBody, unauthorized } from '@/lib/http';
import { createMultipart, PART_SIZE, partCount, presignParts, videoKeys } from '@/lib/storage';

// Short, unambiguous share slugs: /v/k3m9x2qp7a
const slug = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 10);

const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

const schema = z.object({
  title: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().positive().max(MAX_BYTES, 'Videos up to 5 GB'),
  contentType: z.enum(['video/mp4', 'video/quicktime', 'video/webm']).default('video/mp4'),
  durationSec: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

/**
 * Start an upload (browser or Mac app). Creates the video row and a multipart upload, and
 * returns presigned PUT URLs for every part. The client PUTs parts straight to storage, then
 * calls /api/uploads/:id/complete with the ETags.
 */
export async function POST(req: Request) {
  if (!(await verifyOwner(req))) return unauthorized();
  const body = await parseBody(req, schema);
  if ('error' in body) return body.error;
  const input = body.data;

  const video = await prisma.video.create({
    data: {
      slug: slug(),
      title: input.title || `Recording ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      durationSec: input.durationSec ?? 0,
      width: input.width,
      height: input.height,
      sizeBytes: input.sizeBytes,
      videoKey: '',
    },
  });
  const key = videoKeys(video.id).video;
  const uploadId = await createMultipart(key, input.contentType);
  await prisma.video.update({ where: { id: video.id }, data: { videoKey: key, uploadId } });
  const parts = await presignParts(key, uploadId, 1, partCount(input.sizeBytes));

  revalidateTag('videos', NOW);
  return json(
    {
      videoId: video.id,
      slug: video.slug,
      shareUrl: `${appUrl()}/v/${video.slug}`,
      partSize: PART_SIZE,
      parts,
    },
    201,
  );
}
