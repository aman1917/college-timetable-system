import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readToken } from '@/lib/auth';

/**
 * Edge guard: redirects unauthenticated traffic to /login before a page renders.
 *
 * This is a convenience, NOT the security boundary — every API route re-checks
 * the session and role on its own. Middleware alone would leave the JSON
 * endpoints open to anyone who skipped the HTML.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';
  if (isPublic) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readToken(token) : null;

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
