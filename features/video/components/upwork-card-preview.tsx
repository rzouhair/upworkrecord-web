import { Film, Play } from 'lucide-react';
import { formatDuration } from '@/features/video/types/video';

/**
 * How the link unfurls in Upwork Messages: og:image (animated GIF plays in place), og:title,
 * og:description, and the og:type label. Mirrors the real card so edits are WYSIWYG.
 */
export function UpworkCardPreview({
  image,
  title,
  description,
  durationSec,
  isGif,
}: {
  image: string | null;
  title: string;
  description: string;
  durationSec: number;
  isGif: boolean;
}) {
  return (
    <figure className="border-divider bg-background text-foreground w-full max-w-md overflow-hidden rounded-lg border">
      <div className="bg-muted relative aspect-video">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview must show the exact GIF
          <img src={image} alt="" className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center">
            <Film className="size-8" />
          </div>
        )}
        {!isGif ? (
          // A still has no baked-in play button; show where one would be.
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="flex h-11 w-16 items-center justify-center rounded-lg bg-ink/70">
              <Play className="size-5 fill-white text-white" />
            </span>
            <span className="text-[11px] text-white/90 italic drop-shadow">Play {formatDuration(durationSec)} video</span>
          </span>
        ) : null}
      </div>
      <figcaption className="flex flex-col gap-1 p-4">
        <span className="line-clamp-2 text-base leading-snug font-medium">{title}</span>
        <span className="text-muted-foreground line-clamp-3 text-sm leading-snug">{description}</span>
        <span className="text-xs font-medium">Video</span>
      </figcaption>
    </figure>
  );
}
