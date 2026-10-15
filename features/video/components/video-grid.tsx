import { Clapperboard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { UploadButton } from '@/features/video/components/upload-button';
import { VideoCard } from '@/features/video/components/video-card';
import { getVideos } from '@/features/video/video-queries';

export async function VideoGrid({ query }: { query: string }) {
  const videos = await getVideos(query);

  if (videos.length === 0) {
    return query ? (
      <p className="text-muted-foreground py-16 text-center text-sm">No videos match “{query}”.</p>
    ) : (
      <div className="uw-card uw-card--muted flex flex-col items-center gap-4 px-6 py-20 text-center">
        <span className="bg-brand-fade text-brand flex size-14 items-center justify-center rounded-full">
          <Clapperboard className="size-6" />
        </span>
        <h2>No videos yet</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Record one with the UpworkRecord Mac app, or upload a video file to get a share link and a proposal.
        </p>
        <UploadButton size="lg" />
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map(v => (
        <li key={v.id}>
          <VideoCard video={v} />
        </li>
      ))}
    </ul>
  );
}

export function VideoGridSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="shadow-card overflow-hidden rounded-lg">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}
