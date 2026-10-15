'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatDuration, type Video } from '@/features/video/types/video';
import { refreshVideo, videoSourceUrl } from '@/features/video/video-actions';
import { makeGif, uploadAsset } from '@/features/video/video-upload';

const LENGTHS = [2, 3, 4, 5];

/** Scrub to the moment the share GIF should start, pick a length, and regenerate it in the browser. */
export function GifPicker({ video, onDone }: { video: Video; onDone: () => void }) {
  // Preview and GIF maker share one CORS-mode source so the canvas isn't tainted by a cached non-CORS load.
  const [src, setSrc] = useState<string>();
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(3);
  const [busy, setBusy] = useState(false);
  const duration = video.durationSec;

  useEffect(() => {
    videoSourceUrl(video.id).then(setSrc, (e: Error) => toast.error(e.message));
  }, [video.id]);

  async function generate() {
    setBusy(true);
    try {
      const from = Math.max(0, Math.min(start, duration - length));
      await uploadAsset(video.id, 'gif', await makeGif(src!, from, length, duration));
      await refreshVideo(video.id);
      toast.success('Preview GIF updated');
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <video
        src={src}
        crossOrigin="anonymous"
        poster={video.posterUrl ?? undefined}
        controls
        muted
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded bg-black"
        onTimeUpdate={e => setStart(e.currentTarget.currentTime)}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="tabular-nums">
          From {formatDuration(start)} to {formatDuration(Math.min(start + length, duration))}
        </span>
        <label className="flex items-center gap-2">
          Length
          <select value={length} onChange={e => setLength(Number(e.target.value))} className="w-auto!">
            {LENGTHS.map(n => (
              <option key={n} value={n}>
                {n}s
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="tertiary" size="sm" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={generate} disabled={busy || !src}>
            {busy ? 'Making GIF…' : 'Make GIF from here'}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">Pause the video where the GIF should start.</p>
    </div>
  );
}
