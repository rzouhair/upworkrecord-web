'use client';

import { useSyncExternalStore } from 'react';
import { formatRelativeTime } from '@/lib/utils';

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

function getSnapshot() {
  return Math.floor(Date.now() / 60_000);
}

function getServerSnapshot() {
  return 0;
}

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const minute = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {minute === 0 ? new Date(iso).toISOString().slice(0, 10) : formatRelativeTime(iso, minute * 60_000)}
    </time>
  );
}
