'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessageNotificationEmail } from '@/lib/email'
import { getNotificationPrefs, hasGrowthFeatures } from '@/lib/types'

export async function sendMessage(projectId: string, body: string) {
  if (!body.trim()) {
    return { error: 'Message cannot be empty.' }
  }

  const { appUser, tenant } = await getCurrentUser()

  if (!hasGrowthFeatures(tenant)) {
    return { error: 'In-app messaging requires the Growth plan or higher. Please upgrade.' }
  }
  const adminClient = createAdminClient()

  // Verify project exists and has an accepted sub
  const { data: project } = await adminClient
    .from('projects')
    .select('accepted_by, job_number, customer_name')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!project || !project.accepted_by) {
    return { error: 'Project not found or no subcontractor assigned.' }
  }

  const { error } = await adminClient
    .from('job_messages')
    .insert({
      tenant_id: tenant.id,
      project_id: projectId,
      sender_id: appUser.id,
      body: body.trim(),
    })

  if (error) {
    return { error: 'Failed to send message.' }
  }

  // Notify the sub via email
  const { data: sub } = await adminClient
    .from('users')
    .select('email, first_name, last_name, notification_preferences')
    .eq('id', project.accepted_by)
    .single()

  if (sub) {
    const prefs = getNotificationPrefs(sub)
    if (prefs.new_message) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      sendMessageNotificationEmail({
        to: sub.email,
        senderName: `${appUser.first_name} ${appUser.last_name}`,
        tenantName: tenant.name,
        notificationEmail: tenant.notification_email,
        jobNumber: project.job_number,
        customerName: project.customer_name,
        messagePreview: body.trim().slice(0, 200),
        loginUrl: `${siteUrl}/${tenant.slug}/login`,
      })
    }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  return { success: true }
}

export async function getMessages(projectId: string) {
  try {
    const { tenant } = await getCurrentUser()
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('job_messages')
      .select('*, sender:users!job_messages_sender_id_fkey(first_name, last_name)')
      .eq('project_id', projectId)
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true })

    if (error) {
      return { messages: [] }
    }

    return {
      messages: (data ?? []).map((m: any) => ({
        id: m.id,
        tenant_id: m.tenant_id,
        project_id: m.project_id,
        sender_id: m.sender_id,
        body: m.body,
        created_at: m.created_at,
        sender_name: m.sender ? `${m.sender.first_name} ${m.sender.last_name}` : 'Unknown',
      })),
    }
  } catch {
    return { messages: [] }
  }
}
