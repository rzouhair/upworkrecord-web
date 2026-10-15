import { NextResponse } from 'next/server';
import { bucket, presignGet, s3 } from '@/lib/storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';

/**
 * Stable, same-origin media URLs over a private bucket.
 * - Images (share-card GIF / poster) are streamed through, so link-preview crawlers get a
 *   plain 200 image with the right content type — no cross-domain redirect to trip over.
 * - Video redirects to a presigned URL: storage handles Range requests for seeking.
 */
export async function GET(_req: Request, ctx: RouteContext<'/media/[...key]'>) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join('/');
  if (!/^(videos\/[a-z0-9]+\/(video\.mp4|poster\.jpg|preview\.gif)|profile\/photo-[a-f0-9]+\.(jpg|png|webp))$/.test(key)) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (key.endsWith('video.mp4')) {
    return NextResponse.redirect(await presignGet(key), {
      status: 302,
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  }

  try {
    const obj = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return new NextResponse(obj.Body?.transformToWebStream(), {
      headers: {
        'Content-Type': { gif: 'image/gif', png: 'image/png', webp: 'image/webp' }[key.split('.').pop()!] ?? 'image/jpeg',
        ...(obj.ContentLength ? { 'Content-Length': String(obj.ContentLength) } : {}),
        // Short: re-uploading a GIF keeps the URL, so caches must pick up the new one soon.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
