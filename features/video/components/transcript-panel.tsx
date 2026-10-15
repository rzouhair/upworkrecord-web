import { FileText } from 'lucide-react';
import { TranscribeButton } from '@/features/video/components/transcribe-button';
import { formatDuration, type Video } from '@/features/video/types/video';

export function TranscriptPanel({ video }: { video: Video }) {
  if (!video.transcriptText && video.chapters.length === 0 && !video.summary) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <FileText className="text-muted-foreground size-6" />
        <p className="text-sm font-medium">No transcript yet</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          Mac app recordings arrive transcribed. For uploaded files, transcribe here: it also writes the summary and
          chapters.
        </p>
        <TranscribeButton videoId={video.id} redo={false} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <TranscribeButton videoId={video.id} redo />
      </div>
      {video.summary ? (
        <section>
          <h3 className="mb-1">Summary</h3>
          <p className="text-sm leading-relaxed">{video.summary}</p>
        </section>
      ) : null}
      {video.chapters.length > 0 ? (
        <section>
          <h3 className="mb-2">Chapters</h3>
          <ol className="flex flex-col gap-1 text-sm">
            {video.chapters.map(c => (
              <li key={`${c.start}-${c.title}`} className="flex gap-3">
                <span className="text-brand font-medium tabular-nums">{formatDuration(c.start)}</span>
                {c.title}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {video.transcriptText ? (
        <section>
          <h3 className="mb-1">Transcript</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{video.transcriptText}</p>
        </section>
      ) : null}
    </div>
  );
}
