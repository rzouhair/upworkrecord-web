/* eslint-disable no-console -- CLI script output */
/**
 * One-time bucket setup: create the bucket and allow browser uploads (CORS, ETag exposed so
 * the uploader can complete multipart uploads). Safe to re-run. `pnpm storage:setup`
 */
import { config } from 'dotenv';
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';

config({ path: ['.env.local', '.env'], quiet: true });

const Bucket = process.env.S3_BUCKET!;
const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
});

async function main() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
    console.log(`bucket ${Bucket} exists`);
  } catch {
    const region = process.env.S3_REGION ?? 'us-east-1';
    // AWS rejects CreateBucket outside us-east-1 without a LocationConstraint.
    const CreateBucketConfiguration =
      process.env.S3_ENDPOINT || region === 'us-east-1' ? undefined : { LocationConstraint: region as never };
    await s3.send(new CreateBucketCommand({ Bucket, CreateBucketConfiguration }));
    console.log(`bucket ${Bucket} created`);
  }
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              // Extra origins as args: `pnpm storage:setup https://foo.vercel.app`
              AllowedOrigins: [process.env.APP_URL ?? 'http://localhost:3000', ...process.argv.slice(2)],
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    console.log('CORS set');
  } catch (e) {
    // Some S3-compatible servers (and Supabase) manage CORS elsewhere; uploads may still work.
    console.error('CORS not set:', (e as Error).message);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
