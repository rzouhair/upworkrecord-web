/* eslint-disable no-console -- CLI script output */
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

config({ path: ['.env.local', '.env'], quiet: true });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

export const DEFAULT_TEMPLATE = `You write Upwork proposals for a freelancer who recorded a short video for this job.

Job post:
{{job_post}}

What the freelancer said in the video ({{duration}}):
{{transcript}}

Write the cover letter:
- First two lines are the hook: name the client's exact problem and say a video walks through the fix. These lines show in the client's preview, so make them specific.
- Then put the video link on its own line: {{video_url}}
- Then 2-3 short lines on how the work gets done, using details from the video. No generic claims.
- End with one easy question the client can answer in a few words.
- Simple, friendly English. Under 150 words. No bullet points, no emojis, no "Dear Hiring Manager".
Reply with the cover letter only.`;

async function main() {
  const existing = await prisma.promptTemplate.findFirst({ where: { isDefault: true } });
  if (existing) return console.log('default template exists');
  await prisma.promptTemplate.create({ data: { name: 'Video-first proposal', body: DEFAULT_TEMPLATE, isDefault: true } });
  console.log('seeded default template');
}

main().finally(() => prisma.$disconnect());
