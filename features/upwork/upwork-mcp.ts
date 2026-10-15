import 'server-only';

import { randomBytes } from 'node:crypto';
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { open, seal } from '@/lib/crypto-box';
import { prisma } from '@/lib/db';

/**
 * Upwork's official MCP server (https://mcp.upwork.com/mcp), used with the account owner's
 * own OAuth grant. Upwork identifies clients by a *client ID metadata document*: our client_id
 * is an https URL serving `clientMetadata()` (app/oauth/client-metadata.json). In dev that URL
 * comes from `pnpm tunnel` (UPWORK_OAUTH_BASE_URL); in prod it's the deployed APP_URL.
 */
export const UPWORK_MCP_URL = new URL('https://mcp.upwork.com/mcp');
const ROW = 'upwork';

export function oauthBase(): string | null {
  const base = (process.env.UPWORK_OAUTH_BASE_URL || process.env.APP_URL || '').replace(/\/$/, '');
  return base.startsWith('https://') ? base : null;
}

export function clientMetadata(base: string): OAuthClientMetadata & { client_id: string } {
  return {
    client_id: `${base}/oauth/client-metadata.json`,
    client_name: 'UpworkRecord',
    client_uri: base,
    redirect_uris: [`${base}/api/upwork/callback`],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
}

async function row() {
  return prisma.integration.upsert({ where: { id: ROW }, create: { id: ROW }, update: {} });
}

async function save(data: Parameters<typeof prisma.integration.update>[0]['data']) {
  await prisma.integration.upsert({ where: { id: ROW }, create: { id: ROW, ...(data as object) }, update: data });
}

/** OAuth state persisted in Postgres (secrets sealed). */
class UpworkAuthProvider implements OAuthClientProvider {
  authorizationUrl?: URL;
  constructor(private readonly base: string) {}

  get redirectUrl() {
    return `${this.base}/api/upwork/callback`;
  }
  get clientMetadataUrl() {
    return `${this.base}/oauth/client-metadata.json`;
  }
  get clientMetadata() {
    return clientMetadata(this.base);
  }
  async state() {
    const state = randomBytes(16).toString('hex');
    await save({ oauthState: state });
    return state;
  }
  async clientInformation() {
    return open<OAuthClientInformationMixed>((await row()).clientInfo);
  }
  async saveClientInformation(info: OAuthClientInformationMixed) {
    await save({ clientInfo: seal(info) });
  }
  async tokens() {
    return open<OAuthTokens>((await row()).tokens);
  }
  async saveTokens(tokens: OAuthTokens) {
    await save({ tokens: seal(tokens), connectedAt: new Date() });
  }
  redirectToAuthorization(url: URL) {
    this.authorizationUrl = url; // the route handler performs the redirect
  }
  async saveCodeVerifier(verifier: string) {
    await save({ codeVerifier: seal(verifier) });
  }
  async codeVerifier() {
    const v = open<string>((await row()).codeVerifier);
    if (!v) throw new Error('No PKCE verifier: start the Upwork connection again');
    return v;
  }
  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery') {
    if (scope === 'all') await save({ clientInfo: null, tokens: null, codeVerifier: null, connectedAt: null });
    if (scope === 'client') await save({ clientInfo: null });
    if (scope === 'tokens') await save({ tokens: null, connectedAt: null });
    if (scope === 'verifier') await save({ codeVerifier: null });
  }
}

/** Base URL the stored client was registered under (refreshes must keep using it). */
async function providerBase() {
  const info = open<OAuthClientInformationMixed>((await row()).clientInfo);
  const fromClient = info?.client_id?.replace(/\/oauth\/client-metadata\.json$/, '');
  return fromClient?.startsWith('https://') ? fromClient : oauthBase();
}

/** Step 1: returns Upwork's consent URL (null if already authorized). */
export async function startConnect(): Promise<URL | null> {
  const base = oauthBase();
  if (!base) throw new Error('Set a public https URL first: run `pnpm tunnel` (or deploy and set APP_URL).');
  await save({ clientInfo: null, tokens: null, codeVerifier: null }); // fresh grant for this base URL
  const provider = new UpworkAuthProvider(base);
  const result = await auth(provider, { serverUrl: UPWORK_MCP_URL });
  return result === 'REDIRECT' ? (provider.authorizationUrl ?? null) : null;
}

/** Step 2 (callback): exchange the code, then cache the tool list. */
export async function finishConnect(code: string, state: string | null) {
  const current = await row();
  if (!state || state !== current.oauthState) throw new Error('OAuth state mismatch: start the connection again');
  const base = await providerBase();
  if (!base) throw new Error('No public base URL');
  await auth(new UpworkAuthProvider(base), { serverUrl: UPWORK_MCP_URL, authorizationCode: code });
  await save({ oauthState: null, codeVerifier: null });
  await refreshTools();
}

export async function disconnect() {
  await prisma.integration.deleteMany({ where: { id: ROW } });
}

export async function status() {
  const r = await prisma.integration.findUnique({ where: { id: ROW } });
  const tools = Array.isArray(r?.tools) ? (r.tools as { name: string; description?: string }[]) : [];
  return { connected: !!r?.tokens, connectedAt: r?.connectedAt?.toISOString() ?? null, tools, oauthBase: oauthBase() };
}

/** Run `fn` with a connected MCP client (tokens refresh automatically). */
export async function withUpwork<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const base = await providerBase();
  if (!base) throw new Error('Upwork is not connected');
  const client = new Client({ name: 'UpworkRecord', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(UPWORK_MCP_URL, { authProvider: new UpworkAuthProvider(base) });
  try {
    await client.connect(transport);
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

export async function refreshTools() {
  const tools = await withUpwork(async c => (await c.listTools()).tools);
  const slim = tools.map(t => ({ name: t.name, description: t.description ?? '', inputSchema: t.inputSchema }));
  await save({ tools: JSON.parse(JSON.stringify(slim)) as object });
  return slim;
}

/** Call a tool; returns parsed JSON when the text content is JSON, else the text. */
export async function callTool(name: string, args: Record<string, unknown>) {
  const result = await withUpwork(c => c.callTool({ name, arguments: args }));
  const texts = (Array.isArray(result.content) ? result.content : [])
    .filter((c): c is { type: 'text'; text: string } => c?.type === 'text')
    .map(c => c.text);
  const joined = texts.join('\n');
  let data: unknown = joined;
  try {
    data = JSON.parse(joined);
  } catch {}
  return { isError: !!result.isError, data, structured: result.structuredContent ?? null };
}
