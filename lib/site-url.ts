// Canonical absolute base URL for building links in emails (invites, job
// notifications, password resets, Stripe redirects).
//
// IMPORTANT: never fall back to VERCEL_PROJECT_PRODUCTION_URL / the *.vercel.app
// host. Those deployment URLs sit behind Vercel's Deployment Protection (its own
// login wall), so links pointing there send subcontractors into a "request
// access" screen instead of the app. Prefer the explicit env var, then the
// canonical production domain, and only use localhost in local development.

const CANONICAL_PROD_URL = 'https://www.kolrabee.com'

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (process.env.NODE_ENV === 'production') return CANONICAL_PROD_URL
  return 'http://localhost:3000'
}
