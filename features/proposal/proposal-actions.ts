'use server';

import { updateTag } from 'next/cache';
import { z } from 'zod';
import { MissingKeyError, writeProposal } from '@/features/proposal/proposal-ai';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const draftSchema = z.object({
  jobUrl: z.union([z.literal(''), z.url('Enter a valid job URL')]),
  jobPost: z.string().trim().max(20_000),
  clientName: z.string().trim().max(60),
  body: z.string().max(20_000),
  templateId: z.string().nullable(),
  pitch: z.string().trim().max(2000),
});

export async function saveProposal(videoId: string, input: z.input<typeof draftSchema>) {
  await verifyAuth();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { pitch, ...proposal } = parsed.data;
  await prisma.proposal.upsert({ where: { videoId }, create: { videoId, ...proposal }, update: proposal });
  const video = await prisma.video.update({ where: { id: videoId }, data: { pitch }, select: { slug: true } });
  updateTag(`proposal-${videoId}`);
  updateTag(`video-${videoId}`);
  updateTag(`video-slug-${video.slug}`);
  return { ok: true as const };
}

const generateSchema = z
  .object({
    jobUrl: z.union([z.literal(''), z.url('Enter a valid job URL')]),
    jobPost: z.string().trim().max(20_000),
    clientName: z.string().trim().max(60),
    templateId: z.string().min(1, 'Pick a prompt template'),
  })
  .refine(d => d.jobUrl || d.jobPost.length >= 40, 'Add the job URL or paste the job post');

export async function generateProposal(videoId: string, input: z.input<typeof generateSchema>) {
  await verifyAuth();
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  try {
    return { ok: true as const, ...(await writeProposal(videoId, parsed.data)) };
  } catch (e) {
    return { ok: false as const, error: e instanceof MissingKeyError ? e.message : `Generation failed: ${(e as Error).message}` };
  }
}

const templateSchema = z.object({
  name: z.string().trim().min(1, 'Name it').max(60, '60 characters max'),
  body: z.string().trim().min(20, 'The prompt is too short').max(10_000),
});

export async function saveTemplate(id: string | null, input: z.input<typeof templateSchema>) {
  await verifyAuth();
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const hasAny = (await prisma.promptTemplate.count()) > 0;
  const template = id
    ? await prisma.promptTemplate.update({ where: { id }, data: parsed.data })
    : await prisma.promptTemplate.create({ data: { ...parsed.data, isDefault: !hasAny } });
  updateTag('templates');
  return { ok: true as const, id: template.id };
}

export async function setDefaultTemplate(id: string) {
  await verifyAuth();
  await prisma.$transaction([
    prisma.promptTemplate.updateMany({ data: { isDefault: false } }),
    prisma.promptTemplate.update({ where: { id }, data: { isDefault: true } }),
  ]);
  updateTag('templates');
}

export async function deleteTemplate(id: string) {
  await verifyAuth();
  const t = await prisma.promptTemplate.delete({ where: { id } });
  if (t.isDefault) {
    const next = await prisma.promptTemplate.findFirst({ orderBy: { createdAt: 'asc' } });
    if (next) await prisma.promptTemplate.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  updateTag('templates');
}
