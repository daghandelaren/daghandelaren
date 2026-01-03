import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Public routes - always accessible
  if (pathname === '/' ||
      pathname.startsWith('/api/auth') ||
      pathname === '/api/access-request' ||
      pathname.startsWith('/api/charts') ||
      pathname.startsWith('/api/fundamental')) {
    return NextResponse.next();
  }

  // Get the token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // If no token, redirect to home page (login)
  if (!token) {
    // Redirect to home without callbackUrl to keep it clean
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Admin routes - require ADMIN role
  if (pathname.startsWith('/admin')) {
    if (token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
