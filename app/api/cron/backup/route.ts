import { NextRequest, NextResponse } from 'next/server'
import { runScheduledBackups } from '@/lib/integrations/backup'

// Nightly auto-backup of jobs with new files. Triggered by Vercel Cron (see
// vercel.json). Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`
// when the CRON_SECRET env var is set; we reject anything else so the endpoint
// can't be invoked by the public.

export const dynamic = 'force-dynamic'
// Hobby plan caps function duration at 60s; the dedupe keeps incremental runs
// cheap and the per-run job cap bounds total work. Raise if on Pro.
export const maxDuration = 60

// Process at most this many jobs per nightly run, oldest-backup-first; the
// nightly cadence works through any backlog over successive nights.
const JOBS_PER_RUN = 10

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const summary = await runScheduledBackups(JOBS_PER_RUN)
  console.log(
    `[cron/backup] jobs=${summary.jobs} uploaded=${summary.ok} skipped=${summary.skipped} ` +
      `failed=${summary.failed} errors=${summary.errors}`,
  )

  return NextResponse.json({ success: true, ...summary })
}
