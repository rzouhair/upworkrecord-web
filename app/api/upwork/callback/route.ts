import { NextResponse } from 'next/server';
import { finishConnect } from '@/features/upwork/upwork-mcp';
import { appUrl } from '@/lib/http';

// Reached through the public tunnel, where the owner's session cookie doesn't exist;
// the OAuth `state` (stored at connect time) is what ties this request to the owner.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const code = params.get('code');
  const error = params.get('error_description') ?? params.get('error');
  try {
    if (error || !code) throw new Error(error ?? 'Upwork did not return a code');
    await finishConnect(code, params.get('state'));
    return NextResponse.redirect(`${appUrl()}/settings?upwork=connected`);
  } catch (e) {
    return NextResponse.redirect(`${appUrl()}/settings?upwork_error=${encodeURIComponent((e as Error).message)}`);
  }
}
