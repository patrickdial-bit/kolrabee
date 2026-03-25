'use server'

import { redirect } from 'next/navigation'
import { getCurrentSub } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAcceptEmail, sendCancelEmail, sendDeclineEmail, sendStatusUpdateEmail, sendCompletionRequestEmail } from '@/lib/email'
import { getNotificationPrefs, hasGrowthFeatures } from '@/lib/types'

export async function acceptProject(projectId: string, expectedVersion: number, slug: string) {
  const { appUser, tenant } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  // Race-condition-safe update: only update if status is still 'available' and version matches
  const { data, error } = await adminClient
    .from('projects')
    .update({
      status: 'accepted',
      accepted_by: appUser.id,
      accepted_at: new Date().toISOString(),
      version: expectedVersion + 1,
    })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('status', 'available')
    .eq('version', expectedVersion)
    .select('id')

  if (error) {
    return { error: 'Failed to accept project. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { error: 'This project was just accepted by another subcontractor.' }
  }

  // Update this contractor's invitation to 'accepted'
  await adminClient
    .from('project_invitations')
    .update({ status: 'accepted' })
    .eq('project_id', projectId)
    .eq('subcontractor_id', appUser.id)

  // Withdraw all other invitations for this project so it disappears from other boards
  await adminClient
    .from('project_invitations')
    .update({ status: 'declined' })
    .eq('project_id', projectId)
    .eq('status', 'invited')

  // Notify admin via email (fire-and-forget)
  const { data: project } = await adminClient
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (project) {
    // Find tenant admin(s) to notify
    const { data: admins } = await adminClient
      .from('users')
      .select('email')
      .eq('tenant_id', tenant.id)
      .eq('role', 'admin')
      .eq('status', 'active')

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`
    const projectUrl = `${siteUrl}/admin/projects/${projectId}`
    const subName = `${appUser.first_name} ${appUser.last_name}`
    for (const admin of admins ?? []) {
      sendAcceptEmail({
        to: admin.email,
        subName,
        tenantName: tenant.name,
        notificationEmail: tenant.notification_email,
        jobNumber: project.job_number,
        customerName: project.customer_name,
        address: project.address,
        startDate: project.start_date,
        payout: project.payout_amount,
        projectUrl,
      })
    }
  }

  redirect(`/${slug}/dashboard`)
}

export async function cancelAcceptedProject(projectId: string, expectedVersion: number, slug: string) {
  const { appUser, tenant } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  // Only cancel if this sub accepted it and version matches
  const { data, error } = await adminClient
    .from('projects')
    .update({
      status: 'available',
      accepted_by: null,
      accepted_at: null,
      version: expectedVersion + 1,
    })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', appUser.id)
    .eq('version', expectedVersion)
    .select('id')

  if (error) {
    return { error: 'Failed to cancel acceptance. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { error: 'This project has already been updated. Please refresh and try again.' }
  }

  // Restore this contractor's invitation to 'invited'
  await adminClient
    .from('project_invitations')
    .update({ status: 'invited' })
    .eq('project_id', projectId)
    .eq('subcontractor_id', appUser.id)

  // Restore other contractors' invitations so the project reappears on their boards
  await adminClient
    .from('project_invitations')
    .update({ status: 'invited' })
    .eq('project_id', projectId)
    .eq('status', 'declined')

  // Notify admin via email (fire-and-forget)
  const { data: cancelledProject } = await adminClient
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (cancelledProject) {
    const { data: admins } = await adminClient
      .from('users')
      .select('email, notification_preferences')
      .eq('tenant_id', tenant.id)
      .eq('role', 'admin')
      .eq('status', 'active')

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`
    const projectUrl = `${siteUrl}/admin/projects/${projectId}`
    const subName = `${appUser.first_name} ${appUser.last_name}`
    for (const admin of admins ?? []) {
      const prefs = getNotificationPrefs(admin)
      if (!prefs.project_cancelled) continue
      sendCancelEmail({
        to: admin.email,
        subName,
        tenantName: tenant.name,
        notificationEmail: tenant.notification_email,
        jobNumber: cancelledProject.job_number,
        customerName: cancelledProject.customer_name,
        projectUrl,
      })
    }
  }

  redirect(`/${slug}/dashboard`)
}

export async function markInProgress(projectId: string, expectedVersion: number, slug: string) {
  const { appUser, tenant } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('projects')
    .update({
      status: 'in_progress',
      version: expectedVersion + 1,
    })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', appUser.id)
    .eq('status', 'accepted')
    .eq('version', expectedVersion)
    .select('id, job_number, customer_name')

  if (error) {
    return { error: 'Failed to update project status. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { error: 'This project has already been updated. Please refresh.' }
  }

  // Notify admin(s)
  const project = data[0]
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`
  const projectUrl = `${siteUrl}/admin/projects/${projectId}`
  const { data: admins } = await adminClient
    .from('users')
    .select('email, notification_preferences')
    .eq('tenant_id', tenant.id)
    .eq('role', 'admin')
    .eq('status', 'active')

  const subName = `${appUser.first_name} ${appUser.last_name}`
  for (const admin of admins ?? []) {
    const prefs = getNotificationPrefs(admin)
    if (!prefs.project_updates) continue
    sendStatusUpdateEmail({
      to: admin.email,
      subName,
      tenantName: tenant.name,
      notificationEmail: tenant.notification_email,
      jobNumber: project.job_number,
      customerName: project.customer_name,
      newStatus: 'in_progress',
      projectUrl,
    })
  }

  return { success: true }
}

export async function requestCompletion(projectId: string, expectedVersion: number, slug: string) {
  const { appUser, tenant } = await getCurrentSub(slug)

  if (!hasGrowthFeatures(tenant)) {
    return { error: 'Completion approval requires the Growth plan or higher.' }
  }

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('projects')
    .update({
      status: 'pending_completion',
      completion_requested_by: appUser.id,
      completion_requested_at: new Date().toISOString(),
      version: expectedVersion + 1,
    })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', appUser.id)
    .in('status', ['accepted', 'in_progress'])
    .eq('version', expectedVersion)
    .select('*, job_number, customer_name')

  if (error) {
    return { error: 'Failed to request completion. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { error: 'This project has already been updated. Please refresh and try again.' }
  }

  const project = data[0]

  // Notify admin(s) via email
  const { data: admins } = await adminClient
    .from('users')
    .select('email, notification_preferences')
    .eq('tenant_id', tenant.id)
    .eq('role', 'admin')
    .eq('status', 'active')

  const subName = `${appUser.first_name} ${appUser.last_name}`
  for (const admin of admins ?? []) {
    const prefs = getNotificationPrefs(admin)
    if (!prefs.project_completion_requested) continue
    sendCompletionRequestEmail({
      to: admin.email,
      subName,
      tenantName: tenant.name,
      notificationEmail: tenant.notification_email,
      jobNumber: project.job_number,
      customerName: project.customer_name,
    })
  }

  redirect(`/${slug}/dashboard`)
}

export async function markCompleted(projectId: string, expectedVersion: number, slug: string) {
  const { appUser, tenant } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('projects')
    .update({
      status: 'completed',
      version: expectedVersion + 1,
    })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', appUser.id)
    .in('status', ['accepted', 'in_progress'])
    .eq('version', expectedVersion)
    .select('id, job_number, customer_name')

  if (error) {
    return { error: 'Failed to update project status. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { error: 'This project has already been updated. Please refresh.' }
  }

  // Notify admin(s)
  const project = data[0]
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`
  const projectUrl = `${siteUrl}/admin/projects/${projectId}`
  const { data: admins } = await adminClient
    .from('users')
    .select('email, notification_preferences')
    .eq('tenant_id', tenant.id)
    .eq('role', 'admin')
    .eq('status', 'active')

  const subName = `${appUser.first_name} ${appUser.last_name}`
  for (const admin of admins ?? []) {
    const prefs = getNotificationPrefs(admin)
    if (!prefs.project_updates) continue
    sendStatusUpdateEmail({
      to: admin.email,
      subName,
      tenantName: tenant.name,
      notificationEmail: tenant.notification_email,
      jobNumber: project.job_number,
      customerName: project.customer_name,
      newStatus: 'completed',
      projectUrl,
    })
  }

  return { success: true }
}

export async function declineProject(projectId: string, slug: string) {
  const { appUser, tenant } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('project_invitations')
    .update({ status: 'declined' })
    .eq('project_id', projectId)
    .eq('subcontractor_id', appUser.id)
    .eq('tenant_id', tenant.id)

  if (error) {
    return { error: 'Failed to decline project. Please try again.' }
  }

  // Notify admin so they can reassign
  const { data: project } = await adminClient
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  if (project) {
    const { data: admins } = await adminClient
      .from('users')
      .select('email, notification_preferences')
      .eq('tenant_id', tenant.id)
      .eq('role', 'admin')
      .eq('status', 'active')

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`
    const projectUrl = `${siteUrl}/admin/projects/${projectId}`
    const subName = `${appUser.first_name} ${appUser.last_name}`
    for (const admin of admins ?? []) {
      const prefs = getNotificationPrefs(admin)
      if (!prefs.project_cancelled) continue
      sendDeclineEmail({
        to: admin.email,
        subName,
        tenantName: tenant.name,
        notificationEmail: tenant.notification_email,
        jobNumber: project.job_number,
        customerName: project.customer_name,
        projectUrl,
      })
    }
  }

  redirect(`/${slug}/dashboard`)
}
