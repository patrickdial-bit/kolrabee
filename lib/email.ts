import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const DEFAULT_FROM = 'Kolrabee <notifications@contact.kolrabee.com>'

function getFrom(tenantName: string, notificationEmail: string | null) {
  if (notificationEmail) {
    return `${tenantName} via Kolrabee <notifications@contact.kolrabee.com>`
  }
  return DEFAULT_FROM
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
    await resend.emails.send({
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

/** Email 1: Sub invited to a project */
export async function sendInviteEmail(params: InviteEmailParams) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName, city, startDate, payout, projectUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''

  try {
    await resend.emails.send({
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
    await resend.emails.send({
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
    await resend.emails.send({
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

/** Email 4: Sub cancelled an accepted project — notify admin */
export async function sendCancelEmail(params: CancelEmailParams) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName, projectUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''

  try {
    await resend.emails.send({
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

/** Email 5: Notify sub they got paid — the money email */
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
    await resend.emails.send({
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

/** Email 6: Sub updated project status (in_progress / completed) — notify admin with link */
export async function sendStatusUpdateEmail(params: StatusUpdateEmailParams) {
  const { to, subName, tenantName, notificationEmail, jobNumber, customerName, newStatus, projectUrl } = params
  const jobLabel = jobNumber ? `Job #${jobNumber} — ` : ''
  const statusLabel = newStatus === 'in_progress' ? 'In Progress' : 'Completed'
  const color = newStatus === 'in_progress' ? '#2563eb' : '#16a34a'

  try {
    await resend.emails.send({
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
