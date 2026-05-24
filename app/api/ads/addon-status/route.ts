import { NextResponse } from 'next/server'
import { getApiUser, getAddonSettings } from '@/lib/ads/access'

// Reports whether the Ads Agent add-on is enabled for the caller's tenant.
// Unlike the other routes this does NOT 403 when disabled — the nav uses it to
// decide whether to show the Ads Agent link.
export async function GET() {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ enabled: false }, { status: 200 })

  const settings = await getAddonSettings(user.tenant.id)
  return NextResponse.json({
    enabled: settings.enabled,
    compliance_status: settings.compliance_status,
    monthly_run_limit: settings.monthly_run_limit,
    runs_this_month: settings.runs_this_month,
    role: user.appUser.role,
  })
}
