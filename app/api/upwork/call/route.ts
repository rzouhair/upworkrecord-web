import { z } from 'zod';
import { callTool } from '@/features/upwork/upwork-mcp';
import { verifyOwner } from '@/lib/auth';
import { json, parseBody, unauthorized } from '@/lib/http';

const schema = z.object({ name: z.string().min(1), arguments: z.record(z.string(), z.unknown()).default({}) });

/** Owner-only passthrough to one Upwork MCP tool (debugging + building features on real data). */
export async function POST(req: Request) {
  if (!(await verifyOwner(req))) return unauthorized();
  const body = await parseBody(req, schema);
  if ('error' in body) return body.error;
  try {
    return json(await callTool(body.data.name, body.data.arguments));
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
