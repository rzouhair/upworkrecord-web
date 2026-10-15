'use client';

import * as Ariakit from '@ariakit/react';
import { Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { uploadVideo, type UploadProgress } from '@/features/video/video-upload';
import { useFileInput } from '@/hooks/use-file-input';
import { cn } from '@/lib/utils';
import type { Route } from 'next';

const ACCEPT = 'video/mp4,video/quicktime,video/webm';

export function UploadButton({ label = 'Upload video', size = 'default' }: { label?: string; size?: 'default' | 'lg' }) {
  const dialog = Ariakit.useDialogStore();
  const router = useRouter();
  const abort = useRef<AbortController | null>(null);
  const [attachPicker, openPicker] = useFileInput(f => start(f));
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const busy = progress !== null;

  function reset() {
    setFile(null);
    setProgress(null);
    abort.current = null;
  }

  async function start(f: File) {
    if (!ACCEPT.split(',').includes(f.type)) {
      toast.error('Use an MP4, MOV or WebM video');
      return;
    }
    setFile(f);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const { videoId } = await uploadVideo(f, setProgress, controller.signal);
      toast.success('Video uploaded');
      dialog.hide();
      reset();
      router.push(`/videos/${videoId}` as Route);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error((e as Error).message);
      reset();
    }
  }

  const percent = progress ? Math.round((progress.loaded / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <>
      <Button variant="primary" size={size} onClick={dialog.show}>
        <Upload />
        {label}
      </Button>
      <Ariakit.Dialog
        store={dialog}
        hideOnInteractOutside={!busy}
        hideOnEscape={!busy}
        backdrop={<div className="bg-ink/60 fixed inset-0 z-50" style={{ viewTransitionName: 'none' }} />}
        className="shadow-pop bg-background fixed top-1/2 left-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg p-6"
        style={{ viewTransitionName: 'none' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <Ariakit.DialogHeading className="text-[length:var(--font-size-h5)] font-[550]">Upload a video</Ariakit.DialogHeading>
          {!busy ? (
            <Ariakit.DialogDismiss className="uw-btn uw-btn--circle uw-btn--sm" aria-label="Close">
              <X className="size-4" />
            </Ariakit.DialogDismiss>
          ) : null}
        </div>

        {busy && file ? (
          <div className="flex flex-col gap-3" aria-live="polite">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <div
              className="bg-muted h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            >
              <div className="bg-brand-fill h-full transition-[width] duration-200" style={{ width: `${percent}%` }} />
            </div>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>
                {progress.phase === 'preparing' ? 'Reading video…' : progress.phase === 'finishing' ? 'Finishing…' : `${percent}%`}
              </span>
              <span>
                {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
              </span>
            </div>
            <Button variant="tertiary" className="self-end" onClick={() => abort.current?.abort()} disabled={progress.phase === 'finishing'}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            onDragOver={e => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) start(f);
            }}
            className={cn(
              'flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-input px-6 py-12 text-center transition-colors',
              dragging ? 'border-brand bg-brand-fade' : 'hover:border-foreground',
            )}
          >
            <span className="bg-brand-fade text-brand flex size-12 items-center justify-center rounded-full">
              <Upload className="size-5" />
            </span>
            <span className="text-base font-medium">Drop a video here or click to browse</span>
            <span className="text-muted-foreground text-sm">MP4, MOV or WebM · up to 5 GB</span>
          </button>
        )}
        <input ref={attachPicker} type="file" accept={ACCEPT} className="hidden" aria-label="Choose video file" />
      </Ariakit.Dialog>
    </>
  );
}

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
