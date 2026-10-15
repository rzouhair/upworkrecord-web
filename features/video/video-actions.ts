'use server';

import { updateTag } from 'next/cache';
import { z } from 'zod';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { deleteObjects, presignGet } from '@/lib/storage';
import { summarizeVideo } from '@/features/video/video-ai';
import { transcribeFromUrl } from '@/features/video/video-transcribe';
import { complete, MissingKeyError } from '@/features/proposal/proposal-ai';
import { SLUG_PATTERN } from '@/features/video/types/video';

function invalidate(video: { id: string; slug: string }) {
  updateTag('videos');
  updateTag(`video-${video.id}`);
  updateTag(`video-slug-${video.slug}`);
}

const detailsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, '120 characters max'),
  description: z.string().trim().max(2000, '2000 characters max'),
});

export async function updateVideoDetails(id: string, input: { title: string; description?: string }) {
  await verifyAuth();
  const current = await prisma.video.findUnique({ where: { id }, select: { description: true } });
  if (!current) return { ok: false as const, error: 'Video not found' };
  const parsed = detailsSchema.safeParse({ title: input.title, description: input.description ?? current.description });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const video = await prisma.video.update({ where: { id }, data: parsed.data });
  invalidate(video);
  return { ok: true as const };
}

const previewSchema = z.object({
  ogTitle: z.string().trim().max(90, '90 characters max'),
  ogDescription: z.string().trim().max(200, '200 characters max'),
});

export async function updatePreview(id: string, input: { ogTitle: string; ogDescription: string }) {
  await verifyAuth();
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const video = await prisma.video.update({
    where: { id },
    data: { ogTitle: parsed.data.ogTitle || null, ogDescription: parsed.data.ogDescription || null },
  });
  invalidate(video);
  return { ok: true as const };
}

export async function updateSlug(id: string, input: string) {
  await verifyAuth();
  const slug = input.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false as const, error: '3–60 characters: lowercase letters, numbers and dashes (not at the ends)' };
  }
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return { ok: false as const, error: 'Video not found' };
  if (video.slug === slug) return { ok: true as const, slug };

  const taken = await prisma.video.findFirst({
    where: { id: { not: id }, OR: [{ slug }, { previousSlugs: { has: slug } }] },
    select: { id: true },
  });
  if (taken) return { ok: false as const, error: 'That link is already used by another video' };

  const updated = await prisma.video.update({
    where: { id },
    data: { slug, previousSlugs: [...new Set([...video.previousSlugs.filter(s => s !== slug), video.slug])] },
  });
  invalidate(video); // old slug → now redirects
  invalidate(updated);
  return { ok: true as const, slug: updated.slug };
}

/** Draft the share-card title + description from the transcript (OpenRouter). */
export async function suggestPreview(id: string) {
  await verifyAuth();
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return { ok: false as const, error: 'Video not found' };
  const words = Array.isArray(video.transcript) ? (video.transcript as { text?: unknown }[]) : [];
  const transcript = words.map(w => (typeof w.text === 'string' ? w.text : '')).join(' ').trim();
  if (!transcript) return { ok: false as const, error: 'This video has no transcript to write from.' };

  const job = await prisma.proposal.findUnique({ where: { videoId: id }, select: { clientName: true, jobPost: true } });
  const prompt = `Write the link-preview card for a short video I (a freelancer) recorded for a client on Upwork.
The card is written BY ME, in the first person, speaking directly to the client: "I", "my", "you", "your".
Never describe me in the third person ("a freelancer", "the developer", "their approach").
${job?.clientName ? `The client's name is ${job.clientName}.\n` : ''}${job?.jobPost ? `Their job post:\n${job.jobPost.slice(0, 3000)}\n` : ''}
What I say in the video:
${transcript.slice(0, 6000)}

Reply with JSON only: {"title": string, "description": string}
- title: max 60 characters, specific to the client's problem, no quotes or emoji.
- description: one or two sentences, max 160 characters, in my voice: what I show you in the video and why it's worth
  watching, e.g. "I walk you through how I'd connect Cliniko's API to a booking agent, step by step."`;
  try {
    const raw = await complete(prompt, process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-nano', { json: true });
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as { title?: unknown; description?: unknown };
    const title = typeof json.title === 'string' ? json.title.slice(0, 90) : '';
    const description = typeof json.description === 'string' ? json.description.slice(0, 200) : '';
    if (!title && !description) throw new Error('empty reply');
    return { ok: true as const, title, description };
  } catch (e) {
    return { ok: false as const, error: e instanceof MissingKeyError ? e.message : `Couldn't write it: ${(e as Error).message}` };
  }
}

/**
 * Direct storage URL for drawing frames in the browser (GIF maker). The /media redirect can't be
 * used: a cross-origin redirect turns the CORS Origin into "null", which storage rejects. The
 * 1h expiry keeps this URL distinct from the player's: storage sends no `Vary: Origin`, so a
 * cached non-CORS response for an identical URL would fail the CORS load.
 */
export async function videoSourceUrl(id: string) {
  await verifyAuth();
  const video = await prisma.video.findUnique({ where: { id }, select: { videoKey: true } });
  if (!video) throw new Error('Video not found');
  return presignGet(video.videoKey, 3600);
}

/**
 * Transcribe (or redo) a video on the server, e.g. one uploaded from the browser. Replaces the
 * transcript, then rewrites summary + chapters (title kept; a proposal only if there's none yet).
 */
export async function transcribeVideo(id: string) {
  await verifyAuth();
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return { ok: false as const, error: 'Video not found' };

  let words;
  try {
    words = await transcribeFromUrl(await presignGet(video.videoKey), video.durationSec);
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof MissingKeyError ? e.message : `Transcription failed: ${(e as Error).message}`,
    };
  }
  if (!words.length) return { ok: false as const, error: 'No speech found in this video.' };

  await prisma.video.update({ where: { id }, data: { transcript: words, summary: null, chapters: [] } });
  await summarizeVideo(id, { keepTitle: true });
  invalidate(video);
  return { ok: true as const, words: words.length };
}

/** After the browser PUTs a new poster/GIF to its presigned URL. */
export async function refreshVideo(id: string) {
  await verifyAuth();
  const video = await prisma.video.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (video) invalidate(video);
}

export async function deleteVideo(id: string) {
  await verifyAuth();
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return { ok: false as const, error: 'Video not found' };

  await prisma.video.delete({ where: { id } });
  await deleteObjects([video.videoKey, video.posterKey, video.gifKey].filter((k): k is string => !!k)).catch(() => {
    // Row is gone either way; orphaned objects are harmless and can be swept later.
  });
  invalidate(video);
  return { ok: true as const };
}
