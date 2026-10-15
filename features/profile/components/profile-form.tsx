'use client';

import { Download, Plus, Star, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  importFromUpwork,
  parseProfileJson,
  saveProfile,
  uploadProfilePhoto,
} from '@/features/profile/profile-actions';
import { UPWORK_PROFILE_PROMPT } from '@/features/profile/profile-shape';
import { CopyButton } from '@/features/video/components/copy-button';
import type { Experience, Profile } from '@/features/profile/profile-queries';

const splitList = (s: string) =>
  s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
const EMPTY: Experience = { title: '', org: '', period: '', summary: '' };
const BADGES = ['', 'Rising Talent', 'Top Rated', 'Top Rated Plus', 'Expert-Vetted'];
const STATS = [
  { key: 'jobSuccess', label: 'Job success %', step: 1 },
  { key: 'rating', label: 'Rating (0–5)', step: 0.1 },
  { key: 'reviewCount', label: 'Reviews', step: 1 },
  { key: 'totalJobs', label: 'Total jobs', step: 1 },
  { key: 'totalHours', label: 'Total hours', step: 1 },
] as const;

export function ProfileForm({ profile }: { profile: Profile }) {
  const [p, setP] = useState(profile);
  const [skills, setSkills] = useState(profile.skills.join(', '));
  const [pending, startTransition] = useTransition();
  const [importing, startImport] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [pasted, setPasted] = useState('');
  const set = (patch: Partial<Profile>) => setP(prev => ({ ...prev, ...patch }));
  const setExp = (i: number, patch: Partial<Experience>) =>
    set({ experiences: p.experiences.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  /** Fill the form from an imported draft; nothing is saved until "Save profile". */
  function fill(load: () => Promise<{ ok: true; profile: Profile } | { ok: false; error: string }>) {
    startImport(async () => {
      const res = await load();
      if (!res.ok) return void toast.error(res.error);
      // Keep what Upwork didn't have (e.g. a photo pasted by hand).
      const next = res.profile;
      setP(prev => ({
        ...next,
        photoUrl: next.photoUrl || prev.photoUrl,
        profileUrl: next.profileUrl || prev.profileUrl,
      }));
      setSkills(next.skills.join(', '));
      setPasted('');
      toast.success('Imported. Check it, then Save profile.');
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={e => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveProfile({ ...p, skills: splitList(skills) });
          if (res.ok) {
            set({ photoUrl: res.photoUrl });
            toast.success('Profile saved. Share pages show it now.');
          } else toast.error(res.error);
        });
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => fill(importFromUpwork)} disabled={importing}>
          <Download /> {importing ? 'Importing…' : 'Import from Upwork'}
        </Button>
        <p className="text-muted-foreground text-sm">
          Fills profile, experience, certifications and reviews. Nothing is public until you save.
        </p>
      </div>
      <details className="uw-card group">
        <summary className="cursor-pointer font-medium select-none">Import with Claude or Codex</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            1. Copy this prompt into Claude, Codex or any assistant where the Upwork MCP is connected. 2. Paste its JSON
            reply below.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={UPWORK_PROFILE_PROMPT} label="Copy prompt" variant="secondary" />
          </div>
          <Textarea
            aria-label="Assistant reply (JSON)"
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            rows={5}
            className="font-mono text-xs"
            placeholder='{"name": "…", "headline": "…", …}'
          />
          <Button
            variant="primary"
            className="self-start"
            onClick={() => fill(() => parseProfileJson(pasted))}
            disabled={importing || !pasted.trim()}
          >
            Fill form
          </Button>
        </div>
      </details>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            value={p.name}
            onChange={e => set({ name: e.target.value })}
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label htmlFor="profile-headline">Headline</label>
          <input
            id="profile-headline"
            value={p.headline}
            onChange={e => set({ headline: e.target.value })}
            placeholder="AI engineer · automations & chatbots"
          />
        </div>
        <div>
          <label htmlFor="profile-photo">Photo</label>
          <div className="flex items-center gap-2">
            {p.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview of whatever link/upload is set
              <img src={p.photoUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            ) : null}
            <input
              id="profile-photo"
              value={p.photoUrl}
              onChange={e => set({ photoUrl: e.target.value })}
              placeholder="Paste an image link, or upload"
            />
            <label className="uw-token uw-token--btn shrink-0 cursor-pointer">
              {uploading ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Upload photo"
                disabled={uploading}
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  const form = new FormData();
                  form.set('photo', file);
                  startUpload(async () => {
                    const res = await uploadProfilePhoto(form);
                    if (!res.ok) return void toast.error(res.error);
                    set({ photoUrl: res.url });
                    toast.success('Photo uploaded. Save profile to use it.');
                  });
                }}
              />
            </label>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Links are copied on save, so expiring Upwork photo links keep working.
          </p>
        </div>
        <div>
          <label htmlFor="profile-url">Upwork profile URL</label>
          <input
            id="profile-url"
            type="url"
            value={p.profileUrl}
            onChange={e => set({ profileUrl: e.target.value })}
            placeholder="https://www.upwork.com/freelancers/~01…"
          />
        </div>
      </div>
      <div>
        <label htmlFor="profile-bio">About you</label>
        <Textarea
          id="profile-bio"
          value={p.bio}
          onChange={e => set({ bio: e.target.value })}
          rows={4}
          placeholder="Two or three lines on what you do and for whom."
        />
      </div>
      <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <legend className="mb-2 font-medium">Upwork stats</legend>
        <div>
          <label htmlFor="profile-badge">Badge</label>
          <select id="profile-badge" value={p.badge} onChange={e => set({ badge: e.target.value })}>
            {[...new Set([...BADGES, p.badge])].map(b => (
              <option key={b} value={b}>
                {b || 'None'}
              </option>
            ))}
          </select>
        </div>
        {STATS.map(({ key, label, step }) => (
          <div key={key}>
            <label htmlFor={`profile-${key}`}>{label}</label>
            <input
              id={`profile-${key}`}
              type="number"
              min={0}
              step={step}
              value={p[key] ?? ''}
              onChange={e => set({ [key]: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
        ))}
        <div>
          <label htmlFor="profile-earned">Earned</label>
          <input
            id="profile-earned"
            value={p.totalEarned}
            onChange={e => set({ totalEarned: e.target.value })}
            placeholder="$2K+"
          />
        </div>
      </fieldset>
      <div>
        <label htmlFor="profile-skills">Skills (comma-separated)</label>
        <input
          id="profile-skills"
          value={skills}
          onChange={e => setSkills(e.target.value)}
          placeholder="Vue, Nuxt, OpenAI, n8n"
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">Experience</legend>
        {p.experiences.map((x, i) => (
          <div key={i} className="uw-card flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                aria-label="Role"
                value={x.title}
                onChange={e => setExp(i, { title: e.target.value })}
                placeholder="Role or project"
              />
              <input
                aria-label="Company or client"
                value={x.org}
                onChange={e => setExp(i, { org: e.target.value })}
                placeholder="Company or client"
              />
              <input
                aria-label="Period"
                value={x.period}
                onChange={e => setExp(i, { period: e.target.value })}
                placeholder="2022 – now"
              />
            </div>
            <Textarea
              aria-label="What you did"
              value={x.summary}
              onChange={e => setExp(i, { summary: e.target.value })}
              rows={2}
              placeholder="One or two lines: what you built and the result."
            />
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => set({ experiences: p.experiences.filter((_, j) => j !== i) })}
            >
              <Trash2 /> Remove
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => set({ experiences: [...p.experiences, EMPTY] })}
        >
          <Plus /> Add experience
        </Button>
      </fieldset>

      {p.certifications.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Certifications</legend>
          {p.certifications.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {c.name}
                <span className="text-muted-foreground">{[c.issuer, c.date].filter(Boolean).map(x => ` · ${x}`)}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${c.name}`}
                onClick={() => set({ certifications: p.certifications.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </fieldset>
      ) : null}

      {p.reviews.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Client reviews</legend>
          {p.reviews.map((r, i) => (
            <div key={i} className="uw-card flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.rating !== null ? (
                    <span className="mr-2 inline-flex items-center gap-1">
                      <Star className="size-3.5 fill-current" aria-hidden /> {r.rating.toFixed(1)}
                    </span>
                  ) : null}
                  {r.title}
                </p>
                <p className="line-clamp-2">{r.text}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove review"
                onClick={() => set({ reviews: p.reviews.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </fieldset>
      ) : null}

      <Button type="submit" variant="primary" className="self-start" disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}
