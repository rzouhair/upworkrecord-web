import { Film } from 'lucide-react';
import { ShareHeader } from '@/features/video/components/share-view';

export default function VideoNotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <ShareHeader />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
        <Film className="text-muted-foreground size-8" />
        <h1 className="text-xl">This video isn&apos;t available</h1>
        <p className="text-muted-foreground text-sm">It may have been deleted, or it&apos;s still uploading.</p>
      </div>
    </div>
  );
}
