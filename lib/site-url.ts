// Canonical base URL for links we hand to people — invite emails, sub login
// links, password resets, homeowner share links, lead-capture webhooks.
//
// Vercel Authentication is enabled on this project scoped to
// all_except_custom_domains, so every *.vercel.app alias redirects to
// vercel.com/sso-api for anyone outside the Vercel team. A link built from a
// gated host dead-ends at that SSO wall instead of reaching the app, and the
// only thing the recipient can do there is request access. These helpers
// refuse to hand back such a host.

const LOCAL_FALLBACK = 'http://localhost:3000'

function normalize(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  // VERCEL_PROJECT_PRODUCTION_URL is always a bare hostname.
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** True for hosts sitting behind Vercel Authentication. */
export function isProtectedHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.vercel.app')
  } catch {
    return false
  }
}

/**
 * Server-side canonical origin. Falls back to a gated host only when nothing
 * better is configured, so a missing env var degrades to the previous
 * behavior rather than to localhost.
 */
export function canonicalSiteUrl(): string {
  const configured = normalize(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured && !isProtectedHost(configured)) return configured

  const production = normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  if (production && !isProtectedHost(production)) return production

  return configured ?? production ?? LOCAL_FALLBACK
}

/**
 * Client-side origin. Only NEXT_PUBLIC_SITE_URL is inlined into the browser
 * bundle, so fall back to the current origin — except when that origin is
 * itself gated, which is exactly the case this guards against: an admin
 * working on a *.vercel.app preview copying a link for someone else.
 */
export function clientSiteUrl(): string {
  const configured = normalize(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured && !isProtectedHost(configured)) return configured

  if (typeof window !== 'undefined' && !isProtectedHost(window.location.origin)) {
    return window.location.origin
  }

  return configured ?? LOCAL_FALLBACK
}
