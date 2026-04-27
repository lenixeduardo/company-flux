import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

const ALWAYS_PUBLIC = [
  '/_next',
  '/favicon.ico',
  '/api/webhooks',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ALWAYS_PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has('flux-session');

  const isAuthPage = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isInvite = pathname.startsWith('/invite/');
  const isOnboarding = pathname.startsWith('/onboarding');
  const isPublic = isAuthPage || isInvite;

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
