import { Suspense } from 'react';
import ErrorBoundary from '@/components/ui/error-boundary';
import {
  BackToLibrary,
  VIDEO_TABS,
  VideoDetail,
  VideoDetailSkeleton,
  type VideoTab,
} from '@/features/video/components/video-detail';

function parseTab(value: string | string[] | undefined): VideoTab {
  return VIDEO_TABS.find(t => t === value) ?? 'share';
}

export default function VideoPage({ params, searchParams }: PageProps<'/videos/[id]'>) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8">
      <BackToLibrary />
      <ErrorBoundary title="This video didn't load">
        <Suspense fallback={<VideoDetailSkeleton />}>
          {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
            <VideoDetail id={id} tab={parseTab(sp.tab)} />
          ))}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
