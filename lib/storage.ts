import 'server-only';

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3-compatible object storage. The same code talks to local RustFS, AWS S3, Supabase Storage
 * or R2 — only the S3_* env vars change. Browsers and the Mac app upload straight to the bucket
 * with presigned URLs; bytes never pass through Next.
 */

export const PART_SIZE = 10 * 1024 * 1024; // S3 minimum is 5 MiB for every part but the last
const UPLOAD_URL_TTL = 60 * 60; // 1h to finish an upload
const READ_URL_TTL = 60 * 60 * 6;

const globalForS3 = globalThis as unknown as { s3?: S3Client };

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

export const bucket = () => env('S3_BUCKET');

/** Created on first use, not at import: `next build` loads this module without S3 secrets. */
export function s3() {
  globalForS3.s3 ??= new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId: env('S3_ACCESS_KEY_ID'), secretAccessKey: env('S3_SECRET_ACCESS_KEY') },
    // Presigned part URLs must not carry checksum params the browser can't compute.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return globalForS3.s3;
}

export const videoKeys = (videoId: string) => ({
  video: `videos/${videoId}/video.mp4`,
  poster: `videos/${videoId}/poster.jpg`,
  gif: `videos/${videoId}/preview.gif`,
});

export function partCount(sizeBytes: number) {
  return Math.max(1, Math.ceil(sizeBytes / PART_SIZE));
}

export async function createMultipart(key: string, contentType: string) {
  const res = await s3().send(
    new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
  );
  if (!res.UploadId) throw new Error('Storage did not return an upload id');
  return res.UploadId;
}

/** Presigned PUT URLs for parts `from..to` (1-based, inclusive). */
export async function presignParts(key: string, uploadId: string, from: number, to: number) {
  const urls: { partNumber: number; url: string }[] = [];
  for (let partNumber = from; partNumber <= to; partNumber++) {
    const url = await getSignedUrl(
      s3(),
      new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber }),
      { expiresIn: UPLOAD_URL_TTL },
    );
    urls.push({ partNumber, url });
  }
  return urls;
}

export async function completeMultipart(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(p => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  );
}

export async function abortMultipart(key: string, uploadId: string) {
  await s3().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }));
}

export function presignPut(key: string, contentType: string) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_URL_TTL,
  });
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

export function presignGet(key: string, expiresIn = READ_URL_TTL) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn });
}

export async function objectSize(key: string): Promise<number | null> {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return res.ContentLength ?? null;
  } catch {
    return null;
  }
}

export async function deleteObjects(keys: string[]) {
  if (keys.length === 0) return;
  await s3().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys.map(Key => ({ Key })) } }));
}
