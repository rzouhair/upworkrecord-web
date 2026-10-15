import { cn } from '@/lib/utils';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2 font-[550]', className)}>
      <span className="bg-brand-fill flex size-7 shrink-0 items-center justify-center rounded-full">
        <span className="size-2.5 rounded-full bg-background" />
      </span>
      {compact ? null : (
        <span className="text-lg tracking-[0.36px]">
          Upwork<span className="text-brand">Record</span>
        </span>
      )}
    </span>
  );
}
