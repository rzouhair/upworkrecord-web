import { Eye } from 'lucide-react';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/features/video/types/video';
import { getInsights } from '@/features/video/video-queries';

function host(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function device(ua: string | null) {
  if (!ua) return 'Unknown';
  if (/bot|crawl|spider|preview|facebookexternalhit|slack/i.test(ua)) return 'Link preview bot';
  const os = /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : 'Other';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${browser} · ${os}`;
}

export async function InsightsPanel({ videoId }: { videoId: string }) {
  const { viewers, uniqueViewers, avgPercent, completed } = await getInsights(videoId);

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: 'Viewers', value: uniqueViewers },
          { label: 'Avg. watched', value: `${avgPercent}%` },
          { label: 'Finished', value: completed },
        ].map(s => (
          <div key={s.label} className="uw-card uw-card--muted p-4!">
            <dt className="text-muted-foreground text-sm">{s.label}</dt>
            <dd className="mt-1 text-[length:var(--font-size-h4)] font-[550]">{s.value}</dd>
          </div>
        ))}
      </dl>

      {viewers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Eye className="text-muted-foreground size-6" />
          <p className="text-sm font-medium">No views yet</p>
          <p className="text-muted-foreground max-w-xs text-sm">When a client opens the link you&apos;ll see it here. Your own views aren&apos;t counted.</p>
        </div>
      ) : (
        <ul className="divide-divider flex flex-col divide-y">
          {viewers.map((v, i) => (
            <li key={v.id} className="flex items-center gap-3 py-3 text-sm">
              <span className="bg-muted-foreground/15 text-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                {viewers.length - i}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{device(v.userAgent)}</p>
                <p className="text-muted-foreground truncate text-xs">
                  <RelativeTime iso={v.lastSeen} /> · watched {formatDuration(v.watchedSec)}
                  {v.referrer ? ` · from ${host(v.referrer)}` : ''}
                </p>
              </div>
              <div className="flex w-24 flex-col items-end gap-1">
                <span className="text-sm font-medium">{v.maxPercent}%</span>
                <span className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <span className="bg-brand-fill block h-full" style={{ width: `${v.maxPercent}%` }} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InsightsPanelSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
