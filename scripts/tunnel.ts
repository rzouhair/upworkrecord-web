/* eslint-disable no-console -- CLI script output */
/**
 * `pnpm tunnel`: public https URL for localhost:3000 (Cloudflare quick tunnel, no account),
 * written to .env.local as UPWORK_OAUTH_BASE_URL so Upwork can fetch our OAuth client ID
 * document and redirect back. `next dev` reloads .env.local by itself. The URL changes every
 * run: reconnect Upwork after restarting the tunnel. Ctrl+C to stop.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENV = '.env.local';
const port = process.env.PORT ?? '3000';

function setEnv(url: string) {
  const lines = readFileSync(ENV, 'utf8').split('\n').filter(l => !l.startsWith('UPWORK_OAUTH_BASE_URL='));
  lines.push(`UPWORK_OAUTH_BASE_URL=${url}`);
  writeFileSync(ENV, lines.join('\n').replace(/\n+$/, '') + '\n');
}

const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let announced = false;
const onData = (buf: Buffer) => {
  const url = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(buf.toString())?.[0];
  if (url && !announced) {
    announced = true;
    setEnv(url);
    console.log(`\nTunnel: ${url}\nWrote UPWORK_OAUTH_BASE_URL to ${ENV}. Open Settings → Upwork → Connect.\n`);
  }
};
cf.stdout.on('data', onData);
cf.stderr.on('data', onData);
cf.on('exit', code => process.exit(code ?? 0));
process.on('SIGINT', () => cf.kill('SIGINT'));
