import { cn } from '@/lib/utils';

/** Air 3 shimmer (`.uw-skeleton`, loader tokens). */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('uw-skeleton', className)} />;
}
