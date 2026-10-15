import { previewCopy } from '@/features/video/types/video';
import { prisma } from '@/lib/db';
import { appUrl, json } from '@/lib/http';

/** oEmbed (https://oembed.com) so Notion, Linear, Medium… can embed the player. */
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get('url') ?? '';
  const slug = /\/v\/([a-z0-9]+)/.exec(target)?.[1];
  const video = slug ? await prisma.video.findUnique({ where: { slug } }) : null;
  if (!video || video.status !== 'READY') return json({ error: 'Not found' }, 404);

  const base = appUrl();
  const width = 960;
  const height = video.width && video.height ? Math.round((width * video.height) / video.width) : 540;
  const words = Array.isArray(video.transcript) ? (video.transcript as { text?: unknown }[]) : [];
  const copy = previewCopy({ ...video, transcriptText: words.map(w => (typeof w.text === 'string' ? w.text : '')).join(' ') });
  return json({
    version: '1.0',
    type: 'video',
    provider_name: 'UpworkRecord',
    provider_url: base,
    title: copy.title,
    width,
    height,
    html: `<iframe src="${base}/embed/${video.slug}" width="${width}" height="${height}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`,
    ...(video.posterKey ? { thumbnail_url: `${base}/media/${video.posterKey}`, thumbnail_width: width, thumbnail_height: height } : {}),
  });
}
