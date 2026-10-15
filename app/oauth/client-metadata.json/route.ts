import { clientMetadata, oauthBase } from '@/features/upwork/upwork-mcp';
import { json } from '@/lib/http';

/** OAuth client ID metadata document: Upwork fetches this URL, which *is* our client_id. */
export async function GET() {
  const base = oauthBase();
  if (!base) return json({ error: 'No public https base URL configured' }, 404);
  return json(clientMetadata(base));
}
