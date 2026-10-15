import 'server-only';

import { previewCopy, type Video } from '@/features/video/types/video';
import { appUrl } from '@/lib/http';
import type { Metadata } from 'next';

/**
 * og:/twitter: tags for a share link. og:image leads with the animated GIF (Upwork, Discord and
 * email clients play it), with the still poster as a fallback image; og:video + twitter:player
 * + oEmbed cover apps that can embed a real player.
 */
export function shareMetadata(video: Video): Metadata {
  const base = appUrl();
  const url = `${base}/v/${video.slug}`;
  const { title, description } = previewCopy(video);
  const width = video.width ?? 1280;
  const height = video.height ?? 720;
  const abs = (path: string) => `${base}${path}`;

  const images = [
    ...(video.gifUrl ? [{ url: abs(video.gifUrl), type: 'image/gif', alt: title }] : []),
    ...(video.posterUrl ? [{ url: abs(video.posterUrl), type: 'image/jpeg', alt: title }] : []),
  ];

  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: { 'application/json+oembed': `${base}/api/oembed?url=${encodeURIComponent(url)}` },
    },
    openGraph: {
      type: 'video.other',
      siteName: 'UpworkRecord',
      url,
      title,
      description,
      images,
      videos: [{ url: abs(video.videoUrl), type: 'video/mp4', width, height }],
    },
    twitter: {
      card: 'player',
      title,
      description,
      images: images.map(i => i.url),
      players: [{ playerUrl: `${base}/embed/${video.slug}`, streamUrl: abs(video.videoUrl), width, height }],
    },
  };
}
