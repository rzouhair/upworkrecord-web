'use client';

import { Eye, Film, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { RelativeTime } from '@/components/ui/relative-time';
import { DeleteVideoButton } from '@/features/video/components/delete-video-button';
import { formatDuration, type Video } from '@/features/video/types/video';
import type { Route } from 'next';

/** Library tile. Hovering swaps the poster for the animated share GIF, like Loom's grid. */
export function VideoCard({ video }: { video: Video }) {
  const [hover, setHover] = useState(false);
  const still = video.posterUrl;
  const image = hover && video.gifUrl ? video.gifUrl : still;

  return (
    // Delete sits beside the link, not inside it: a <button> inside <a> is invalid HTML.
    <div className="group/card relative">
      <Link
        href={`/videos/${video.id}` as Route}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        // Air 3 interactive card: soft shadow + 1px ring, deeper on hover; no border, no lift.
        className="group shadow-card hover:shadow-card-hover bg-background text-foreground hover:text-foreground flex flex-col overflow-hidden rounded-lg no-underline transition-shadow"
      >
        <div className="bg-muted relative aspect-video overflow-hidden">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- same-origin media route; GIFs must not be re-encoded
            <img src={image} alt="" className="size-full object-cover" />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              <Film className="size-8" />
            </div>
          )}
          {video.status === 'UPLOADING' ? (
            <span className="bg-ink/60 absolute inset-0 flex items-center justify-center gap-2 text-xs font-medium text-white">
              <Loader2 className="size-4 animate-spin" /> Uploading…
            </span>
          ) : (
            <span className="bg-ink/85 absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-xs font-medium text-white tabular-nums">
              {formatDuration(video.durationSec)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 p-4">
          <h3 className="group-hover:text-brand line-clamp-2 text-base leading-snug font-medium group-hover:underline">
            {video.title}
          </h3>
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <RelativeTime iso={video.createdAt} />
            <span className="flex items-center gap-1">
              <Eye className="size-3.5" />
              {video.viewCount} {video.viewCount === 1 ? 'view' : 'views'}
            </span>
          </div>
        </div>
      </Link>
      <DeleteVideoButton id={video.id} compact />
    </div>
  );
}
