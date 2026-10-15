import { revalidateTag } from 'next/cache';

// Upload/asset changes come from the Mac app or uploader and the owner looks right away:
// expire now instead of stale-while-revalidate.
const NOW = { expire: 0 };
import { verifyOwner } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { json, unauthorized } from '@/lib/http';
import { abortMultipart } from '@/lib/storage';

/** Cancelled upload: drop the parts and the row. */
export async function POST(req: Request, ctx: RouteContext<'/api/uploads/[id]/abort'>) {
  if (!(await verifyOwner(req))) return unauthorized();
  const { id } = await ctx.params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return json({ ok: true });

  if (video.uploadId) await abortMultipart(video.videoKey, video.uploadId).catch(() => {});
  await prisma.video.delete({ where: { id } });
  revalidateTag('videos', NOW);
  return json({ ok: true });
}
