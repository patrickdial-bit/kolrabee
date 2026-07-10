import { NextRequest, NextResponse } from 'next/server'
import { runDailyHoursDigest } from '@/lib/daily-hours'

// Daily painter-hours digest for admins. Triggered by Vercel Cron (see
// vercel.json) in the evening US time so each tenant's "today" is mostly
// complete. Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`
// when the CRON_SECRET env var is set; we reject anything else so the endpoint
// can't be invoked by the public.

export const dynamic = 'force-dynamic'
// Hobby plan caps function duration at 60s. Raise if on Pro.
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const summary = await runDailyHoursDigest()
  console.log(
    `[cron/daily-hours] tenants=${summary.tenants} emailed=${summary.tenantsEmailed} ` +
      `emails=${summary.emails} skipped=${summary.skipped} failed=${summary.failed}`,
  )

  return NextResponse.json({ success: true, ...summary })
}
