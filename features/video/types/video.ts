import type { Video as VideoRow } from '@/generated/prisma/client';

export type Chapter = { start: number; title: string };
export type Word = { text: string; start: number; end: number };

export type Video = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: 'UPLOADING' | 'READY' | 'FAILED';
  durationSec: number;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  /** Same-origin media URLs (`/media/...`), stable for og:image and playback. */
  videoUrl: string;
  posterUrl: string | null;
  gifUrl: string | null;
  chapters: Chapter[];
  transcriptText: string | null;
  summary: string | null;
  pitch: string;
  /** Public share page only: the proposal's client name, for the greeting. */
  clientName?: string;
  ogTitle: string | null;
  ogDescription: string | null;
  createdAt: string;
  viewCount: number;
};

export const mediaUrl = (key: string) => `/media/${key}`;

function isChapter(c: unknown): c is Chapter {
  return typeof c === 'object' && c !== null && typeof (c as Chapter).start === 'number' && typeof (c as Chapter).title === 'string';
}

function isWord(w: unknown): w is Word {
  return typeof w === 'object' && w !== null && typeof (w as Word).text === 'string';
}

export function toVideo(row: VideoRow & { _count?: { views: number } }): Video {
  const words = Array.isArray(row.transcript) ? row.transcript.filter(isWord) : [];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    durationSec: row.durationSec,
    width: row.width,
    height: row.height,
    sizeBytes: Number(row.sizeBytes),
    videoUrl: mediaUrl(row.videoKey),
    posterUrl: row.posterKey ? mediaUrl(row.posterKey) : null,
    gifUrl: row.gifKey ? mediaUrl(row.gifKey) : null,
    chapters: Array.isArray(row.chapters) ? row.chapters.filter(isChapter) : [],
    transcriptText: words.length ? words.map(w => w.text).join(' ') : null,
    summary: row.summary,
    pitch: row.pitch,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    createdAt: row.createdAt.toISOString(),
    viewCount: row._count?.views ?? 0,
  };
}

/**
 * What the share card shows: explicit OG copy → AI summary → description → the opening of the
 * transcript (always there for Mac recordings) → a generic line.
 */
export function previewCopy(
  v: Pick<Video, 'title' | 'summary' | 'description' | 'ogTitle' | 'ogDescription' | 'durationSec'> & {
    transcriptText?: string | null;
  },
) {
  return {
    title: v.ogTitle || v.title,
    description:
      v.ogDescription ||
      v.summary ||
      v.description ||
      excerpt(v.transcriptText) ||
      `Watch this ${formatDuration(v.durationSec)} video.`,
  };
}

/** First ~160 characters of the transcript, cut at a word, for the card description. */
export function excerpt(text: string | null | undefined, max = 160) {
  const t = text?.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[,.;:!?-]+$/, '')}…`;
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

export function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
