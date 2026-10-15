'use client';

import { AlertTriangle } from 'lucide-react';
import { catchError, type ErrorInfo } from 'next/error';
import { Button } from '@/components/ui/button';

function ErrorFallback({ title, compact }: { title?: string; compact?: boolean }, { retry }: ErrorInfo) {
  return (
    <div
      className={
        compact
          ? 'flex flex-col items-center gap-2 px-4 py-4 text-center'
          : 'flex flex-col items-center gap-3 px-5 py-10 text-center'
      }
    >
      <AlertTriangle className={compact ? 'text-danger h-4 w-4' : 'text-danger h-6 w-6'} />
      <p className="text-sm font-medium text-foreground">{title ?? 'Something went wrong'}</p>
      <Button size="sm" variant="tertiary" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}

export default catchError(ErrorFallback);
