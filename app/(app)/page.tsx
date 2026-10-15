import { Suspense } from 'react';
import ErrorBoundary from '@/components/ui/error-boundary';
import { LibrarySearch } from '@/features/video/components/library-search';
import { UploadButton } from '@/features/video/components/upload-button';
import { VideoGrid, VideoGridSkeleton } from '@/features/video/components/video-grid';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Library' };

export default function LibraryPage({ searchParams }: PageProps<'/'>) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>My videos</h1>
          <p className="text-muted-foreground mt-1 text-sm">Record, share the link, send the proposal.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Suspense fallback={<div className="h-9 w-full sm:w-64" />}>
            <LibrarySearch />
          </Suspense>
          <UploadButton label="Upload" />
        </div>
      </header>

      <ErrorBoundary title="Your videos didn't load">
        <Suspense fallback={<VideoGridSkeleton />}>
          {searchParams.then(sp => (
            <VideoGrid query={typeof sp.q === 'string' ? sp.q : ''} />
          ))}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
