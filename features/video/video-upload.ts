// Browser-side upload: create → PUT parts straight to storage (parallel, with progress) →
// complete → poster + share GIF. Same endpoints the Mac app uses.

import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { formatDuration } from '@/features/video/types/video';

type CreateResponse = {
  videoId: string;
  slug: string;
  shareUrl: string;
  partSize: number;
  parts: { partNumber: number; url: string }[];
};

export type UploadProgress = { loaded: number; total: number; phase: 'preparing' | 'uploading' | 'finishing' };

const CONCURRENCY = 4;

async function api<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** fetch() has no upload progress, so parts go through XHR. Resolves with the ETag. */
function putPart(url: string, blob: Blob, onProgress: (loaded: number) => void, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = e => onProgress(e.loaded);
    xhr.onload = () => {
      const etag = xhr.getResponseHeader('ETag');
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
      else reject(new Error(etag ? `Part upload failed (${xhr.status})` : 'Storage did not expose ETag (check bucket CORS)'));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

/** Duration, size and a JPEG frame from ~1s in, read locally before anything is uploaded. */
export function readVideoInfo(file: File) {
  return new Promise<{ durationSec: number; width: number; height: number; poster: Blob | null }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    const done = (poster: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve({
        durationSec: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth,
        height: video.videoHeight,
        poster,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file can't be played in the browser"));
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / (video.videoWidth || 1280));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => done(blob), 'image/jpeg', 0.85);
    };
  });
}

/** Any image → JPEG blob (presigned poster URLs are signed for image/jpeg). */
export async function toJpeg(file: Blob) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', 0.9),
  );
}

export async function uploadAsset(videoId: string, kind: 'poster' | 'gif', blob: Blob) {
  const { url, contentType } = await api<{ url: string; contentType: string }>(`/api/videos/${videoId}/assets`, { kind });
  const res = await fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
  if (!res.ok) throw new Error(`Image upload failed (${res.status})`);
}

export async function uploadVideo(file: File, onProgress: (p: UploadProgress) => void, signal: AbortSignal) {
  onProgress({ loaded: 0, total: file.size, phase: 'preparing' });
  const info = await readVideoInfo(file);
  const title = file.name.replace(/\.[^.]+$/, '').slice(0, 120);
  const contentType = (['video/mp4', 'video/quicktime', 'video/webm'] as const).find(t => t === file.type) ?? 'video/mp4';

  const created = await api<CreateResponse>(
    '/api/uploads',
    {
      title,
      sizeBytes: file.size,
      contentType,
      durationSec: info.durationSec,
      width: info.width || undefined,
      height: info.height || undefined,
    },
    signal,
  );

  try {
    const loaded = new Map<number, number>();
    const report = () =>
      onProgress({ loaded: [...loaded.values()].reduce((a, b) => a + b, 0), total: file.size, phase: 'uploading' });

    const queue = [...created.parts];
    const etags: { partNumber: number; etag: string }[] = [];
    const worker = async () => {
      for (let part = queue.shift(); part; part = queue.shift()) {
        const start = (part.partNumber - 1) * created.partSize;
        const blob = file.slice(start, start + created.partSize);
        const { partNumber } = part;
        const etag = await putPart(
          part.url,
          blob,
          n => {
            loaded.set(partNumber, n);
            report();
          },
          signal,
        );
        etags.push({ partNumber, etag });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, created.parts.length) }, worker));

    onProgress({ loaded: file.size, total: file.size, phase: 'finishing' });
    await api(`/api/uploads/${created.videoId}/complete`, { parts: etags }, signal);
    if (info.poster) await uploadAsset(created.videoId, 'poster', info.poster).catch(() => {});
    const src = URL.createObjectURL(file);
    await makeGif(src, 0, 3, info.durationSec)
      .then(gif => uploadAsset(created.videoId, 'gif', gif))
      .catch(() => {})
      .finally(() => URL.revokeObjectURL(src));
    return created;
  } catch (e) {
    // Don't leave half-uploaded parts or an UPLOADING row behind.
    await fetch(`/api/uploads/${created.videoId}/abort`, { method: 'POST' }).catch(() => {});
    throw e;
  }
}

/**
 * Share-card GIF like the Mac app's: `length` seconds from `start` at 8 fps, 480 wide, with the play
 * button and "Play M:SS video" drawn on every frame. `src` must be same-origin or CORS-enabled.
 */
export async function makeGif(src: string, start: number, length: number, duration: number) {
  const FPS = 8;
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.preload = 'auto';
  video.src = src;
  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = () => reject(new Error("Couldn't load the video to make a GIF"));
  });

  const w = 480;
  const h = Math.round((video.videoHeight / video.videoWidth) * w) & ~1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  const end = Math.min(start + length, (duration || video.duration) - 0.05);
  const label = `Play ${formatDuration(duration || video.duration)} video`;

  for (let t = start; t < end || t === start; t += 1 / FPS) {
    video.currentTime = t;
    await new Promise(resolve => (video.onseeked = resolve));
    ctx.drawImage(video, 0, 0, w, h);
    drawPlayOverlay(ctx, w, h, label);
    const { data } = ctx.getImageData(0, 0, w, h);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay: 1000 / FPS });
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}

/** Dark rounded play button + italic caption, centred, like the video cards Upwork shows. */
function drawPlayOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, label: string) {
  const s = w / 480;
  const bx = w / 2 - 32 * s;
  const by = h / 2 - 32 * s;
  ctx.fillStyle = 'rgba(26, 26, 26, 0.72)';
  ctx.beginPath();
  ctx.roundRect(bx, by, 64 * s, 44 * s, 10 * s);
  ctx.fill();
  const cx = w / 2;
  const cy = by + 22 * s;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cx - 7 * s, cy - 10 * s);
  ctx.lineTo(cx - 7 * s, cy + 10 * s);
  ctx.lineTo(cx + 11 * s, cy);
  ctx.fill();

  ctx.save();
  ctx.font = `italic 500 ${13 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 3 * s;
  ctx.fillText(label, w / 2, by + 50 * s);
  ctx.restore();
}
