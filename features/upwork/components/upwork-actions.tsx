'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { disconnectUpwork, refreshUpworkTools } from '@/features/upwork/upwork-actions';

export function UpworkActions() {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="tertiary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await refreshUpworkTools();
            if (res.ok) toast.success(`${res.count} tools`);
            else toast.error(res.error);
          })
        }
      >
        {pending ? 'Checking…' : 'Refresh tools'}
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="sm" className="text-danger">
            Disconnect
          </Button>
        }
        title="Disconnect Upwork?"
        body="Stored tokens are deleted. You can reconnect any time."
        confirmLabel="Disconnect"
        confirmAction={disconnectUpwork}
      />
    </div>
  );
}
