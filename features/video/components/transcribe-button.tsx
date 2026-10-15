'use client';

import { AudioLines } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { transcribeVideo } from '@/features/video/video-actions';

/** Server-side transcription; also rewrites the summary and chapters. Takes ~10–60s. */
export function TranscribeButton({ videoId, redo }: { videoId: string; redo: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant={redo ? 'tertiary' : 'primary'}
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await transcribeVideo(videoId);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Transcribed ${res.words} words. Summary and chapters updated.`);
          router.refresh();
        })
      }
    >
      <AudioLines /> {pending ? 'Transcribing…' : redo ? 'Re-transcribe' : 'Transcribe'}
    </Button>
  );
}
