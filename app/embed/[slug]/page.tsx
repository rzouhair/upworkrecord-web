import { Suspense } from 'react';
import { getPublicVideo } from '@/features/video/video-queries';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false } };

/** Bare player for twitter:player and oEmbed iframes. */
export default function EmbedPage({ params }: PageProps<'/embed/[slug]'>) {
  return (
    <div className="flex h-full flex-1 items-center justify-center bg-black">
      <Suspense fallback={null}>{params.then(({ slug }) => <EmbedPlayer slug={slug} />)}</Suspense>
    </div>
  );
}

async function EmbedPlayer({ slug }: { slug: string }) {
  const video = await getPublicVideo(slug);
  return (
    <video
      src={video.videoUrl}
      poster={video.posterUrl ?? undefined}
      controls
      playsInline
      preload="metadata"
      className="max-h-full w-full"
    />
  );
}
