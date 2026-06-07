import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/helpers'
import * as gdrive from '@/lib/integrations/google-drive'
import { googleConfigured, saveGoogleConnection } from '@/lib/integrations/backup'

// OAuth callback: verify state, exchange the code for tokens, and persist the
// (encrypted) refresh token + root folder for the tenant.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const settings = `${origin}/admin/backup`

  const error = request.nextUrl.searchParams.get('error')
  if (error) return NextResponse.redirect(`${settings}?error=denied`)

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  if (!code || !state) return NextResponse.redirect(`${settings}?error=missing_code`)

  if (!googleConfigured()) return NextResponse.redirect(`${settings}?error=not_configured`)

  // Verify the signed state and that it matches the cookie we set at start.
  const cookieState = request.cookies.get('gdrive_oauth_state')?.value
  const parsed = verifyState(state)
  if (!parsed || cookieState !== state) {
    return NextResponse.redirect(`${settings}?error=bad_state`)
  }

  // Confirm the signed-in admin matches the tenant the flow was started for.
  let tenantId: string
  let userId: string
  try {
    const { appUser, tenant } = await getCurrentUser()
    tenantId = tenant.id
    userId = appUser.id
  } catch {
    return NextResponse.redirect(`${settings}?error=auth`)
  }
  if (parsed.tenantId !== tenantId) {
    return NextResponse.redirect(`${settings}?error=tenant_mismatch`)
  }

  try {
    const redirectUri = gdrive.callbackUrl(origin)
    const tokens = await gdrive.exchangeCode(code, redirectUri)
    if (!tokens.refresh_token) {
      // No refresh token (already-granted without prompt=consent). Ask again.
      return NextResponse.redirect(`${settings}?error=no_refresh_token`)
    }
    await saveGoogleConnection({
      tenantId,
      connectedBy: userId,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
    })
  } catch {
    return NextResponse.redirect(`${settings}?error=exchange_failed`)
  }

  const res = NextResponse.redirect(`${settings}?connected=1`)
  res.cookies.delete('gdrive_oauth_state')
  return res
}

function verifyState(state: string): { tenantId: string; userId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const idx = decoded.lastIndexOf('.')
    if (idx === -1) return null
    const payload = decoded.slice(0, idx)
    const sig = decoded.slice(idx + 1)
    const expected = crypto.createHmac('sha256', stateSecret()).update(payload).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const [tenantId, userId, tsStr] = payload.split('.')
    if (!tenantId || !userId || !tsStr) return null
    // 10-minute validity window.
    if (Date.now() - Number(tsStr) > 10 * 60 * 1000) return null
    return { tenantId, userId }
  } catch {
    return null
  }
}

function stateSecret(): string {
  return process.env.INTEGRATION_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'kolrabee'
}
