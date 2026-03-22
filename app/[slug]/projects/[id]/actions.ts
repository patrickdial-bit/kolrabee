'use server'

import { redirect } from 'next/navigation'
import { getCurrentSub } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAcceptEmail, sendCancelEmail } from '@/lib/email'

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

  // Update invitation status to 'accepted'
  await adminClient
    .from('project_invitations')
    .update({ status: 'accepted' })
    .eq('project_id', projectId)
    .eq('subcontractor_id', appUser.id)

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

  // Update invitation status back to 'invited'
  await adminClient
    .from('project_invitations')
    .update({ status: 'invited' })
    .eq('project_id', projectId)
    .eq('subcontractor_id', appUser.id)

  // Notify admin via email (fire-and-forget)
  const { data: cancelledProject } = await adminClient
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (cancelledProject) {
    const { data: admins } = await adminClient
      .from('users')
      .select('email')
      .eq('tenant_id', tenant.id)
      .eq('role', 'admin')
      .eq('status', 'active')

    const subName = `${appUser.first_name} ${appUser.last_name}`
    for (const admin of admins ?? []) {
      sendCancelEmail({
        to: admin.email,
        subName,
        tenantName: tenant.name,
        notificationEmail: tenant.notification_email,
        jobNumber: cancelledProject.job_number,
        customerName: cancelledProject.customer_name,
      })
    }
  }

  redirect(`/${slug}/dashboard`)
}

export async function declineProject(projectId: string, slug: string) {
  const { appUser } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('project_invitations')
    .update({ status: 'declined' })
    .eq('project_id', projectId)
    .eq('subcontractor_id', appUser.id)

  if (error) {
    return { error: 'Failed to decline project. Please try again.' }
  }

  redirect(`/${slug}/dashboard`)
}
