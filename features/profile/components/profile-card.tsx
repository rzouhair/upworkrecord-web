import { Award, Crown, ExternalLink, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/features/profile/profile-queries';

export const hasProfile = (p: Profile) => !!(p.name || p.headline || p.bio || p.reviews.length);

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-brand inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`size-4 ${rating >= n - 0.25 ? 'fill-current' : 'opacity-30'}`} aria-hidden />
      ))}
    </span>
  );
}

function Avatar({ p }: { p: Profile }) {
  const initials = p.name
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  // Upwork portraits come with the purple ring baked in; only the initials fallback draws one.
  return p.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- any external host; avatar
    <img src={p.photoUrl} alt="" className="size-28 rounded-full object-cover" />
  ) : (
    <span className="bg-muted flex size-28 items-center justify-center rounded-full text-3xl font-medium ring-4 ring-violet-600">
      {initials || '?'}
    </span>
  );
}

const HEXAGON =
  'M12 1.155a4 4 0 014 0l8.124 4.69a4 4 0 012 3.464v9.382a4 4 0 01-2 3.464L16 26.845a4 4 0 01-4 0l-8.124-4.69a4 4 0 01-2-3.464V9.309a4 4 0 012-3.464L12 1.155z';

/** Upwork's badge icons (28×28): hexagon fill + white glyph strokes. Keyed by lowercase letters only. */
const BADGES: Record<string, { fill: string; glyph: string[] }> = {
  risingtalent: { fill: '#14A800', glyph: ['M13.65 20V8m5.17 4.985L13.65 8l-4.984 4.985'] },
  toprated: {
    fill: '#1F57C3',
    glyph: [
      'M14.761 7.542l1.188 3.201 3.285.184a.78.78 0 01.448.173c.13.104.226.247.277.41a.9.9 0 01.01.504.858.858 0 01-.261.422L17.15 14.6l.854 3.328a.907.907 0 01-.025.507.857.857 0 01-.291.404.785.785 0 01-.919.02L14 16.984l-2.764 1.862a.784.784 0 01-.916-.012.855.855 0 01-.294-.4.906.906 0 01-.031-.505l.847-3.314-2.55-2.18a.858.858 0 01-.26-.421.9.9 0 01.01-.504.853.853 0 01.276-.41.782.782 0 01.448-.173l3.285-.184 1.188-3.201a.86.86 0 01.302-.394.79.79 0 01.918 0 .86.86 0 01.302.394z',
    ],
  },
  topratedplus: {
    fill: '#F66DBC',
    glyph: [
      'M17.94 18.396c.2.73-.597 1.262-1.195.863l-2.723-1.793-2.724 1.793c-.598.399-1.395-.199-1.196-.863l.731-3.122-2.524-2.06c-.598-.465-.266-1.395.465-1.46l3.255-.2 1.196-3.056c.265-.664 1.262-.664 1.527 0l1.196 3.056m1.662.199v4.65M20 14.078h-4.65',
    ],
  },
  expertvetted: {
    fill: '#DEBE1A',
    glyph: ['M19.381 18.334H9.199', 'M19.304 15.825h-9.94L7.334 10.3l3.882 1.319 3.118-3.952 3.118 3.952 3.882-1.32-2.03 5.526z'],
  },
};

function BadgeIcon({ badge }: { badge: string }) {
  const icon = BADGES[badge.toLowerCase().replace(/[^a-z]/g, '')];
  if (!icon) return <Award className="size-6 text-pink-600" aria-hidden />;
  return (
    <svg viewBox="0 0 28 28" fill="none" className="size-6" aria-hidden>
      <path fill={icon.fill} d={HEXAGON} />
      {icon.glyph.map(d => (
        <path key={d} d={d} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** Job Success · badge · rating, as Upwork shows them. Nothing when the profile has none. */
export function ProofBadges({ profile: p, className = '' }: { profile: Profile; className?: string }) {
  const rated = p.reviews.filter(r => r.rating !== null);
  const rating = p.rating ?? (rated.length ? rated.reduce((sum, r) => sum + r.rating!, 0) / rated.length : null);
  const reviewCount = p.reviewCount ?? rated.length;
  if (p.jobSuccess === null && !p.badge && rating === null) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${className}`}>
      {p.jobSuccess !== null ? (
        <li className="flex items-center gap-1.5" title="Job Success Score">
          <span className="flex size-6 items-center justify-center rounded-full border-2 border-blue-600 text-blue-600">
            <Crown className="size-3.5" aria-hidden />
          </span>
          <span className="font-medium">{p.jobSuccess}%</span>
          <span className="sr-only">Job Success</span>
        </li>
      ) : null}
      {p.badge ? (
        <li className="flex items-center gap-1.5">
          <BadgeIcon badge={p.badge} />
          <span className="font-medium">{p.badge}</span>
        </li>
      ) : null}
      {rating !== null ? (
        <li className="flex items-center gap-1.5">
          <Star className="size-5 fill-amber-400 text-amber-400" aria-hidden />
          <span className="font-medium">{rating.toFixed(1)}</span>
          {reviewCount ? <span className="text-muted-foreground">({reviewCount})</span> : null}
          <span className="sr-only">rating{reviewCount ? ` from ${reviewCount} reviews` : ''}</span>
        </li>
      ) : null}
    </ul>
  );
}

/** Upwork-style card: photo, name, headline, JSS · badge · rating, stat tiles, hire link, skills. */
export function ProfileCard({ profile: p }: { profile: Profile }) {
  const tiles = [
    { value: p.totalJobs, label: 'Total jobs' },
    { value: p.totalHours, label: 'Total hours' },
    { value: p.totalEarned || null, label: 'Earned' },
  ].filter(t => t.value !== null);

  return (
    <aside className="uw-card flex flex-col items-center gap-4 text-center" aria-label="About the freelancer">
      <Avatar p={p} />
      <div className="flex flex-col gap-1">
        {p.name ? <p className="text-2xl font-medium">{p.name}</p> : null}
        {p.headline ? <p className="text-muted-foreground">{p.headline}</p> : null}
      </div>

      <ProofBadges profile={p} className="justify-center" />

      {tiles.length ? (
        <dl className="grid w-full gap-3" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
          {tiles.map(t => (
            <div key={t.label} className="bg-muted flex flex-col-reverse rounded-lg px-1 py-3">
              <dt className="text-muted-foreground text-sm">{t.label}</dt>
              <dd className="text-2xl font-medium">{t.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {p.profileUrl ? (
        <Button variant="primary" size="lg" className="w-full" asChild>
          <a href={p.profileUrl} target="_blank" rel="noreferrer">
            View my Upwork profile <ExternalLink />
          </a>
        </Button>
      ) : null}

      {p.skills.length ? (
        <ul className="flex flex-wrap justify-center gap-2" aria-label="Skills">
          {p.skills.map(s => (
            <li key={s} className="uw-token">
              {s}
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

/** Bio + experience under the video, for clients who want more before replying. */
export function ProfileDetails({ profile: p }: { profile: Profile }) {
  if (!p.bio && !p.experiences.length && !p.reviews.length && !p.certifications.length) return null;
  return (
    <section className="flex flex-col gap-8">
      {p.reviews.length ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg">What clients say</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {p.reviews.slice(0, 6).map((r, i) => (
              <li key={i} className="uw-card flex flex-col gap-2">
                {r.rating !== null ? <Stars rating={r.rating} /> : null}
                <blockquote className="text-sm leading-relaxed">&ldquo;{r.text}&rdquo;</blockquote>
                {r.title || r.client || r.date ? (
                  <p className="text-muted-foreground mt-auto text-xs">
                    {[r.title, r.client, r.date].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {p.bio ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg">About {p.name ? p.name.split(/\s+/)[0] : 'me'}</h2>
          <p className="max-w-3xl whitespace-pre-line">{p.bio}</p>
        </div>
      ) : null}
      {p.experiences.length ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg">Experience</h2>
          <ol className="flex flex-col gap-4">
            {p.experiences.map((x, i) => (
              <li key={i} className="border-divider border-l-2 pl-4">
                <p className="font-medium">
                  {x.title}
                  {x.org ? <span className="text-muted-foreground font-normal"> · {x.org}</span> : null}
                </p>
                {x.period ? <p className="text-muted-foreground text-sm">{x.period}</p> : null}
                {x.summary ? <p className="mt-1 text-sm">{x.summary}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {p.certifications.length ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg">Certifications</h2>
          <ul className="flex flex-col gap-2">
            {p.certifications.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <Award className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {c.name}
                  {c.issuer || c.date ? (
                    <span className="text-muted-foreground text-sm">
                      {' '}
                      · {[c.issuer, c.date].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
