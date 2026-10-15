'use client';

import * as Ariakit from '@ariakit/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CircularLoader } from '@/components/ui/loader';
import type { ReactElement } from 'react';

export function ConfirmDialog({
  trigger,
  title,
  body,
  confirmLabel = 'Confirm',
  confirmAction,
}: {
  /** A single element (e.g. <Button>); it becomes the dialog disclosure, no wrapper. */
  trigger: ReactElement;
  title: string;
  body?: string;
  confirmLabel?: string;
  confirmAction: () => Promise<void>;
}) {
  const dialog = Ariakit.useDialogStore();
  const [pending, setPending] = useState(false);

  return (
    <>
      <Ariakit.DialogDisclosure store={dialog} render={trigger} />
      <Ariakit.Dialog
        store={dialog}
        backdrop={<div className="bg-ink/60 fixed inset-0 z-50" style={{ viewTransitionName: 'none' }} />}
        className="shadow-pop bg-background fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg p-6"
        style={{ viewTransitionName: 'none' }}
      >
        <Ariakit.DialogHeading className="text-[length:var(--font-size-h5)] font-[550]">{title}</Ariakit.DialogHeading>
        {body ? <p className="text-muted-foreground mt-2 text-sm">{body}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <Ariakit.DialogDismiss
            render={
              <Button variant="tertiary">
                Cancel
              </Button>
            }
          />
          <Button
            variant="danger"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await confirmAction();
                dialog.hide();
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <CircularLoader className="size-3.5 border-current" />}
            {confirmLabel}
          </Button>
        </div>
      </Ariakit.Dialog>
    </>
  );
}
