import { refreshTools, status } from '@/features/upwork/upwork-mcp';
import { verifyOwner } from '@/lib/auth';
import { json, unauthorized } from '@/lib/http';

/** Owner-only: the connected server's tools (cached; `?refresh=1` re-lists). */
export async function GET(req: Request) {
  if (!(await verifyOwner(req))) return unauthorized();
  try {
    if (new URL(req.url).searchParams.get('refresh')) return json({ tools: await refreshTools() });
    return json(await status());
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
