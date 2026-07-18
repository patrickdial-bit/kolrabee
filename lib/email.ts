import { Resend } from 'resend'

// Lazy init (like getStripe) so importing this module never throws at build
// time when RESEND_API_KEY isn't set.
let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const DEFAULT_FROM = 'Kolrabee <notifications@contact.kolrabee.com>'

function getFrom(tenantName: string, notificationEmail: string | null) {
  if (notificationEmail) {
    return `${tenantName} via Kolrabee <notifications@contact.kolrabee.com>`
  }
  return DEFAULT_FROM
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type InviteEmailParams = {
  to: string
  subName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
  city: string
  startDate: string | null
  payout: number
  projectUrl: string
}

type AcceptEmailParams = {
  to: string
  subName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
  address: string
  startDate: string | null
  payout: number
  projectUrl: string
}

type DeclineEmailParams = {
  to: string
  subName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
  projectUrl: string
}

type StatusUpdateEmailParams = {
  to: string
  subName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
  newStatus: string
  projectUrl: string
}

type CancelEmailParams = {
  to: string
  subName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
  projectUrl: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(date: string | null): string {
  if (!date) return 'TBD'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Email 0: Invite subcontractor to join the platform */
export async function sendPlatformInviteEmail(params: {
  to: string
  name: string
  tenantName: string
  notificationEmail: string | null
  joinUrl: string
}) {
  const { to, name, tenantName, notificationEmail, joinUrl } = params
  const greeting = name ? `Hi ${name},` : 'Hi,'

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `${tenantName} has invited you to join Kolrabee`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">You're Invited!</h2>
          <p style="color: #666; margin-top: 0;">${greeting} <strong>${tenantName}</strong> has invited you to join Kolrabee to receive and accept job opportunities.</p>
          <p style="color: #666;">Click the button below to create your account and get started.</p>
          <a href="${joinUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">Create Your Account</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">Once you sign up, you'll be able to view available jobs, accept projects, and track your earnings.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send platform invite email:', err)
  }
}

/** Email 0b: Invite someone to join the platform as an admin */
export async function sendAdminInviteEmail(params: {
  to: string
  name: string
  tenantName: string
  notificationEmail: string | null
  joinUrl: string
}) {
  const { to, name, tenantName, notificationEmail, joinUrl } = params
  const greeting = name ? `Hi ${name},` : 'Hi,'

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `${tenantName} has invited you to help manage their Kolrabee account`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">You're Invited to Join as an Admin</h2>
          <p style="color: #666; margin-top: 0;">${greeting} <strong>${tenantName}</strong> has invited you to help manage their Kolrabee account as an administrator.</p>
          <p style="color: #666;">As an admin, you'll be able to post projects, invite subcontractors, approve completions, and manage the team.</p>
          <a href="${joinUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">Create Your Admin Account</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">This invitation link will expire in 30 days. If you weren't expecting this, you can safely ignore this email.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send admin invite email:', err)
  }
}

/** Email 1: Sub invited to a project */
export async function sendInviteEmail(params: InviteEmailParams) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName, city, startDate, payout, projectUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `${tenantName}: New job available — ${customerName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">New Job Available</h2>
          <p style="color: #666; margin-top: 0;">Hi ${subName}, ${tenantName} has invited you to a project.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #666; width: 120px;">Job</td><td style="padding: 8px 0; font-weight: 600;">${jobLabel}${customerName}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Location</td><td style="padding: 8px 0;">${city}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Start Date</td><td style="padding: 8px 0;">${formatDate(startDate)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Payout</td><td style="padding: 8px 0; font-weight: 600; color: #16a34a;">${formatCurrency(payout)}</td></tr>
          </table>
          <a href="${projectUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View &amp; Accept</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">Log in to your Kolrabee account to accept or decline this job.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send invite email:', err)
  }
}

/** Email 2: Sub accepted a project — notify admin */
export async function sendAcceptEmail(params: AcceptEmailParams) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName, address, startDate, payout, projectUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `${subName} accepted ${jobLabel}${customerName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">Project Accepted</h2>
          <p style="color: #666; margin-top: 0;"><strong>${subName}</strong> has accepted a project.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #666; width: 120px;">Job</td><td style="padding: 8px 0; font-weight: 600;">${jobLabel}${customerName}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Address</td><td style="padding: 8px 0;">${address}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Start Date</td><td style="padding: 8px 0;">${formatDate(startDate)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Payout</td><td style="padding: 8px 0; font-weight: 600;">${formatCurrency(payout)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Subcontractor</td><td style="padding: 8px 0;">${subName}</td></tr>
          </table>
          <a href="${projectUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">View Project</a>
          <p style="color: #999; font-size: 13px;">Log in to your Kolrabee admin dashboard for details.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send accept email:', err)
  }
}

/** Email 3: Sub declined a project — notify admin */
export async function sendDeclineEmail(params: DeclineEmailParams) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName, projectUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `${subName} declined ${jobLabel}${customerName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #d97706; margin-bottom: 4px;">Project Declined</h2>
          <p style="color: #666; margin-top: 0;"><strong>${subName}</strong> has declined <strong>${jobLabel}${customerName}</strong>.</p>
          <p style="color: #666;">You may want to invite another subcontractor to this project.</p>
          <a href="${projectUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">View Project</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">Log in to your Kolrabee admin dashboard to manage this project.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send decline email:', err)
  }
}

/** Email 4: Sub requested completion — notify admin */
export async function sendCompletionRequestEmail(params: {
  to: string
  subName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
}) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `${subName} marked ${jobLabel}${customerName} as complete`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">Completion Requested</h2>
          <p style="color: #666; margin-top: 0;"><strong>${subName}</strong> has marked <strong>${jobLabel}${customerName}</strong> as complete and is awaiting your approval.</p>
          <p style="color: #666;">Log in to your Kolrabee admin dashboard to review and approve the completion.</p>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">Once you approve, the project will move to completed status.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send completion request email:', err)
  }
}

/** Email 5: Admin approved completion — notify sub */
export async function sendCompletionApprovedEmail(params: {
  to: string
  subName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
  payout: number
  loginUrl: string
}) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName, payout, loginUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `${jobLabel}${customerName} has been approved as complete`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #16a34a; margin-bottom: 4px;">Job Completed!</h2>
          <p style="color: #666; margin-top: 0;">Hi ${subName}, <strong>${tenantName}</strong> has approved the completion of <strong>${jobLabel}${customerName}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #666; width: 120px;">Job</td><td style="padding: 8px 0; font-weight: 600;">${jobLabel}${customerName}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Payout</td><td style="padding: 8px 0; font-weight: 600; color: #16a34a;">${formatCurrency(payout)}</td></tr>
          </table>
          <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Details</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">Your YTD earnings have been updated.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send completion approved email:', err)
  }
}

/** Email 6: New message notification */
export async function sendMessageNotificationEmail(params: {
  to: string
  senderName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
  messagePreview: string
  loginUrl: string
}) {
  const { to, senderName, tenantName, notificationEmail, jobNumber, customerName, messagePreview, loginUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `New message from ${senderName} on ${jobLabel}${customerName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">New Message</h2>
          <p style="color: #666; margin-top: 0;"><strong>${escapeHtml(senderName)}</strong> sent a message on <strong>${escapeHtml(jobLabel + customerName)}</strong>:</p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #374151; margin: 0; white-space: pre-wrap;">${escapeHtml(messagePreview)}</p>
          </div>
          <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View &amp; Reply</a>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send message notification email:', err)
  }
}

export type DailyHoursJobSection = {
  jobLabel: string
  todayLabel: string
  estimateLine: string
  overEstimate: boolean
  painters: Array<{
    name: string
    totalLabel: string
    entries: Array<{ range: string }>
  }>
}

/** Daily digest: painter hours per job vs estimated labor hours — sent to admins */
export async function sendDailyHoursEmail(params: {
  to: string
  tenantName: string
  notificationEmail: string | null
  dayLabel: string
  totalLabel: string
  jobs: DailyHoursJobSection[]
  /** Entries still open from before today — forgotten clock-outs to flag. */
  openAlerts?: Array<{ painter: string; jobLabel: string; sinceLabel: string }>
  timeTrackingUrl: string
}) {
  const { to, tenantName, notificationEmail, dayLabel, totalLabel, jobs, openAlerts = [], timeTrackingUrl } = params

  const alertSection = openAlerts.length
    ? `
        <div style="border: 1px solid #fca5a5; background: #fef2f2; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
          <p style="color: #b91c1c; font-weight: 700; margin: 0 0 6px; font-size: 14px;">⚠ Still on the clock from earlier days</p>
          ${openAlerts
            .map(
              (a) => `
          <p style="color: #7f1d1d; margin: 0 0 2px; font-size: 13px;">${escapeHtml(a.painter)} — since ${escapeHtml(a.sinceLabel)} on ${escapeHtml(a.jobLabel)}</p>`
            )
            .join('')}
          <p style="color: #991b1b; margin: 6px 0 0; font-size: 12px;">These entries bank hours until someone clocks them out — have the crew leader enter the actual end time.</p>
        </div>`
    : ''

  const jobSections = jobs
    .map(
      (job) => `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #1a1a1a; margin: 0 0 4px; font-size: 16px;">${escapeHtml(job.jobLabel)}</h3>
          <p style="color: #374151; margin: 0 0 2px; font-size: 14px;">Today: <strong>${job.todayLabel}</strong></p>
          <p style="color: ${job.overEstimate ? '#dc2626' : '#6b7280'}; margin: 0 0 12px; font-size: 13px;">${escapeHtml(job.estimateLine)}</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <th style="text-align: left; color: #6b7280; font-size: 12px; text-transform: uppercase; padding: 4px 0; border-bottom: 1px solid #e5e7eb;">Painter</th>
              <th style="text-align: left; color: #6b7280; font-size: 12px; text-transform: uppercase; padding: 4px 0; border-bottom: 1px solid #e5e7eb;">Clock in – out</th>
              <th style="text-align: right; color: #6b7280; font-size: 12px; text-transform: uppercase; padding: 4px 0; border-bottom: 1px solid #e5e7eb;">Hours</th>
            </tr>
            ${job.painters
              .map(
                (p) => `
            <tr>
              <td style="padding: 6px 8px 6px 0; color: #111827; vertical-align: top;">${escapeHtml(p.name)}</td>
              <td style="padding: 6px 8px 6px 0; color: #374151; vertical-align: top;">${p.entries.map((en) => escapeHtml(en.range)).join('<br>')}</td>
              <td style="padding: 6px 0; color: #111827; text-align: right; vertical-align: top; white-space: nowrap;">${p.totalLabel}</td>
            </tr>`
              )
              .join('')}
          </table>
        </div>`
    )
    .join('')

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `Painter hours for ${dayLabel} — ${totalLabel}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">Daily Hours Report</h2>
          <p style="color: #666; margin-top: 0;">${escapeHtml(dayLabel)} · <strong>${totalLabel}</strong> logged across ${jobs.length} job${jobs.length === 1 ? '' : 's'}</p>
          ${alertSection}
          ${jobSections}
          <a href="${timeTrackingUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Open Time Tracking</a>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send daily hours email:', err)
  }
}

/** Email 7: Sub cancelled an accepted project — notify admin */
export async function sendCancelEmail(params: CancelEmailParams) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName, projectUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `${subName} cancelled ${jobLabel}${customerName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #dc2626; margin-bottom: 4px;">Project Cancelled</h2>
          <p style="color: #666; margin-top: 0;"><strong>${subName}</strong> has cancelled their acceptance of <strong>${jobLabel}${customerName}</strong>.</p>
          <p style="color: #666;">The project has been returned to <strong>Available</strong> status and can be reassigned.</p>
          <a href="${projectUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">View Project</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">Log in to your Kolrabee admin dashboard to reassign this project.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send cancel email:', err)
  }
}

/** Email 8: Notify sub they got paid — the money email */
export async function sendPaidEmail(params: {
  to: string
  subName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
  payout: number
  dashboardUrl: string
}) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName, payout, dashboardUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''
  const formattedPayout = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(payout)

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `You got paid! ${formattedPayout} for ${jobLabel}${customerName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #16a34a; margin-bottom: 4px;">Payment Confirmed</h2>
          <p style="color: #666; margin-top: 0;">Hey ${subName}, great work!</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="color: #666; margin: 0 0 4px 0; font-size: 14px;">${jobLabel}${customerName}</p>
            <p style="color: #16a34a; font-size: 32px; font-weight: 700; margin: 0;">${formattedPayout}</p>
          </div>
          <a href="${dashboardUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">View Your Dashboard</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">Keep up the great work. More jobs available on your dashboard.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send paid email:', err)
  }
}

function formatTime(time: string | null): string {
  if (!time) return ''
  const parts = time.split(':').map(Number)
  const h = parts[0]
  const m = parts[1]
  if (isNaN(h) || isNaN(m)) return ''
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  const mStr = m.toString().padStart(2, '0')
  return `${h12}:${mStr} ${ampm}`
}

function formatDateTimeForEmail(date: string | null, time: string | null): string {
  if (!date) return 'TBD'
  const dateStr = formatDate(date)
  const timeStr = formatTime(time)
  return timeStr ? `${dateStr} at ${timeStr}` : dateStr
}

/** Email: Admin rescheduled a project — notify the assigned subcontractor */
export async function sendScheduleChangedEmail(params: {
  to: string
  subName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
  previousStartDate: string | null
  previousStartTime: string | null
  newStartDate: string | null
  newStartTime: string | null
  projectUrl: string
}) {
  const {
    to,
    subName,
    tenantName,
    notificationEmail,
    jobNumber,
    customerName,
    previousStartDate,
    previousStartTime,
    newStartDate,
    newStartTime,
    projectUrl,
  } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''
  const oldWhen = formatDateTimeForEmail(previousStartDate, previousStartTime)
  const newWhen = formatDateTimeForEmail(newStartDate, newStartTime)

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `Schedule change: ${jobLabel}${customerName} moved to ${newWhen}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="color: #92400e; margin: 0; font-weight: 600;">⚠️ Schedule Changed</p>
          </div>
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">Your job has been rescheduled</h2>
          <p style="color: #666; margin-top: 0;">Hi ${subName}, <strong>${tenantName}</strong> has changed the start date/time for <strong>${jobLabel}${customerName}</strong>. Please update your calendar.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px 12px; background: #f9fafb; color: #6b7280; width: 140px; border-radius: 6px 0 0 6px;">Previous</td>
              <td style="padding: 10px 12px; background: #f9fafb; color: #374151; text-decoration: line-through; border-radius: 0 6px 6px 0;">${oldWhen}</td>
            </tr>
            <tr><td style="height: 6px;"></td></tr>
            <tr>
              <td style="padding: 10px 12px; background: #ecfdf5; color: #047857; font-weight: 600; width: 140px; border-radius: 6px 0 0 6px;">New</td>
              <td style="padding: 10px 12px; background: #ecfdf5; color: #064e3b; font-weight: 700; border-radius: 0 6px 6px 0;">${newWhen}</td>
            </tr>
          </table>
          <a href="${projectUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Project</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">If this new schedule doesn't work for you, please contact ${tenantName} as soon as possible.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send schedule changed email:', err)
  }
}

/** Email: Admin added a change order — notify the assigned subcontractor */
export async function sendChangeOrderEmail(params: {
  to: string
  subName: string
  tenantName: string
  notificationEmail: string | null
  jobNumber: string | null
  customerName: string
  amount: number
  description: string
  previousPayout: number
  newPayout: number
  projectUrl: string
}) {
  const {
    to,
    subName,
    tenantName,
    notificationEmail,
    jobNumber,
    customerName,
    amount,
    description,
    previousPayout,
    newPayout,
    projectUrl,
  } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''
  const isIncrease = amount >= 0
  const signed = `${isIncrease ? '+' : '−'}${formatCurrency(Math.abs(amount))}`
  const accent = isIncrease ? '#16a34a' : '#d97706'

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `Scope & pay update: ${jobLabel}${customerName} (${signed})`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="color: #1e40af; margin: 0; font-weight: 600;">📝 Change Order</p>
          </div>
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">The scope &amp; pay on your job changed</h2>
          <p style="color: #666; margin-top: 0;">Hi ${subName}, <strong>${tenantName}</strong> added a change order to <strong>${jobLabel}${customerName}</strong>.</p>
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #374151; margin: 0; white-space: pre-wrap;">${description}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #666; width: 160px;">Adjustment</td><td style="padding: 8px 0; font-weight: 700; color: ${accent};">${signed}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Previous payout</td><td style="padding: 8px 0; color: #374151;">${formatCurrency(previousPayout)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">New total payout</td><td style="padding: 8px 0; font-weight: 700; color: #16a34a;">${formatCurrency(newPayout)}</td></tr>
          </table>
          <a href="${projectUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Project</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">If anything about this change looks off, contact ${tenantName} before continuing the work.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send change order email:', err)
  }
}

/** Email 9: Sub updated project status (in_progress / completed) — notify admin with link */
export async function sendStatusUpdateEmail(params: StatusUpdateEmailParams) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName, newStatus, projectUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''
  const statusLabel = newStatus === 'in_progress' ? 'In Progress' : 'Completed'
  const color = newStatus === 'in_progress' ? '#2563eb' : '#16a34a'

  try {
    await getResend().emails.send({
      from: getFrom(tenantName, notificationEmail),
      replyTo: notificationEmail || undefined,
      to,
      subject: `${subName} marked ${jobLabel}${customerName} as ${statusLabel}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: ${color}; margin-bottom: 4px;">Project ${statusLabel}</h2>
          <p style="color: #666; margin-top: 0;"><strong>${subName}</strong> has marked <strong>${jobLabel}${customerName}</strong> as <strong>${statusLabel}</strong>.</p>
          <a href="${projectUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">View Project</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">Log in to your Kolrabee admin dashboard for details.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send status update email:', err)
  }
}
