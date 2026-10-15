'use client';

import { ChevronDown, RotateCcw } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { formatDuration, type Chapter } from '@/features/video/types/video';
import { cn } from '@/lib/utils';

const MILESTONES = [1, 25, 50, 75, 95];

/**
 * Native <video> + collapsible chapter list that follows playback. With `beaconSlug` (public share
 * page) it reports watch progress at milestones so the owner sees who watched and how far.
 * `below` renders between the video and the chapters, `children` after them; `aside` becomes a
 * sticky column beside both on desktop. `endCard` covers the video when it ends.
 */
export function VideoPlayer({
  src,
  poster,
  chapters = [],
  beaconSlug,
  autoPlay = false,
  below,
  aside,
  children,
  endCard,
  className,
}: {
  src: string;
  poster?: string | null;
  chapters?: Chapter[];
  beaconSlug?: string;
  autoPlay?: boolean;
  below?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  endCard?: ReactNode;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const sent = useRef(new Set<number>());
  const [current, setCurrent] = useState(0);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [ended, setEnded] = useState(false);

  function beacon(percent: number, watchedSec: number) {
    if (!beaconSlug) return;
    fetch(`/api/v/${beaconSlug}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percent, watchedSec, referrer: document.referrer || undefined }),
      keepalive: true,
    }).catch(() => {});
  }

  function onTimeUpdate() {
    const v = video.current;
    if (!v || !v.duration) return;
    const reached = chapters.findLastIndex(c => v.currentTime >= c.start);
    if (reached !== current) setCurrent(Math.max(reached, 0));
    const percent = (v.currentTime / v.duration) * 100;
    const hit = MILESTONES.filter(m => percent >= m && !sent.current.has(m)).at(-1);
    if (hit === undefined) return;
    MILESTONES.filter(m => m <= hit).forEach(m => sent.current.add(m));
    beacon(hit >= 95 ? 100 : hit, v.currentTime);
  }

  const chapterList =
    chapters.length > 0 ? (
      <section className="border-divider max-w-3xl border-t" aria-label="Chapters">
        <button
          type="button"
          aria-expanded={chaptersOpen}
          onClick={() => setChaptersOpen(o => !o)}
          className="hover:text-foreground text-muted-foreground flex w-full items-center gap-2 py-3 text-left text-sm"
        >
          <span>
            Chapter {current + 1} of {chapters.length}
          </span>
          <span aria-hidden>·</span>
          {/* Collapsed, the header follows playback: the chapter being watched. */}
          <span className="text-foreground min-w-0 flex-1 truncate">
            <span className="text-brand font-medium tabular-nums">{formatDuration(chapters[current].start)}</span>{' '}
            {chapters[current].title}
          </span>
          <ChevronDown className={cn('size-4 shrink-0 transition-transform', chaptersOpen && 'rotate-180')} />
        </button>
        {chaptersOpen ? (
          <ol className="-mx-2 flex flex-col gap-0.5 pb-2">
            {chapters.map((c, i) => (
              <li key={`${c.start}-${c.title}`}>
                <button
                  type="button"
                  aria-current={i === current ? 'step' : undefined}
                  onClick={() => {
                    if (!video.current) return;
                    video.current.currentTime = c.start;
                    video.current.play().catch(() => {});
                  }}
                  className={cn(
                    'hover:bg-hover flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm',
                    i === current && 'bg-muted font-medium',
                  )}
                >
                  <span className="text-brand text-sm font-medium tabular-nums">{formatDuration(c.start)}</span>
                  <span>{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    ) : null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="bg-ink relative overflow-hidden rounded-lg">
        <video
          ref={video}
          src={src}
          poster={poster ?? undefined}
          controls
          playsInline
          autoPlay={autoPlay}
          preload="metadata"
          onTimeUpdate={onTimeUpdate}
          onEnded={() => {
            beacon(100, video.current?.duration ?? 0);
            setEnded(true);
          }}
          onPlay={() => setEnded(false)}
          className="aspect-video w-full"
        />
        {ended && endCard ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center text-white">
            {endCard}
            <button
              type="button"
              onClick={() => video.current?.play()}
              className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
            >
              <RotateCcw className="size-4" /> Watch again
            </button>
          </div>
        ) : null}
      </div>
      {aside ? (
        // Desktop: `aside` is a sticky column beside the intro and the rest. Phones: intro, aside, rest.
        <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-4">
            {below}
            {chapterList}
          </div>
          <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">{aside}</div>
          {children ? <div className="flex min-w-0 flex-col gap-8">{children}</div> : null}
        </div>
      ) : (
        <>
          {below}
          {chapterList}
          {children}
        </>
      )}
    </div>
  );
}
