import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  devIndicators: {
    position: 'bottom-right',
  },
  // Put metadata in <head> for every client, not only the bots Next knows about. Link-preview
  // fetchers (Upwork, Slack, WhatsApp…) must see og:* tags in the first response.
  // Known cost: `next dev` logs an InvariantError for /v/[slug] ("did not produce a static
  // shell"). Production is clean and the tags are correct; verified 16.3.0.
  htmlLimitedBots: /.*/,
  partialPrefetching: true,
  reactCompiler: true,
  // ffmpeg-static resolves its binary next to its own file: keep it unbundled and ship the binary
  // (real .pnpm path: a glob through the node_modules symlink breaks Vercel's function package)
  // with the route that runs Transcribe (server action on the video page).
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: { '/videos/*': ['./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg'] },
  typedRoutes: true,
  experimental: {
    inlineCss: true,
    // Profile photo upload goes through a server action (storePhoto caps it at 4 MB; Vercel's body limit is 4.5 MB).
    serverActions: { bodySizeLimit: '4.5mb' },
  },
};

export default nextConfig;
