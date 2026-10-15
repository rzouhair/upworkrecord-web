import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export type PromptTemplate = { id: string; name: string; body: string; isDefault: boolean };
export type Proposal = {
  jobUrl: string;
  jobPost: string;
  clientName: string;
  body: string;
  templateId: string | null;
  updatedAt: string;
};

export async function getTemplates(): Promise<PromptTemplate[]> {
  await verifyAuth();
  return getTemplatesCached();
}

async function getTemplatesCached() {
  'use cache';
  cacheTag('templates');
  cacheLife('hours');

  const rows = await prisma.promptTemplate.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  return rows.map(({ id, name, body, isDefault }) => ({ id, name, body, isDefault }));
}

export async function getProposal(videoId: string): Promise<Proposal | null> {
  await verifyAuth();
  return getProposalCached(videoId);
}

async function getProposalCached(videoId: string) {
  'use cache';
  cacheTag(`proposal-${videoId}`);
  cacheLife('minutes');

  const row = await prisma.proposal.findUnique({ where: { videoId } });
  return row
    ? { jobUrl: row.jobUrl, jobPost: row.jobPost, clientName: row.clientName, body: row.body, templateId: row.templateId, updatedAt: row.updatedAt.toISOString() }
    : null;
}
