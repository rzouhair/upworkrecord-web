'use client';

import { useOptimistic, useTransition, ViewTransition } from 'react';
import { PrefetchLink } from '@/components/ui/prefetch-link';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Route } from 'next';

type Tab<T extends string> = { label: string; value: T; href: Route };

export function Tabs<T extends string>({
  tabs,
  active,
  label = 'Sections',
  indicatorName = 'tab-indicator',
}: {
  tabs: Tab<T>[];
  active: T;
  label?: string;
  indicatorName?: string;
}) {
  const [optimisticActive, setOptimisticActive] = useOptimistic(active);
  const [isPending, startTransition] = useTransition();

  return (
    <nav
      aria-label={label}
      data-pending={isPending ? '' : undefined}
      // Air 3 underline tabs (.uw-tabs): 16px/500, light → ink, 2px ink underline.
      className="border-divider flex gap-6 overflow-x-auto border-b px-5"
    >
      {tabs.map(t => {
        const isActive = optimisticActive === t.value;
        return (
          <PrefetchLink
            key={t.value}
            href={t.href}
            scroll={false}
            onNavigate={() => {
              if (t.value === optimisticActive) return;
              startTransition(() => setOptimisticActive(t.value));
            }}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex h-11 shrink-0 items-center text-base font-medium whitespace-nowrap no-underline transition-colors',
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {active === t.value ? (
              <ViewTransition name={indicatorName} share="tab-underline">
                <span aria-hidden className="bg-foreground absolute inset-x-0 -bottom-px h-0.5" />
              </ViewTransition>
            ) : null}
          </PrefetchLink>
        );
      })}
    </nav>
  );
}

export function TabsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div aria-hidden className="border-divider flex gap-6 border-b px-5">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="flex h-11 items-center">
          <Skeleton className="h-5 w-16 rounded" />
        </span>
      ))}
    </div>
  );
}
