import 'server-only';

import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import { complete } from '@/features/proposal/proposal-ai';

type Word = { text: string; start: number; end: number };

/** Mono 16 kHz 32 kbps MP3 (~240 KB/min) straight from the storage URL: small enough to send inline. */
function extractAudio(url: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const ff = spawn(/*turbopackIgnore: true*/ process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg', [
      '-v',
      'error',
      '-i',
      url,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '32k',
      '-f',
      'mp3',
      'pipe:1',
    ]);
    const chunks: Buffer[] = [];
    let err = '';
    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.stderr.on('data', (c: Buffer) => (err += c.toString()));
    ff.on('error', e => reject(new Error(`ffmpeg not available (${e.message}). Install it or set FFMPEG_PATH.`)));
    ff.on('close', code =>
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(new Error(`ffmpeg failed: ${err.trim().slice(0, 200) || code}`)),
    );
  });
}

/** Segments → words with times spread evenly across each segment (the Mac app's shape). */
export function segmentsToWords(segments: { start: number; end: number; text: string }[]): Word[] {
  return segments.flatMap(s => {
    const parts = s.text.trim().split(/\s+/).filter(Boolean);
    const step = Math.max(s.end - s.start, 0) / Math.max(parts.length, 1);
    return parts.map((text, i) => ({
      text,
      start: +(s.start + i * step).toFixed(2),
      end: +(s.start + (i + 1) * step).toFixed(2),
    }));
  });
}

/**
 * Server-side transcription for videos that didn't come from the Mac app: audio → an audio-capable
 * OpenRouter model → timed segments. Timings are per sentence (words interpolated), not per word.
 */
export async function transcribeFromUrl(url: string, durationSec: number) {
  // ponytail: whole audio in one request; chunk it if videos get long enough to hit the model's input limit (~1h)
  const audio = await extractAudio(url);
  if (audio.length < 1000) return [];

  const raw = await complete(
    [
      {
        type: 'text',
        text: `Transcribe this recording verbatim, in its original language. It is ${Math.round(durationSec)} seconds long.
Reply with JSON only: {"segments": [{"start": number, "end": number, "text": string}]}
- One segment per sentence or short phrase, in order, times in seconds from the start of the audio.
- Skip silence and music. {"segments": []} if nobody speaks.`,
      },
      { type: 'input_audio', input_audio: { data: audio.toString('base64'), format: 'mp3' } },
    ],
    process.env.OPENROUTER_AUDIO_MODEL || 'google/gemini-3.8-flash',
    { json: true, temperature: 0 },
  );

  const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as { segments?: unknown };
  const segments = (Array.isArray(json.segments) ? json.segments : [])
    .filter(
      (s): s is { start: number; end: number; text: string } =>
        typeof s?.start === 'number' && typeof s?.end === 'number' && typeof s?.text === 'string' && !!s.text.trim(),
    )
    .map(s => ({ ...s, start: Math.max(0, s.start), end: Math.min(Math.max(s.end, s.start), durationSec || s.end) }))
    .sort((a, b) => a.start - b.start);
  return segmentsToWords(segments);
}
