import { connection } from 'next/server';
import { Suspense } from 'react';
import { ShareHeader, ShareView, ShareViewSkeleton } from '@/features/video/components/share-view';
import { getPublicVideo } from '@/features/video/video-queries';
import { shareMetadata } from '@/features/video/video-metadata';
import type { Metadata } from 'next';

// Link-preview bots read these tags; htmlLimitedBots in next.config keeps them in <head>.
export async function generateMetadata({ params }: PageProps<'/v/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  return shareMetadata(await getPublicVideo(slug));
}

export default function SharePage({ params }: PageProps<'/v/[slug]'>) {
  return (
    <div className="flex-1 overflow-y-auto">
      <ShareHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <Suspense fallback={<ShareViewSkeleton />}>{params.then(({ slug }) => <ShareView slug={slug} />)}</Suspense>
      </main>
      <footer className="text-muted-foreground py-10 text-center text-xs">Recorded with UpworkRecord</footer>
      {/* Metadata needs the slug (request time); tells Next that's intentional. */}
      <Suspense>
        <Connection />
      </Suspense>
    </div>
  );
}

async function Connection() {
  await connection();
  return null;
}
