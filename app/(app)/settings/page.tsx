import { Suspense } from 'react';
import { UpworkSection, UpworkSectionSkeleton } from '@/features/upwork/components/upwork-section';
import { ApiAccessSection, ProfileSection, SectionSkeleton, TemplatesSection } from '@/features/user/components/settings-sections';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage({ searchParams }: PageProps<'/settings'>) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-8 sm:px-8">
      <h1>Settings</h1>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg">Mac app connection</h2>
          <p className="text-muted-foreground text-sm">Paste these into the UpworkRecord Mac app so recordings upload here.</p>
        </div>
        <Suspense fallback={<SectionSkeleton />}>
          <ApiAccessSection />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg">Public profile</h2>
          <p className="text-muted-foreground text-sm">Shown next to every shared video, so clients see who they&apos;d hire.</p>
        </div>
        <Suspense fallback={<SectionSkeleton />}>
          <ProfileSection />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2>Upwork</h2>
          <p className="text-muted-foreground text-sm">Your profile, reviews, stats and proposals, read through Upwork&apos;s MCP.</p>
        </div>
        <Suspense fallback={<UpworkSectionSkeleton />}>
          {searchParams.then(sp => (
            <UpworkSection
              notice={typeof sp.upwork === 'string' ? sp.upwork : undefined}
              error={typeof sp.upwork_error === 'string' ? sp.upwork_error : undefined}
            />
          ))}
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg">Proposal prompts</h2>
          <p className="text-muted-foreground text-sm">The default template is picked first on every video&apos;s Proposal tab.</p>
        </div>
        <Suspense fallback={<SectionSkeleton />}>
          <TemplatesSection />
        </Suspense>
      </section>
    </div>
  );
}
