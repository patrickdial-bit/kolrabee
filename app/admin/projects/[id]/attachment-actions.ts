'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function addAttachment(
  projectId: string,
  fileName: string,
  fileUrl: string,
  fileSize: number,
  fileType: string
) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  // Check max 3 attachments
  const { count } = await adminClient
    .from('project_attachments')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  if (count !== null && count >= 3) {
    return { error: 'Maximum 3 attachments per project.' }
  }

  const { error } = await adminClient
    .from('project_attachments')
    .insert({
      tenant_id: tenant.id,
      project_id: projectId,
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize,
      file_type: fileType,
      uploaded_by: appUser.id,
    })

  if (error) {
    return { error: 'Failed to save attachment.' }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  return { success: true }
}

export async function removeAttachment(attachmentId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  // Get attachment to find file path for storage cleanup
  const { data: att } = await adminClient
    .from('project_attachments')
    .select('project_id, file_url')
    .eq('id', attachmentId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!att) {
    return { error: 'Attachment not found.' }
  }

  // Delete from storage (best effort)
  await adminClient.storage.from('documents').remove([att.file_url])

  // Delete from database
  const { error } = await adminClient
    .from('project_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('tenant_id', tenant.id)

  if (error) {
    return { error: 'Failed to remove attachment.' }
  }

  revalidatePath(`/admin/projects/${att.project_id}`)
  return { success: true }
}

export async function getAttachmentUrl(attachmentId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: att } = await adminClient
    .from('project_attachments')
    .select('file_url')
    .eq('id', attachmentId)
    .eq('tenant_id', tenant.id)
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
