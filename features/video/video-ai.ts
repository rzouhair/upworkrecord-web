import 'server-only';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/db';
import { complete, writeProposal } from '@/features/proposal/proposal-ai';

type Word = { text: string; start: number; end: number };

/** "[12s] words…" lines of ~15s so the model can place chapters. */
function timedTranscript(words: Word[]) {
  const lines: string[] = [];
  let current: string[] = [];
  let lineStart = 0;
  for (const w of words) {
    if (!current.length) lineStart = w.start;
    current.push(w.text);
    if (w.end - lineStart >= 15) {
      lines.push(`[${Math.floor(lineStart)}s] ${current.join(' ')}`);
      current = [];
    }
  }
  if (current.length) lines.push(`[${Math.floor(lineStart)}s] ${current.join(' ')}`);
  return lines.join('\n');
}

/**
 * Title, summary and chapters from the transcript, then a proposal draft with the default template
 * when the video has none yet. Runs after upload completes, and after a manual transcription
 * (`keepTitle`: the owner already named it).
 */
export async function summarizeVideo(id: string, { keepTitle = false } = {}) {
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.summary || !Array.isArray(video.transcript) || !video.transcript.length) return;

  const prompt = `You write the title, summary and chapters for a screen recording, from its transcript.
Each transcript line starts with its start time in seconds, like [42s].
Reply with JSON only, exactly this shape:
{"title": string, "summary": string, "chapters": [{"start": number, "title": string}]}
- title: max 60 characters, specific, no quotes or emoji.
- summary: 2-3 plain sentences in the first person, from the freelancer who recorded it, speaking directly to
  the client who will watch it ("In this video I show you…"). It becomes the share-card description.
- chapters: first starts at 0, about one per 1-2 minutes, max 8, titles max 6 words. One chapter if the video is short.
Write in the transcript's language.

Transcript:
${timedTranscript(video.transcript as Word[]).slice(0, 24_000)}`;

  try {
    const raw = await complete(prompt, process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-nano', { json: true });
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as {
      title?: unknown;
      summary?: unknown;
      chapters?: unknown;
    };
    const chapters = (Array.isArray(json.chapters) ? json.chapters : [])
      .filter(
        (c): c is { start: number; title: string } => typeof c?.start === 'number' && typeof c?.title === 'string',
      )
      .map(c => ({ start: c.start, title: c.title.slice(0, 80) }))
      .sort((a, b) => a.start - b.start);
    const updated = await prisma.video.update({
      where: { id },
      data: {
        ...(!keepTitle && typeof json.title === 'string' && json.title.trim() ? { title: json.title.trim().slice(0, 120) } : {}),
        ...(typeof json.summary === 'string' ? { summary: json.summary.slice(0, 2000) } : {}),
        ...(chapters.length ? { chapters } : {}),
      },
    });
    revalidateTag('videos', { expire: 0 });
    revalidateTag(`video-${id}`, { expire: 0 });
    revalidateTag(`video-slug-${updated.slug}`, { expire: 0 });
  } catch (e) {
    console.error(`[video-ai] summarize ${id} failed:`, (e as Error).message);
  }

  const job = await prisma.proposal.findUnique({ where: { videoId: id } });
  if (job?.body) return; // never overwrite a letter the owner may have edited
  await writeProposal(id, {
    jobUrl: job?.jobUrl ?? '',
    jobPost: job?.jobPost ?? '',
    clientName: job?.clientName ?? '',
    templateId: job?.templateId,
  }).catch(e =>
    console.error(`[video-ai] proposal ${id} failed:`, (e as Error).message),
  );
}
