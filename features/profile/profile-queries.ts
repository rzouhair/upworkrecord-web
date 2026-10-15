import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';
import { prisma } from '@/lib/db';

export type Experience = { title: string; org: string; period: string; summary: string };
export type Certification = { name: string; issuer: string; date: string };
export type Review = { text: string; rating: number | null; title: string; client: string; date: string };
export type Profile = {
  name: string;
  headline: string;
  bio: string;
  photoUrl: string;
  profileUrl: string;
  jobSuccess: number | null;
  badge: string;
  rating: number | null;
  reviewCount: number | null;
  totalJobs: number | null;
  totalHours: number | null;
  totalEarned: string;
  skills: string[];
  experiences: Experience[];
  certifications: Certification[];
  reviews: Review[];
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const objects = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]).filter(x => x && typeof x === 'object') : []);

/** Public: shown on every share page, so no auth. Empty fields when nothing is saved yet. */
export async function getProfile(): Promise<Profile> {
  'use cache';
  cacheTag('profile');
  cacheLife('hours');

  const row = await prisma.profile.findUnique({ where: { id: 'me' } });
  return {
    name: row?.name ?? '',
    headline: row?.headline ?? '',
    bio: row?.bio ?? '',
    photoUrl: row?.photoUrl ?? '',
    profileUrl: row?.profileUrl ?? '',
    jobSuccess: row?.jobSuccess ?? null,
    badge: row?.badge ?? '',
    rating: row?.rating ?? null,
    reviewCount: row?.reviewCount ?? null,
    totalJobs: row?.totalJobs ?? null,
    totalHours: row?.totalHours ?? null,
    totalEarned: row?.totalEarned ?? '',
    skills: row?.skills ?? [],
    experiences: objects(row?.experiences).map(e => ({
      title: str(e.title),
      org: str(e.org),
      period: str(e.period),
      summary: str(e.summary),
    })),
    certifications: objects(row?.certifications).map(c => ({ name: str(c.name), issuer: str(c.issuer), date: str(c.date) })),
    reviews: objects(row?.reviews).map(r => ({
      text: str(r.text),
      rating: typeof r.rating === 'number' ? r.rating : null,
      title: str(r.title),
      client: str(r.client),
      date: str(r.date),
    })),
  };
}
