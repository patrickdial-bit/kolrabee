'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSub } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessageNotificationEmail } from '@/lib/email'
import { getNotificationPrefs, hasGrowthFeatures } from '@/lib/types'

export async function sendSubMessage(projectId: string, body: string, slug: string) {
  if (!body.trim()) {
    return { error: 'Message cannot be empty.' }
  }

  const { appUser, tenant } = await getCurrentSub(slug)

  if (!hasGrowthFeatures(tenant)) {
    return { error: 'In-app messaging requires the Growth plan or higher.' }
  }
  const adminClient = createAdminClient()

  // Verify this sub accepted the project
  const { data: project } = await adminClient
    .from('projects')
    .select('accepted_by, job_number, customer_name')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', appUser.id)
    .single()

  if (!project) {
    return { error: 'You can only message on projects you have accepted.' }
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

  // Notify admin(s) via email
  const { data: admins } = await adminClient
    .from('users')
    .select('email, notification_preferences')
    .eq('tenant_id', tenant.id)
    .eq('role', 'admin')
    .eq('status', 'active')

  const senderName = `${appUser.first_name} ${appUser.last_name}`
  for (const admin of admins ?? []) {
    const prefs = getNotificationPrefs(admin)
    if (!prefs.new_message) continue
    sendMessageNotificationEmail({
      to: admin.email,
      senderName,
      tenantName: tenant.name,
      notificationEmail: tenant.notification_email,
      jobNumber: project.job_number,
      customerName: project.customer_name,
      messagePreview: body.trim().slice(0, 200),
      loginUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin/projects/${projectId}`,
    })
  }

  revalidatePath(`/${slug}/projects/${projectId}`)
  return { success: true }
}

export async function getSubMessages(projectId: string, slug: string) {
  try {
    const { tenant } = await getCurrentSub(slug)
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

export async function getSubAttachmentUrl(attachmentId: string, slug: string) {
  const { tenant } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  const { data: att } = await adminClient
    .from('project_attachments')
    .select('file_url')
    .eq('id', attachmentId)
    .single()

  if (!att) {
    return { error: 'Attachment not found.' }
  }

  const { data, error } = await adminClient.storage
    .from('documents')
    .createSignedUrl(att.file_url, 300)

  if (error || !data?.signedUrl) {
    return { error: 'Failed to generate download URL.' }
  }

  return { url: data.signedUrl }
}
