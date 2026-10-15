# UpworkRecord Web

Library, share pages and AI proposals for recordings from the
[UpworkRecord Mac app](https://github.com/rzouhair/upworkrecord-mac).
Next.js 16 · Prisma 7 on Postgres · S3-compatible storage · OpenRouter.

Single-user app: one login, one profile. **Everyone deploys their own copy** (own Vercel + Supabase +
S3 + OpenRouter). Code is identical everywhere; only env vars change. Budget ~30 min.

## What you get

- Library of recordings with title, summary, chapters, transcript, insights (views).
- Public share page `/v/<slug>` with animated GIF link preview (plays inside Upwork messages), embed, oEmbed.
- AI proposal per video: cover letter from editable templates, job post / URL → redraft, "why I'm a fit" pitch,
  Upwork-style preview of the first two lines.
- Public profile (name, photo, stats, reviews, certifications) shown on the share page.
- Server transcription for browser-uploaded videos (OpenRouter audio model + bundled ffmpeg).
- Optional: import your Upwork profile through Upwork's MCP server (OAuth, no keys).

## Accounts and keys you need

| Service | Used for | What to get | Cost |
|---|---|---|---|
| GitHub | fork / clone | your fork of this repo | free |
| [Vercel](https://vercel.com) | hosting | project linked to your fork | free tier OK |
| [Supabase](https://supabase.com) | Postgres only | project → 2 connection strings | free tier OK |
| [AWS](https://aws.amazon.com) | S3 bucket + IAM user | access key id + secret | cents/month |
| [OpenRouter](https://openrouter.ai) | proposals, summaries, transcription | API key | pay per use |
| Your domain's DNS (any provider) | subdomain, e.g. `loom.yourdomain.com` | one CNAME record | — |
| Local only: Node 24, pnpm 10, Docker | dev stack | — | — |

No Upwork API key is needed. Upwork import uses your own OAuth login (section 6).

## Environment variables

Template: [`.env.example`](.env.example) (production) · [`.env.sample`](.env.sample) (local Docker).

| Var | Value |
|---|---|
| `APP_URL` | public URL, no trailing slash (`https://loom.yourdomain.com`) |
| `ADMIN_PASSWORD` | web login password |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `API_TOKEN` | `openssl rand -hex 24`; same value goes into the Mac app |
| `DATABASE_URL` | Supabase **transaction** pooler (port 6543) |
| `DIRECT_URL` | Supabase **session** pooler (port 5432), migrations only |
| `S3_ENDPOINT` | empty for AWS |
| `S3_REGION` | bucket region (`us-east-1`, `eu-central-1`, …) |
| `S3_BUCKET` | bucket name |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | IAM user key |
| `S3_FORCE_PATH_STYLE` | `false` for AWS |
| `OPENROUTER_API_KEY` | OpenRouter key |
| `OPENROUTER_MODEL` | text model, default `openai/gpt-4.1-nano` |
| `OPENROUTER_AUDIO_MODEL` | optional; audio-capable model for "Transcribe" (e.g. `google/gemini-3.8-flash`) |
| `UPWORK_OAUTH_BASE_URL` | optional; empty → `APP_URL` (dev tunnel sets it) |
| `FFMPEG_PATH` | optional; empty → bundled `ffmpeg-static` |

Never commit real values. `.env.local` is ignored; production values live in Vercel.

## 1. Run locally (10 min)

```bash
git clone git@github.com:<you>/upworkrecord-web.git && cd upworkrecord-web
cp .env.sample .env.local            # set ADMIN_PASSWORD, SESSION_SECRET, API_TOKEN, OPENROUTER_API_KEY
pnpm install
pnpm services:up                     # Docker: Postgres :5434 + RustFS (S3) :9100, console :9101
pnpm db:migrate && pnpm db:seed      # schema + default proposal prompt
pnpm storage:setup                   # bucket + CORS for browser uploads
pnpm dev                             # http://localhost:3000 → log in with ADMIN_PASSWORD
```

- `pnpm test:e2e` runs the full flow (sign in → upload → share card → client view → proposal → delete).
- `pnpm typecheck && pnpm lint` before pushing.
- Point the Mac app at `http://localhost:3000` + your local `API_TOKEN` to test uploads end to end.

## 2. Supabase (Postgres)

1. New project → pick the region closest to your Vercel region (default `iad1` = US East).
2. **Connect** (top bar) → copy both strings into `.env.local` (formats in `.env.example`):
   - Transaction pooler, port **6543** → `DATABASE_URL` (append `?pgbouncer=true&uselibpqcompat=true&sslmode=require`)
   - Session pooler, port **5432** → `DIRECT_URL` (append `?uselibpqcompat=true&sslmode=require`)
3. Apply schema from your machine:
   ```bash
   pnpm db:deploy && pnpm db:seed
   ```

Only Postgres is used. Supabase Auth/Storage stay unused.

## 3. AWS S3 + IAM

Bucket stays private (Block Public Access ON). Videos are served by presigned redirect, images are proxied
by `/media/*`, uploads use presigned PUTs straight from the browser / Mac app.

1. **IAM → Users → Create user** `upworkrecord-app` (no console access) → **Add inline policy** (JSON), replace `BUCKET`:
   ```json
   {"Version":"2012-10-17","Statement":[
     {"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject","s3:AbortMultipartUpload","s3:ListMultipartUploadParts"],"Resource":"arn:aws:s3:::BUCKET/*"},
     {"Effect":"Allow","Action":["s3:ListBucket","s3:CreateBucket","s3:PutBucketCORS"],"Resource":"arn:aws:s3:::BUCKET"}]}
   ```
2. User → **Security credentials → Create access key** (Application running outside AWS) → copy id + secret.
3. In `.env.local`: `S3_ENDPOINT=` (empty), `S3_REGION`, `S3_BUCKET`, keys, `S3_FORCE_PATH_STYLE=false`,
   `APP_URL=https://<your final domain>`. Then:
   ```bash
   pnpm storage:setup                       # creates the bucket + CORS for APP_URL
   pnpm storage:setup https://your-app.vercel.app   # re-run to add extra origins any time
   ```
4. Optional: S3 → bucket → Management → lifecycle rule "abort incomplete multipart uploads after 1 day".
   You may drop `CreateBucket` / `PutBucketCORS` from the policy afterwards.

Any S3-compatible store works (Cloudflare R2, Supabase Storage): set `S3_ENDPOINT` + `S3_FORCE_PATH_STYLE=true`.

## 4. OpenRouter

[openrouter.ai](https://openrouter.ai) → Keys → create → `OPENROUTER_API_KEY`. Add a few dollars of credit.
`OPENROUTER_MODEL` for proposals/summaries; `OPENROUTER_AUDIO_MODEL` (audio-capable) only if you want
"Transcribe" for videos uploaded from the browser (Mac uploads already carry an on-device transcript).

## 5. Deploy on Vercel

1. Fork this repo → [vercel.com/new](https://vercel.com/new) → import the fork. Framework **Next.js**, keep
   defaults (`package.json` runs `prisma generate && next build`). Node 24.
2. **Settings → Environment Variables** (Production + Preview): every var from the table above.
   `APP_URL` = `https://<project>.vercel.app` for now; switch to your subdomain in section 7.
3. Deploy. Open the URL, log in with `ADMIN_PASSWORD`.

CLI alternative:
```bash
pnpm i -g vercel && vercel link
vercel env add APP_URL production        # repeat per var, or paste from .env.local in the dashboard
vercel --prod
```

**Vercel limits that matter:** request bodies ≤ 4.5 MB (profile photo capped at 4 MB; video bytes never
pass through Vercel). "Transcribe" ships the `ffmpeg-static` binary (~45 MB) only with the `/videos/*` route.

## 6. Connect the Mac app

Web app → **Settings → Mac app connection** shows the token. In the Mac app: Settings → Web app →
Server URL = `APP_URL`, API token = `API_TOKEN` → **Test connection**. Build steps in
[upworkrecord-mac](https://github.com/rzouhair/upworkrecord-mac).

## 7. Custom subdomain (e.g. `loom.yourdomain.com`)

1. Vercel → project → **Settings → Domains → Add** `loom.yourdomain.com`. Vercel shows the CNAME target
   (`cname.vercel-dns.com`, or `<project>.vercel.app` also works).
2. DNS provider → add record: type **CNAME**, name `loom`, target from step 1. On Cloudflare set
   **Proxy status: DNS only** (grey cloud). Wait for Vercel to show "Valid configuration" (TLS is automatic).
3. Vercel env → `APP_URL=https://loom.yourdomain.com` → **Redeploy** (env changes need a new deploy).
4. Allow browser uploads from the new origin: locally with the same `APP_URL` in `.env.local`,
   `pnpm storage:setup`.
5. Mac app → Settings → Web app → Server URL = the new URL → Test connection.

Old share links on `*.vercel.app` keep working; new ones use the subdomain.

## 8. Optional: Upwork profile import

Settings → Upwork → **Connect** signs you in to Upwork (OAuth with Upwork's MCP server, public client, no keys).
Then **Import from Upwork** fills the profile form for review. Needs a public https `APP_URL` (prod) or, in dev,
`pnpm tunnel` (Cloudflare quick tunnel via `cloudflared`, writes `UPWORK_OAUTH_BASE_URL`; reconnect after each restart).
Alternative without OAuth: "Import with Claude or Codex" gives a prompt, paste the JSON back.

## Updating

- Pull / merge upstream, push → Vercel deploys.
- Schema changed (new `prisma/migrations/*`)? Run `pnpm db:deploy` against Supabase before or with the deploy
  (or set the Vercel build command to `prisma migrate deploy && pnpm build` with `DIRECT_URL` set).
- Added a domain? `pnpm storage:setup <https://new-origin>` and update `APP_URL`.

## API for the Mac app

`Authorization: Bearer $API_TOKEN`.

| Call | Body | Returns |
|---|---|---|
| `POST /api/uploads` | `{ sizeBytes, title?, contentType?, durationSec?, width?, height? }` | `{ videoId, slug, shareUrl, partSize, parts: [{ partNumber, url }] }` |
| `PUT <part url>` | file slice `[(n-1)*partSize, n*partSize)` | read the `ETag` header |
| `POST /api/uploads/:id/complete` | `{ parts: [{ partNumber, etag }], durationSec?, width?, height?, title?, summary?, transcript?: [{text,start,end}], chapters?: [{start,title}] }` | `{ videoId, slug, shareUrl }` |
| `POST /api/uploads/:id/abort` | — | cancels and deletes |
| `POST /api/videos/:id/assets` | `{ kind: "gif" \| "poster" }` | `{ url, contentType }` → `PUT` the image with that `Content-Type` |

Public: `GET /v/:slug` (share page with og:* tags), `/embed/:slug`, `/api/oembed?url=`,
`/media/videos/:id/{video.mp4,poster.jpg,preview.gif}`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Login works locally, 500 on Vercel | a var is missing in Vercel env (`SESSION_SECRET`, `DATABASE_URL`, `S3_*`); redeploy after adding |
| `Missing env S3_BUCKET` / upload never starts | S3 vars not set, or set only for Preview not Production |
| Browser upload fails with CORS error | `pnpm storage:setup <origin>` for that exact origin (scheme + host) |
| `prisma` "Unknown argument" after pulling | migration not applied: `pnpm db:deploy`; locally restart `pnpm dev` after `pnpm db:migrate` |
| Upwork link preview shows no GIF | `APP_URL` must be the public https URL; re-save the video's GIF in the share panel |
| Mac app "Test connection" fails | token mismatch, trailing slash in URL, or deployment not finished |
| `next dev` logs InvariantError for `/v/[slug]` | known, dev only (`htmlLimitedBots`); production is clean |

## Notes for contributors

- Architecture rules: `NEXTJS-APP-ARCHITECTURE.md`. Next 16 docs: `node_modules/next/dist/docs/`.
- Design: Upwork Air 3 tokens (`styles/air3-tokens.css`, `styles/air3-components.css`), Hanken Grotesk.
  Upwork's logo is not used (trademark).
- Share cards: og:image is the animated GIF (Upwork Messages plays it), JPEG poster fallback; `htmlLimitedBots: /.*/`
  keeps metadata in `<head>` for every crawler.
