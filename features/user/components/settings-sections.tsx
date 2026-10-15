import { Skeleton } from '@/components/ui/skeleton';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { getProfile } from '@/features/profile/profile-queries';
import { TemplateList } from '@/features/proposal/components/template-editor';
import { getTemplates } from '@/features/proposal/proposal-queries';
import { ApiAccess } from '@/features/user/components/api-access';
import { verifyAuth } from '@/lib/auth';
import { appUrl } from '@/lib/http';

export async function ApiAccessSection() {
  await verifyAuth();
  return <ApiAccess baseUrl={appUrl()} token={process.env.API_TOKEN ?? ''} />;
}

export async function ProfileSection() {
  await verifyAuth();
  return <ProfileForm profile={await getProfile()} />;
}

export async function TemplatesSection() {
  return <TemplateList templates={await getTemplates()} />;
}

export function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
