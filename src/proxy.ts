import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

const PROTECTED_PAGE_PREFIXES = ['/client']

function hasSessionCookie(req: NextRequest): boolean {
  return (
    req.cookies.has('authjs.session-token') ||
    req.cookies.has('__Secure-authjs.session-token')
  )
}

function stripLocalePrefix(pathname: string): string {
  const localePattern = /^\/(fr|en)(\/|$)/
  return pathname.replace(localePattern, '/') || '/'
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip static files and favicon
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  // API routes — no locale handling, just auth check
  if (pathname.startsWith('/api')) {
    if (pathname.startsWith('/api/external') && !hasSessionCookie(req)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // For page routes: strip locale to check if protected
  const pathWithoutLocale = stripLocalePrefix(pathname)

  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((prefix) =>
    pathWithoutLocale.startsWith(prefix),
  )

  if (isProtectedPage && !hasSessionCookie(req)) {
    const localeMatch = pathname.match(/^\/(fr|en)(\/|$)/)
    const locale = localeMatch ? localeMatch[1] : 'fr'
    const url = req.nextUrl.clone()
    url.pathname = `/${locale}/login`
    return NextResponse.redirect(url)
  }

  // Apply i18n middleware (handles locale prefix and negotiation)
  return intlMiddleware(req)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
