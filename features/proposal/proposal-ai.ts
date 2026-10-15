import 'server-only';
import { revalidateTag } from 'next/cache';
import { formatDuration } from '@/features/video/types/video';
import { prisma } from '@/lib/db';
import { appUrl } from '@/lib/http';

// Swap point for launchpad later: replace `complete()` with a POST to LAUNCHPAD_API_URL/events/…

export const TEMPLATE_VARIABLES = [
  'job_post',
  'job_url',
  'client_name',
  'transcript',
  'video_url',
  'video_title',
  'duration',
] as const;
export type TemplateVars = Record<(typeof TEMPLATE_VARIABLES)[number], string>;

export function renderTemplate(body: string, vars: TemplateVars) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in vars ? vars[name as keyof TemplateVars] : match,
  );
}

export class MissingKeyError extends Error {}

/** `prompt` is text, or OpenAI-style content parts (e.g. `input_audio`) for multimodal models. */
export async function complete(prompt: string | object[], model: string, { json = false, temperature = 0.7 } = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new MissingKeyError('Add OPENROUTER_API_KEY to .env.local to generate proposals.');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'UpworkRecord' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenRouter returned an empty reply');
  return text;
}

/**
 * Draft the cover letter from the saved transcript + job info with a prompt template (the default
 * when none is given), and store it. Throws on missing video/template or model errors.
 */
export async function writeProposal(
  videoId: string,
  job: { jobUrl: string; jobPost: string; clientName?: string; templateId?: string | null },
) {
  const clientName = job.clientName?.trim() ?? '';
  const [video, template] = await Promise.all([
    prisma.video.findUnique({ where: { id: videoId } }),
    job.templateId
      ? prisma.promptTemplate.findUnique({ where: { id: job.templateId } })
      : prisma.promptTemplate.findFirst({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
  ]);
  if (!video) throw new Error('Video not found');
  if (!template) throw new Error('Template not found');

  const words = Array.isArray(video.transcript) ? (video.transcript as { text?: unknown }[]) : [];
  const transcript = words
    .map(w => (typeof w.text === 'string' ? w.text : ''))
    .join(' ')
    .trim();
  // "For Curtis: …" so the client sees their name on the share page; a previous client's prefix is replaced.
  const baseTitle = video.title.replace(/^For [^:]{1,60}:\s*/, '');
  const title =
    clientName && !baseTitle.toLowerCase().includes(clientName.split(/\s+/)[0].toLowerCase())
      ? `For ${clientName}: ${baseTitle}`.slice(0, 120)
      : video.title;

  const videoUrl = `${appUrl()}/v/${video.slug}`;
  const rendered = renderTemplate(template.body, {
    job_post: job.jobPost || '(not provided: write from the transcript)',
    job_url: job.jobUrl || '(not provided)',
    client_name: clientName || '(unknown)',
    transcript: transcript || '(no transcript: write from the job post, and say the video walks through the approach)',
    video_url: videoUrl,
    video_title: title,
    duration: formatDuration(video.durationSec),
  });
  const prompt = [
    rendered,
    clientName
      ? `The client's name is ${clientName}. Open with "Hi ${clientName} 👋" on its own line, then the hook.`
      : '',
    `Keep the hook to ONE sentence under 120 characters and put the video link (${videoUrl}) right after it: ` +
      `the client's proposal list only shows the first ~${LINK_BUDGET} characters.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-nano';
  const [body, pitch] = await Promise.all([
    complete(prompt, model).then(text => linkEarly(clientName ? greet(text, clientName) : text, videoUrl)),
    // A failed pitch keeps the old one rather than failing the proposal.
    writePitch(job, transcript, model).catch(e => {
      console.error(`[proposal-ai] pitch ${videoId} failed:`, (e as Error).message);
      return null;
    }),
  ]);
  const data = { jobUrl: job.jobUrl, jobPost: job.jobPost, clientName, templateId: template.id, body, model };
  await prisma.proposal.upsert({ where: { videoId }, create: { videoId, ...data }, update: data });
  // Also runs from after() in the upload route, where updateTag isn't allowed.
  revalidateTag(`proposal-${videoId}`, { expire: 0 });
  if (pitch !== null || title !== video.title) {
    await prisma.video.update({ where: { id: videoId }, data: { title, ...(pitch !== null ? { pitch } : {}) } });
  }
  // The share page shows the client name, title and pitch.
  revalidateTag('videos', { expire: 0 });
  revalidateTag(`video-${videoId}`, { expire: 0 });
  revalidateTag(`video-slug-${video.slug}`, { expire: 0 });
  return { body, pitch: pitch ?? video.pitch };
}

// Upwork's desktop proposal list shows ~240 characters before "more" (see cover-letter-preview.tsx);
// a margin keeps the link clear of the cut.
const LINK_BUDGET = 225;
const flatLength = (s: string) => s.replace(/\s+/g, ' ').trim().length;

/**
 * Make the video link land in the preview: keep as many hook sentences before it as fit in
 * LINK_BUDGET, move the rest after the link. Adds the link after the first sentence if missing.
 */
export function linkEarly(text: string, url: string) {
  const at = text.indexOf(url);
  const before = at >= 0 ? text.slice(0, at) : text;
  const after = at >= 0 ? text.slice(at + url.length) : '';
  if (at >= 0 && flatLength(before) + 1 + url.length <= LINK_BUDGET) return text;

  const greeting = /^\s*(hi|hello|hey|dear)\b[^\n]*\n+/i.exec(before)?.[0] ?? '';
  const sentences = before
    .slice(greeting.length)
    .trim()
    .split(/(?<=[.!?])\s+/);
  const kept: string[] = [];
  while (
    sentences.length &&
    (kept.length === 0 ||
      flatLength(`${greeting} ${[...kept, sentences[0]].join(' ')}`) + 1 + url.length <= LINK_BUDGET)
  ) {
    kept.push(sentences.shift()!);
  }
  const rest = [sentences.join(' '), after.trim()].filter(Boolean).join('\n\n');
  return `${greeting.trim() ? `${greeting.trim()}\n\n` : ''}${kept.join(' ')}\n${url}${rest ? `\n\n${rest}` : ''}`;
}

/** Exactly one "Hi Name 👋" line on top, whatever greeting the model wrote. */
function greet(text: string, name: string) {
  const rest = text.replace(/^\s*(hi|hello|hey|dear)\b[^\n]*\n+/i, '').trimStart();
  return `Hi ${name} 👋\n\n${rest}`;
}

/**
 * "Why I'm a fit" for the share page: the profile facts that matter for this job and this video.
 * Empty when there's no profile to draw from.
 */
async function writePitch(job: { jobUrl: string; jobPost: string }, transcript: string, model: string) {
  const profile = await prisma.profile.findUnique({ where: { id: 'me' } });
  if (!profile || !(profile.bio || profile.headline || profile.skills.length)) return '';
  const { id: _id, updatedAt: _updatedAt, photoUrl: _photo, profileUrl: _url, ...facts } = profile;

  const text = await complete(
    `Write the "Why I'm a fit" section of the page where a client watches a video a freelancer recorded for their job.
First person, speaking to the client ("you"). 50-90 words:
- One opening line linking the client's need to what the video shows.
- Then 2-3 lines, each starting with "• ", each with ONE concrete proof from the profile that matters for THIS job:
  a past project or result, a certification, a client review quote, or a stat.
Use ONLY facts in the profile, job and transcript. Skip irrelevant experience. Never invent numbers, clients or results.
Simple, friendly English. No emojis, no headings, no sign-off. Reply with the text only.

Job post:
${job.jobPost || '(not provided: match the profile to what the video covers)'}
Job URL: ${job.jobUrl || '(not provided)'}

What the freelancer says in the video:
${transcript.slice(0, 6000) || '(no transcript)'}

Freelancer profile (JSON):
${JSON.stringify(facts).slice(0, 12_000)}`,
    model,
  );
  // Models often run the bullets together on one line.
  return text.replace(/\s*•\s*/g, '\n• ').trim();
}
