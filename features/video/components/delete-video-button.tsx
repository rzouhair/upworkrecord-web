'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { deleteVideo } from '@/features/video/video-actions';

/** `compact`: icon-only trigger for library tiles; stays on the page (updateTag refreshes the grid). */
export function DeleteVideoButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        compact ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete video"
            className="bg-ink/70! hover:bg-ink/90! absolute top-2 right-2 text-white opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
          >
            <Trash2 />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="text-danger">
            <Trash2 /> Delete
          </Button>
        )
      }
      title="Delete this video?"
      body="The share link stops working and the file is removed from storage. This can't be undone."
      confirmLabel="Delete video"
      confirmAction={async () => {
        const res = await deleteVideo(id);
        if (!res.ok) return void toast.error(res.error);
        toast.success('Video deleted');
        if (!compact) router.push('/');
      }}
    />
  );
}
