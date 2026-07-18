import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDailyHoursEmail, type DailyHoursJobSection } from '@/lib/email'
import { dayRange, formatMinutes, sumDurationMinutes } from '@/lib/time-tracking'
import { getNotificationPrefs, hasTimeTracking } from '@/lib/types'

type DigestSummary = {
  tenants: number
  tenantsEmailed: number
  emails: number
  skipped: number
  failed: number
}

// Send each tenant's admins a digest of today's painter hours per job,
// compared to the project's estimated labor hours. Runs once per day via cron;
// "today" is computed in the tenant's timezone at fire time.
export async function runDailyHoursDigest(): Promise<DigestSummary> {
  const adminClient = createAdminClient()

  const { data: tenants } = await adminClient
    .from('tenants')
    .select('*')
    .eq('status', 'active')

  const summary: DigestSummary = {
    tenants: tenants?.length ?? 0,
    tenantsEmailed: 0,
    emails: 0,
    skipped: 0,
    failed: 0,
  }

  for (const tenant of tenants ?? []) {
    try {
      if (!hasTimeTracking(tenant)) {
        summary.skipped++
        continue
      }

      const timezone = tenant.timezone || 'America/New_York'
      const { startUtc, endUtc, dayLabel } = dayRange(new Date(), timezone)

      const { data: entries } = await adminClient
        .from('time_entries')
        .select(
          'subcontractor_id, crew_member_id, project_id, clock_in, clock_out, duration_minutes, project:project_id (customer_name, job_number, estimated_labor_hours), subcontractor:subcontractor_id (first_name, last_name), crew_member:crew_member_id (first_name, last_name)'
        )
        .eq('tenant_id', tenant.id)
        .gte('clock_in', startUtc)
        .lte('clock_in', endUtc)
        .order('clock_in', { ascending: true })

      // Entries still open from BEFORE today — someone forgot to clock out.
      // These must be surfaced even on days with no new activity.
      const { data: carriedOpen } = await adminClient
        .from('time_entries')
        .select(
          'clock_in, project:project_id (customer_name, job_number), subcontractor:subcontractor_id (first_name, last_name), crew_member:crew_member_id (first_name, last_name)'
        )
        .eq('tenant_id', tenant.id)
        .is('clock_out', null)
        .lt('clock_in', startUtc)

      const openAlerts = (carriedOpen ?? []).map((e: any) => {
        const painter = e.crew_member
          ? `${e.crew_member.first_name} ${e.crew_member.last_name}`.trim()
          : `${`${e.subcontractor?.first_name ?? ''} ${e.subcontractor?.last_name ?? ''}`.trim() || 'Unknown'} (lead)`
        const jobLabel = e.project
          ? e.project.job_number
            ? `#${e.project.job_number} – ${e.project.customer_name}`
            : e.project.customer_name
          : 'Unknown job'
        const since = format(toZonedTime(new Date(e.clock_in), timezone), 'EEE, MMM d h:mm a')
        return { painter, jobLabel, sinceLabel: since }
      })

      if ((!entries || entries.length === 0) && openAlerts.length === 0) {
        summary.skipped++
        continue
      }

      const { data: admins } = await adminClient
        .from('users')
        .select('email, notification_preferences')
        .eq('tenant_id', tenant.id)
        .eq('role', 'admin')
        .eq('status', 'active')

      const recipients = (admins ?? []).filter(
        (admin) => getNotificationPrefs(admin).daily_hours_summary
      )
      if (recipients.length === 0) {
        summary.skipped++
        continue
      }

      // All-time hours per project for the estimated-vs-actual comparison
      const projectIds = Array.from(new Set(((entries ?? []) as any[]).map((e) => e.project_id)))
      const toDateByProject = new Map<string, number>()
      if (projectIds.length > 0) {
        const { data: allEntries } = await adminClient
          .from('time_entries')
          .select('project_id, clock_in, clock_out, duration_minutes')
          .eq('tenant_id', tenant.id)
          .in('project_id', projectIds)

        for (const id of projectIds) {
          toDateByProject.set(
            id,
            sumDurationMinutes((allEntries ?? []).filter((e) => e.project_id === id))
          )
        }
      }

      const jobs = buildJobSections((entries ?? []) as any[], toDateByProject, timezone)
      const totalLabel = formatMinutes(sumDurationMinutes((entries ?? []) as any[]))
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

      for (const admin of recipients) {
        await sendDailyHoursEmail({
          to: admin.email,
          tenantName: tenant.name,
          notificationEmail: tenant.notification_email,
          dayLabel,
          totalLabel,
          jobs,
          openAlerts,
          timeTrackingUrl: `${siteUrl}/admin/time-tracking`,
        })
        summary.emails++
      }
      summary.tenantsEmailed++
    } catch (err) {
      console.error(`[daily-hours] tenant ${tenant.id} failed:`, err)
      summary.failed++
    }
  }

  return summary
}

function buildJobSections(
  entries: any[],
  toDateByProject: Map<string, number>,
  timezone: string
): DailyHoursJobSection[] {
  const byProject = new Map<string, any[]>()
  for (const e of entries) {
    const list = byProject.get(e.project_id)
    if (list) list.push(e)
    else byProject.set(e.project_id, [e])
  }

  const jobs: Array<DailyHoursJobSection & { todayMinutes: number }> = []
  for (const [projectId, jobEntries] of Array.from(byProject.entries())) {
    const project = jobEntries[0].project
    const jobLabel = project
      ? project.job_number
        ? `#${project.job_number} – ${project.customer_name}`
        : project.customer_name
      : 'Unknown job'
    const todayMinutes = sumDurationMinutes(jobEntries)

    // One section per painter: the lead's own entries have no crew_member_id
    const byPainter = new Map<string, { name: string; isLead: boolean; entries: any[] }>()
    for (const e of jobEntries) {
      const key = e.crew_member_id ? `crew:${e.crew_member_id}` : `lead:${e.subcontractor_id}`
      let painter = byPainter.get(key)
      if (!painter) {
        const name = e.crew_member
          ? `${e.crew_member.first_name} ${e.crew_member.last_name}`.trim()
          : `${`${e.subcontractor?.first_name ?? ''} ${e.subcontractor?.last_name ?? ''}`.trim() || 'Unknown'} (lead)`
        painter = { name, isLead: !e.crew_member_id, entries: [] }
        byPainter.set(key, painter)
      }
      painter.entries.push(e)
    }

    const painters = Array.from(byPainter.values())
      .sort((a, b) => (a.isLead === b.isLead ? a.name.localeCompare(b.name) : a.isLead ? -1 : 1))
      .map((p) => ({
        name: p.name,
        totalLabel: formatMinutes(sumDurationMinutes(p.entries)),
        entries: p.entries.map((e) => ({ range: formatRange(e, timezone) })),
      }))

    const toDateMinutes = toDateByProject.get(projectId) ?? todayMinutes
    const estimated = project?.estimated_labor_hours
    let estimateLine: string
    let overEstimate = false
    if (estimated !== null && estimated !== undefined) {
      const estimatedMinutes = Math.round(Number(estimated) * 60)
      overEstimate = toDateMinutes > estimatedMinutes
      const pct = estimatedMinutes > 0 ? Math.round((toDateMinutes / estimatedMinutes) * 100) : null
      estimateLine = `${formatMinutes(toDateMinutes)} to date of ${formatMinutes(estimatedMinutes)} estimated${pct !== null ? ` (${pct}%)` : ''}${overEstimate ? ' — over estimate' : ''}`
    } else {
      estimateLine = `${formatMinutes(toDateMinutes)} to date (no labor estimate set)`
    }

    jobs.push({ jobLabel, todayLabel: formatMinutes(todayMinutes), estimateLine, overEstimate, painters, todayMinutes })
  }

  return jobs
    .sort((a, b) => b.todayMinutes - a.todayMinutes)
    .map(({ todayMinutes, ...section }) => section)
}

function formatRange(e: { clock_in: string; clock_out: string | null }, timezone: string): string {
  const inLabel = format(toZonedTime(new Date(e.clock_in), timezone), 'h:mm a')
  if (!e.clock_out) return `${inLabel} – still clocked in`
  return `${inLabel} – ${format(toZonedTime(new Date(e.clock_out), timezone), 'h:mm a')}`
}
