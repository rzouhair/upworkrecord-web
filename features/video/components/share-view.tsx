import { Logo } from '@/components/logo';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hasProfile, ProfileCard, ProfileDetails, ProofBadges } from '@/features/profile/components/profile-card';
import { getProfile } from '@/features/profile/profile-queries';
import { VideoPlayer } from '@/features/video/components/video-player';
import { formatDuration } from '@/features/video/types/video';
import { getPublicVideo } from '@/features/video/video-queries';

export async function ShareView({ slug }: { slug: string }) {
  const [video, profile] = await Promise.all([getPublicVideo(slug), getProfile()]);
  const about = video.description || video.summary;
  const showProfile = hasProfile(profile);
  const client = video.clientName?.trim() ?? '';
  const firstName = profile.name.split(/\s+/)[0];
  // The greeting already names the client; the owner-facing "For Chris:" prefix would repeat it.
  const title = client ? video.title.replace(/^For [^:]{1,60}:\s*/, '') : video.title;
  const upwork = profile.profileUrl ? (
    <Button variant="primary" size="lg" asChild>
      <a href={profile.profileUrl} target="_blank" rel="noreferrer">
        View my Upwork profile <ExternalLink />
      </a>
    </Button>
  ) : null;

  const transcript = video.transcriptText ? (
    <details className="uw-card group p-4!">
      <summary className="cursor-pointer font-medium select-none">Transcript</summary>
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{video.transcriptText}</p>
    </details>
  ) : null;

  return (
    <article className="flex flex-col gap-6">
      {/* Personal intro, Loom-style: who recorded this, for whom, and one line of proof.
          Phones: photo + greeting, then badges full width. Wider: photo spans both lines. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-2">
        {profile.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- any external host; avatar
          <img src={profile.photoUrl} alt="" className="size-12 rounded-full object-cover sm:row-span-2" />
        ) : null}
        <p className={`leading-snug sm:text-lg ${profile.photoUrl ? '' : 'col-span-2'}`}>
          <span className="block text-lg font-medium sm:inline">Hi {client || 'there'} 👋</span>{' '}
          <span className="text-muted-foreground">
            {firstName ? `I'm ${firstName}, and I` : 'I'} recorded this {formatDuration(video.durationSec)} video for
            you.
          </span>
        </p>
        <ProofBadges
          profile={profile}
          className={`col-span-2 ${profile.photoUrl ? 'sm:col-span-1 sm:col-start-2' : ''}`}
        />
      </div>

      <VideoPlayer
        src={video.videoUrl}
        poster={video.posterUrl}
        chapters={video.chapters}
        beaconSlug={video.slug}
        below={
          <header className="flex max-w-3xl flex-col gap-2 pt-2">
            <h1 className="lg:text-[length:var(--font-size-h2)] lg:leading-[var(--line-height-h2)]">{title}</h1>
            {about ? <p className="text-muted-foreground leading-relaxed">{about}</p> : null}
          </header>
        }
        aside={showProfile ? <ProfileCard profile={profile} /> : null}
        endCard={
          <>
            <p className="text-2xl font-medium">Thanks for watching{client ? `, ${client}` : ''}!</p>
            <p className="max-w-md text-white/80">
              If this looks right for your project, reply to my proposal on Upwork and we can get started.
            </p>
            {upwork}
          </>
        }
      >
        {video.pitch ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg">Why I&apos;m a fit</h2>
            <p className="max-w-3xl whitespace-pre-line">{video.pitch}</p>
          </section>
        ) : null}
        {transcript}
        {showProfile ? <ProfileDetails profile={profile} /> : null}
      </VideoPlayer>
    </article>
  );
}

/** Sticky bar: logo, plus the hire link so it stays one click away while scrolling. */
export async function ShareHeader() {
  const profile = await getProfile();
  return (
    <header className="border-divider bg-background sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
        <Logo />
        {profile.profileUrl ? (
          <Button variant="secondary" size="sm" asChild>
            <a href={profile.profileUrl} target="_blank" rel="noreferrer">
              {profile.name ? `${profile.name.split(/\s+/)[0]} on Upwork` : 'Upwork profile'} <ExternalLink />
            </a>
          </Button>
        ) : null}
      </div>
    </header>
  );
}

export function ShareViewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <Skeleton className="aspect-video w-full rounded-lg" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
}
