'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser, normalizeUrl } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPaidEmail, sendCompletionApprovedEmail, sendScheduleChangedEmail } from '@/lib/email'
import { getNotificationPrefs, hasGrowthFeatures } from '@/lib/types'
import { sumDurationMinutes } from '@/lib/time-tracking'
import { geocodeAndStoreProject } from '@/lib/geocode'
import { readAddressFromForm } from '@/lib/address'
import { canonicalSiteUrl } from '@/lib/site-url'

async function notifyAssignedSubOfReschedule(args: {
  projectId: string
  tenantId: string
  tenantSlug: string
  tenantName: string
  tenantNotificationEmail: string | null
  acceptedById: string
  jobNumber: string | null
  customerName: string
  previousStartDate: string | null
  previousStartTime: string | null
  newStartDate: string | null
  newStartTime: string | null
}) {
  const adminClient = createAdminClient()
  const { data: sub } = await adminClient
    .from('users')
    .select('email, first_name, notification_preferences')
    .eq('id', args.acceptedById)
    .single()

  if (!sub) return
  const prefs = getNotificationPrefs(sub)
  if (!prefs.project_rescheduled) return

  sendScheduleChangedEmail({
    to: sub.email,
    subName: sub.first_name,
    tenantName: args.tenantName,
    notificationEmail: args.tenantNotificationEmail,
    jobNumber: args.jobNumber,
    customerName: args.customerName,
    previousStartDate: args.previousStartDate,
    previousStartTime: args.previousStartTime,
    newStartDate: args.newStartDate,
    newStartTime: args.newStartTime,
    projectUrl: `${canonicalSiteUrl()}/${args.tenantSlug}/projects/${args.projectId}`,
  })
}

export async function updateProject(projectId: string, formData: FormData) {
  const customerName = formData.get('customer_name') as string
  const jobNumber = formData.get('job_number') as string
  const startDate = formData.get('start_date') as string
  const startTime = formData.get('start_time') as string
  const payoutAmountRaw = formData.get('payout_amount') as string | null
  const hourlyRateRaw = formData.get('hourly_rate') as string | null
  const estimatedLaborHoursRaw = formData.get('estimated_labor_hours') as string
  const workOrderLink = formData.get('work_order_link') as string
  const companycamLink = formData.get('companycam_link') as string
  const notes = formData.get('notes') as string
  const adminNotes = formData.get('admin_notes') as string

  if (!customerName?.trim()) {
    return { error: 'Customer name is required.' }
  }

  const addressResult = readAddressFromForm(formData)
  if ('error' in addressResult) {
    return { error: addressResult.error }
  }
  const address = addressResult.address

  // The edit form posts payout_amount for standard jobs and hourly_rate for
  // door-to-door jobs — only validate/update the field that was submitted.
  let payoutAmount: number | null = null
  if (payoutAmountRaw !== null) {
    payoutAmount = parseFloat(payoutAmountRaw)
    if (isNaN(payoutAmount) || payoutAmount < 0) {
      return { error: 'A valid payout amount is required.' }
    }
  }

  let hourlyRate: number | null = null
  if (hourlyRateRaw !== null) {
    hourlyRate = parseFloat(hourlyRateRaw)
    if (isNaN(hourlyRate) || hourlyRate <= 0) {
      return { error: 'A valid hourly rate is required for door-to-door jobs.' }
    }
  }

  // Customer-side revenue (marketing ROI). undefined = field not on the form;
  // empty string clears it.
  const revenueAmountRaw = formData.get('revenue_amount') as string | null
  let revenueAmount: number | null | undefined = undefined
  if (revenueAmountRaw !== null) {
    if (revenueAmountRaw === '') {
      revenueAmount = null
    } else {
      revenueAmount = parseFloat(revenueAmountRaw)
      if (isNaN(revenueAmount) || revenueAmount < 0) {
        return { error: 'Customer revenue must be a positive number.' }
      }
    }
  }

  const estimatedLaborHours = estimatedLaborHoursRaw ? parseFloat(estimatedLaborHoursRaw) : null
  if (estimatedLaborHours !== null && (isNaN(estimatedLaborHours) || estimatedLaborHours < 0)) {
    return { error: 'Estimated labor hours must be a positive number.' }
  }

  const { appUser, tenant } = await getCurrentUser()

  const trimmedJobNumber = jobNumber?.trim() || null

  const adminClient = createAdminClient()

  const { data: existing } = await adminClient
    .from('projects')
    .select('start_date, start_time, accepted_by, job_number, customer_name, address')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  const addressChanged = !existing || (existing.address ?? '').trim() !== address.trim()

  const newStartDate = startDate || null
  const newStartTime = startTime || null
  const scheduleChanged = !!existing
    && (existing.start_date !== newStartDate || (existing.start_time ?? null) !== newStartTime)
  const subAssigned = !!existing?.accepted_by

  const update: Record<string, unknown> = {
    job_number: trimmedJobNumber,
    customer_name: customerName.trim(),
    address: address.trim(),
    start_date: newStartDate,
    start_time: newStartTime,
    estimated_labor_hours: estimatedLaborHours,
    work_order_link: normalizeUrl(workOrderLink),
    companycam_link: normalizeUrl(companycamLink),
    notes: notes?.trim() || null,
    admin_notes: adminNotes?.trim() || null,
  }
  if (payoutAmount !== null) update.payout_amount = payoutAmount
  if (hourlyRate !== null) update.hourly_rate = hourlyRate
  if (revenueAmount !== undefined) update.revenue_amount = revenueAmount

  if (scheduleChanged && subAssigned) {
    update.schedule_changed_at = new Date().toISOString()
    update.previous_start_date = existing!.start_date
    update.previous_start_time = existing!.start_time
    update.schedule_change_acknowledged_at = null
  }

  const { error } = await adminClient
    .from('projects')
    .update(update)
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)

  if (error) {
    if (error.code === '23505' && trimmedJobNumber) {
      return { error: `A project with job number "${trimmedJobNumber}" already exists. Pick a different number or cancel the existing project first.` }
    }
    return { error: 'Failed to update project.' }
  }

  // Re-geocode when the address changes so the map stays accurate. Best-effort.
  if (addressChanged) {
    await geocodeAndStoreProject(projectId, address.trim(), tenant.service_area)
  }

  if (scheduleChanged && subAssigned && existing) {
    await notifyAssignedSubOfReschedule({
      projectId,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      tenantNotificationEmail: tenant.notification_email,
      acceptedById: existing.accepted_by!,
      jobNumber: trimmedJobNumber,
      customerName: customerName.trim(),
      previousStartDate: existing.start_date,
      previousStartTime: existing.start_time,
      newStartDate,
      newStartTime,
    })
  }

  revalidatePath(`/admin/projects/${projectId}`)
  return { success: true, scheduleChanged: scheduleChanged && subAssigned }
}

export async function rescheduleProject(projectId: string, formData: FormData) {
  const newStartDateRaw = formData.get('start_date') as string
  const newStartTimeRaw = formData.get('start_time') as string
  const newStartDate = newStartDateRaw || null
  const newStartTime = newStartTimeRaw || null

  if (!newStartDate) {
    return { error: 'A start date is required.' }
  }

  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: existing, error: fetchErr } = await adminClient
    .from('projects')
    .select('start_date, start_time, accepted_by, status, job_number, customer_name')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  if (fetchErr || !existing) {
    return { error: 'Project not found.' }
  }

  if (['paid', 'cancelled'].includes(existing.status)) {
    return { error: 'Cannot reschedule a paid or cancelled project.' }
  }

  const scheduleChanged = existing.start_date !== newStartDate
    || (existing.start_time ?? null) !== newStartTime

  if (!scheduleChanged) {
    return { error: 'The date and time are unchanged.' }
  }

  const subAssigned = !!existing.accepted_by

  const update: Record<string, unknown> = {
    start_date: newStartDate,
    start_time: newStartTime,
  }

  if (subAssigned) {
    update.schedule_changed_at = new Date().toISOString()
    update.previous_start_date = existing.start_date
    update.previous_start_time = existing.start_time
    update.schedule_change_acknowledged_at = null
  }

  const { error } = await adminClient
    .from('projects')
    .update(update)
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)

  if (error) {
    return { error: 'Failed to update schedule.' }
  }

  if (subAssigned) {
    await notifyAssignedSubOfReschedule({
      projectId,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      tenantNotificationEmail: tenant.notification_email,
      acceptedById: existing.accepted_by!,
      jobNumber: existing.job_number,
      customerName: existing.customer_name,
      previousStartDate: existing.start_date,
      previousStartTime: existing.start_time,
      newStartDate,
      newStartTime,
    })
  }

  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/admin/dashboard')
  return { success: true, subNotified: subAssigned }
}

export async function markCompleted(projectId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('projects')
    .update({ status: 'completed' })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .in('status', ['accepted', 'in_progress'])

  if (error) {
    return { error: 'Failed to mark project as completed.' }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  return { success: true }
}

export async function approveCompletion(projectId: string) {
  const { tenant } = await getCurrentUser()

  if (!hasGrowthFeatures(tenant)) {
    return { error: 'Completion approval requires the Growth plan or higher. Please upgrade.' }
  }

  const adminClient = createAdminClient()

  // Get project before update to access sub info
  const { data: proj } = await adminClient
    .from('projects')
    .select('*, accepted_by')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('status', 'pending_completion')
    .single()

  if (!proj) {
    return { error: 'Project not found or not pending completion.' }
  }

  const { error } = await adminClient
    .from('projects')
    .update({ status: 'completed' })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('status', 'pending_completion')

  if (error) {
    return { error: 'Failed to approve completion.' }
  }

  // Notify the sub
  if (proj.accepted_by) {
    const { data: sub } = await adminClient
      .from('users')
      .select('email, first_name, last_name, notification_preferences')
      .eq('id', proj.accepted_by)
      .single()

    if (sub) {
      const prefs = getNotificationPrefs(sub)
      if (prefs.project_completion_approved) {
        const siteUrl = canonicalSiteUrl()
        sendCompletionApprovedEmail({
          to: sub.email,
          subName: sub.first_name,
          tenantName: tenant.name,
          notificationEmail: tenant.notification_email,
          jobNumber: proj.job_number,
          customerName: proj.customer_name,
          payout: proj.payout_amount,
          loginUrl: `${siteUrl}/${tenant.slug}/login`,
        })
      }
    }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function markPaid(projectId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const update: Record<string, unknown> = {
    status: 'paid',
    paid_at: new Date().toISOString(),
  }

  // Door-to-door jobs pay hourly: freeze payout_amount at clocked hours ×
  // hourly_rate so the paid email and all earnings roll-ups reflect real pay.
  const { data: payInfo } = await adminClient
    .from('projects')
    .select('project_type, hourly_rate')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  if (payInfo?.project_type === 'door_to_door' && payInfo.hourly_rate != null) {
    const { data: entries } = await adminClient
      .from('time_entries')
      .select('clock_in, clock_out, duration_minutes')
      .eq('project_id', projectId)
      .eq('tenant_id', tenant.id)
    const totalMinutes = sumDurationMinutes(entries ?? [])
    update.payout_amount = Math.round((totalMinutes / 60) * Number(payInfo.hourly_rate) * 100) / 100
  }

  const { data: rows, error } = await adminClient
    .from('projects')
    .update(update)
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .in('status', ['accepted', 'in_progress', 'pending_completion', 'completed'])
    .select('id, job_number, customer_name, payout_amount, accepted_by')

  if (error) {
    return { error: 'Failed to mark project as paid.' }
  }

  if (!rows || rows.length === 0) {
    return { error: 'Project not found or already paid.' }
  }

  const project = rows[0]

  // Notify the sub they got paid (fire-and-forget)
  if (project?.accepted_by) {
    const { data: sub } = await adminClient
      .from('users')
      .select('email, first_name, notification_preferences')
      .eq('id', project.accepted_by)
      .single()

    if (sub) {
      const prefs = getNotificationPrefs(sub)
      if (prefs.project_updates) {
        const siteUrl = canonicalSiteUrl()
        sendPaidEmail({
          to: sub.email,
          subName: sub.first_name,
          tenantName: tenant.name,
          notificationEmail: tenant.notification_email,
          jobNumber: project.job_number,
          customerName: project.customer_name,
          payout: project.payout_amount,
          dashboardUrl: `${siteUrl}/${tenant.slug}/dashboard`,
        })
      }
    }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function cancelProject(projectId: string, version: number) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('projects')
    .update({
      status: 'cancelled',
      accepted_by: null,
      accepted_at: null,
      version: version + 1,
    })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('version', version)
    .in('status', ['available', 'accepted', 'in_progress', 'pending_completion', 'completed'])
    .select('id')

  if (error) {
    return { error: 'Failed to cancel project.' }
  }

  if (!data || data.length === 0) {
    return { error: 'Conflict: this project was modified by someone else. Please refresh.' }
  }

  // Withdraw outstanding invitations so the project disappears from every sub's board
  await adminClient
    .from('project_invitations')
    .update({ status: 'declined' })
    .eq('project_id', projectId)
    .eq('tenant_id', tenant.id)
    .in('status', ['invited', 'accepted'])

  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function deleteProject(projectId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .in('status', ['available', 'cancelled'])
    .select('id')

  if (error) {
    return { error: 'Failed to delete project.' }
  }

  if (!data || data.length === 0) {
    return { error: 'Only available or cancelled projects can be deleted.' }
  }

  revalidatePath('/admin/dashboard')
  redirect('/admin/dashboard')
}
