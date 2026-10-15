import { NextResponse } from 'next/server';
import { startConnect } from '@/features/upwork/upwork-mcp';
import { isSignedIn } from '@/lib/auth';
import { appUrl } from '@/lib/http';

/** Owner clicks "Connect Upwork" → Upwork consent screen. */
export async function GET() {
  if (!(await isSignedIn())) return NextResponse.redirect(`${appUrl()}/login?next=/settings`);
  try {
    const url = await startConnect();
    return NextResponse.redirect(url ?? `${appUrl()}/settings?upwork=connected`);
  } catch (e) {
    return NextResponse.redirect(`${appUrl()}/settings?upwork_error=${encodeURIComponent((e as Error).message)}`);
  }
}
