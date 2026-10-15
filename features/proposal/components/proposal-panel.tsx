import { Skeleton } from '@/components/ui/skeleton';
import { ProposalForm } from '@/features/proposal/components/proposal-form';
import { getProposal, getTemplates } from '@/features/proposal/proposal-queries';
import { getVideo } from '@/features/video/video-queries';

export async function ProposalPanel({ videoId }: { videoId: string }) {
  const [proposal, templates, video] = await Promise.all([getProposal(videoId), getTemplates(), getVideo(videoId)]);
  return <ProposalForm videoId={videoId} proposal={proposal} templates={templates} pitch={video.pitch} />;
}

export function ProposalPanelSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
