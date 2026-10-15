import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Optimistic redirect only (no crypto here): owner pages without a session cookie go to /login.
// Real checks happen in verifyAuth()/verifyOwner() next to the data.
export function proxy(request: NextRequest) {
  if (request.cookies.has('ur_session')) return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except public share/embed pages, media, public APIs, login and static assets.
  matcher: ['/((?!login|v/|embed/|media/|api/|oauth/|_next/|favicon.ico).*)'],
};
