import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Lightweight middleware — checks for NextAuth session cookie.
// Full session + role validation happens in Server Components & API routes.

const PROTECTED_PAGE_PREFIXES = ['/client']

function hasSessionCookie(req: NextRequest): boolean {
  return (
    req.cookies.has('authjs.session-token') ||
    req.cookies.has('__Secure-authjs.session-token')
  )
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public routes — skip
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Protected pages
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  )

  if (isProtectedPage && !hasSessionCookie(req)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Protected API routes
  if (pathname.startsWith('/api/external') && !hasSessionCookie(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
