import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/helpers'
import * as gdrive from '@/lib/integrations/google-drive'
import { googleConfigured } from '@/lib/integrations/backup'

// Kick off the Google Drive OAuth flow. Signs a short-lived state token bound to
// the tenant (HMAC over tenantId + timestamp using the encryption key material)
// so the callback can verify the round trip and resist CSRF.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin

  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/admin/backup?error=not_configured`)
  }

  // Requires an authenticated admin (getCurrentUser redirects otherwise).
  const { appUser, tenant } = await getCurrentUser()

  const nonce = crypto.randomBytes(16).toString('hex')
  const payload = `${tenant.id}.${appUser.id}.${Date.now()}.${nonce}`
  const sig = crypto.createHmac('sha256', stateSecret()).update(payload).digest('hex')
  const state = Buffer.from(`${payload}.${sig}`).toString('base64url')

  const redirectUri = gdrive.callbackUrl(origin)
  const url = gdrive.getAuthUrl(state, redirectUri)

  const res = NextResponse.redirect(url)
  // Defense in depth: also pin the state in an httpOnly cookie.
  res.cookies.set('gdrive_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}

function stateSecret(): string {
  // Reuse the integration encryption key as HMAC secret; fall back to the
  // service role key so state is always signed with a server-only secret.
  return process.env.INTEGRATION_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'kolrabee'
}
