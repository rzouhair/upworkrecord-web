'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
      <AlertTriangle className="text-danger h-8 w-8" />
      <h1>Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-sm">{error.message}</p>
      <Button size="sm" variant="tertiary" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
