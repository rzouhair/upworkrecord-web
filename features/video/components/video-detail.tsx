import { ArrowLeft, Eye } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { ProposalPanel, ProposalPanelSkeleton } from '@/features/proposal/components/proposal-panel';
import { DeleteVideoButton } from '@/features/video/components/delete-video-button';
import { InsightsPanel, InsightsPanelSkeleton } from '@/features/video/components/insights-panel';
import { SharePanel } from '@/features/video/components/share-panel';
import { TitleEditor } from '@/features/video/components/title-editor';
import { TranscriptPanel } from '@/features/video/components/transcript-panel';
import { VideoPlayer } from '@/features/video/components/video-player';
import { formatDuration } from '@/features/video/types/video';
import { getVideo } from '@/features/video/video-queries';
import { appUrl } from '@/lib/http';
import type { Route } from 'next';

export const VIDEO_TABS = ['share', 'proposal', 'transcript', 'insights'] as const;
export type VideoTab = (typeof VIDEO_TABS)[number];

const LABELS: Record<VideoTab, string> = {
  share: 'Share',
  proposal: 'Proposal',
  transcript: 'Transcript',
  insights: 'Insights',
};

export async function VideoDetail({ id, tab }: { id: string; tab: VideoTab }) {
  const video = await getVideo(id);
  const shareUrl = `${appUrl()}/v/${video.slug}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <VideoPlayer src={video.videoUrl} poster={video.posterUrl} chapters={video.chapters} />
        <TitleEditor key={video.title} id={video.id} title={video.title} />
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <RelativeTime iso={video.createdAt} />
          <span>{formatDuration(video.durationSec)}</span>
          <span className="flex items-center gap-1">
            <Eye className="size-4" /> {video.viewCount} {video.viewCount === 1 ? 'viewer' : 'viewers'}
          </span>
          {video.width && video.height ? (
            <span>
              {video.width}×{video.height}
            </span>
          ) : null}
          <span className="ml-auto">
            <DeleteVideoButton id={video.id} />
          </span>
        </div>
      </div>

      <aside className="uw-card flex min-w-0 flex-col p-0!">
        <Tabs
          tabs={VIDEO_TABS.map(t => ({ label: LABELS[t], value: t, href: `/videos/${video.id}?tab=${t}` as Route }))}
          active={tab}
          label="Video sections"
        />
        <div className="p-6">
          {tab === 'share' ? <SharePanel video={video} shareUrl={shareUrl} /> : null}
          {tab === 'proposal' ? (
            <Suspense fallback={<ProposalPanelSkeleton />}>
              <ProposalPanel videoId={video.id} />
            </Suspense>
          ) : null}
          {tab === 'transcript' ? <TranscriptPanel video={video} /> : null}
          {tab === 'insights' ? (
            <Suspense fallback={<InsightsPanelSkeleton />}>
              <InsightsPanel videoId={video.id} />
            </Suspense>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function BackToLibrary() {
  return (
    <Link href="/" className="uw-link uw-link--plain mb-5 inline-flex items-center gap-1.5 text-sm">
      <ArrowLeft className="size-4" /> Library
    </Link>
  );
}

export function VideoDetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]" aria-hidden>
      <div className="flex flex-col gap-4">
        <Skeleton className="aspect-video w-full rounded-lg" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-[32rem] w-full rounded-lg" />
    </div>
  );
}
