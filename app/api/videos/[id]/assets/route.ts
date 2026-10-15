import { revalidateTag } from 'next/cache';

// Upload/asset changes come from the Mac app or uploader and the owner looks right away:
// expire now instead of stale-while-revalidate.
const NOW = { expire: 0 };
import { z } from 'zod';
import { verifyOwner } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { json, parseBody, unauthorized } from '@/lib/http';
import { presignPut, videoKeys } from '@/lib/storage';

const schema = z.object({ kind: z.enum(['poster', 'gif']) });

/**
 * Presigned PUT for the share-card images: `poster` (JPEG, still) and `gif` (animated preview
 * that Upwork plays in the message card). The key is fixed per video, so re-uploading replaces it.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/videos/[id]/assets'>) {
  if (!(await verifyOwner(req))) return unauthorized();
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  if ('error' in body) return body.error;

  const keys = videoKeys(id);
  const key = body.data.kind === 'poster' ? keys.poster : keys.gif;
  const contentType = body.data.kind === 'poster' ? 'image/jpeg' : 'image/gif';

  const video = await prisma.video
    .update({ where: { id }, data: body.data.kind === 'poster' ? { posterKey: key } : { gifKey: key } })
    .catch(() => null);
  if (!video) return json({ error: 'Video not found' }, 404);

  revalidateTag(`video-${id}`, NOW);
  revalidateTag(`video-slug-${video.slug}`, NOW);
  revalidateTag('videos', NOW);
  return json({ url: await presignPut(key, contentType), contentType, key });
}
