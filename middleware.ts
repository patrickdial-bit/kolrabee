import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Admin public routes
  const publicAdminRoutes = ['/admin/login', '/admin/signup', '/admin/forgot-password']

  // Protect super-admin routes (setup page is public, protected by secret key)
  if (pathname.startsWith('/super-admin')) {
    if (pathname === '/super-admin/setup') {
      return supabaseResponse
    }
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    const isPublic = publicAdminRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    )
    if (!isPublic && !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }
  }

  // Skip internal routes for tenant matching
  const skipPrefixes = ['/_next', '/api', '/admin', '/super-admin', '/favicon.ico']
  const shouldSkip = skipPrefixes.some((p) => pathname.startsWith(p)) || pathname === '/'

  if (!shouldSkip) {
    // Tenant routes: /[slug]/...
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      const slug = parts[0]
      const subPath = parts[1]

      // Public tenant routes: join, login, forgot-password
      const publicSubRoutes = ['join', 'login', 'forgot-password']
      const isPublicSubRoute = publicSubRoutes.includes(subPath)

      // Protected tenant routes: dashboard, projects, profile
      if (!isPublicSubRoute && !user) {
        const url = request.nextUrl.clone()
        url.pathname = `/${slug}/login`
        url.searchParams.set('redirectTo', pathname)
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
