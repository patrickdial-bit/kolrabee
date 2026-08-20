'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AttachmentRole } from '@/lib/bid-board/types'

// SOP filename convention: "JobName - InternalTakeoff.png" / "JobName - ProposalTakeoff.png"
export async function detectAttachmentRole(fileName: string): Promise<{ role: AttachmentRole; visibleToSubs: boolean }> {
  const flat = fileName.toLowerCase().replace(/[\s_-]/g, '')
  if (flat.includes('internaltakeoff')) return { role: 'takeoff_internal', visibleToSubs: true }
  // Proposal takeoff is a sales asset — tells a bidder nothing. Hidden by default.
  if (flat.includes('proposaltakeoff')) return { role: 'takeoff_proposal', visibleToSubs: false }
  return { role: 'site_photo', visibleToSubs: true }
}

async function logEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  tenantId: string,
  bidRequestId: string,
  actorId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  await adminClient.from('bid_events').insert({
    tenant_id: tenantId,
    bid_request_id: bidRequestId,
    actor_type: 'admin',
    actor_id: actorId,
    event_type: eventType,
    payload,
  })
}

export async function recordAttachment(
  bidRequestId: string,
  file: { fileName: string; storagePath: string; mimeType: string; sizeBytes: number }
) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: request } = await adminClient
    .from('bid_requests')
    .select('id')
    .eq('id', bidRequestId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!request) return { error: 'Bid request not found.' }

  const { role, visibleToSubs } = await detectAttachmentRole(file.fileName)

  const { error } = await adminClient.from('bid_attachments').insert({
    bid_request_id: bidRequestId,
    tenant_id: tenant.id,
    kind: 'upload',
    attachment_role: role,
    storage_path: file.storagePath,
    label: file.fileName,
    mime_type: file.mimeType,
    size_bytes: file.sizeBytes,
    visible_to_subs: visibleToSubs,
    created_by: appUser.id,
  })
  if (error) return { error: 'Failed to save attachment.' }

  await logEvent(adminClient, tenant.id, bidRequestId, appUser.id, 'attachment_uploaded', {
    file_name: file.fileName,
    detected_role: role,
  })

  revalidatePath(`/admin/bids/${bidRequestId}`)
  return { success: true }
}

export async function addExternalLink(bidRequestId: string, url: string, label: string) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return { error: 'Enter a full URL (https://…).' }
  }

  const { data: request } = await adminClient
    .from('bid_requests')
    .select('id')
    .eq('id', bidRequestId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!request) return { error: 'Bid request not found.' }

  const { error } = await adminClient.from('bid_attachments').insert({
    bid_request_id: bidRequestId,
    tenant_id: tenant.id,
    kind: 'external_link',
    attachment_role: 'other',
    external_url: trimmed,
    label: label.trim() || trimmed,
    created_by: appUser.id,
  })
  if (error) return { error: 'Failed to save link.' }

  await logEvent(adminClient, tenant.id, bidRequestId, appUser.id, 'attachment_link_added', { url: trimmed })

  revalidatePath(`/admin/bids/${bidRequestId}`)
  return { success: true }
}

export async function updateAttachment(
  attachmentId: string,
  fields: { attachment_role?: AttachmentRole; visible_to_subs?: boolean; label?: string }
) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: att } = await adminClient
    .from('bid_attachments')
    .select('id, bid_request_id')
    .eq('id', attachmentId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!att) return { error: 'Attachment not found.' }

  const { error } = await adminClient
    .from('bid_attachments')
    .update(fields)
    .eq('id', attachmentId)
    .eq('tenant_id', tenant.id)
  if (error) return { error: 'Failed to update attachment.' }

  await logEvent(adminClient, tenant.id, att.bid_request_id, appUser.id, 'attachment_updated', {
    attachment_id: attachmentId,
    ...fields,
  })

  revalidatePath(`/admin/bids/${att.bid_request_id}`)
  return { success: true }
}

export async function removeAttachment(attachmentId: string) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: att } = await adminClient
    .from('bid_attachments')
    .select('id, bid_request_id, storage_path, attachment_role, label')
    .eq('id', attachmentId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!att) return { error: 'Attachment not found.' }

  // The takeoff is legal evidence of what a sub was asked to price. Once a
  // request leaves draft, replacing it is an addendum event, not a delete.
  if (att.attachment_role === 'takeoff_internal') {
    const { data: request } = await adminClient
      .from('bid_requests')
      .select('status')
      .eq('id', att.bid_request_id)
      .single()
    if (request && request.status !== 'draft') {
      return { error: 'The internal takeoff cannot be deleted after bidding opens — issue an addendum instead.' }
    }
  }

  if (att.storage_path) {
    await adminClient.storage.from('bid-packages').remove([att.storage_path])
  }

  const { error } = await adminClient
    .from('bid_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('tenant_id', tenant.id)
  if (error) return { error: 'Failed to remove attachment.' }

  await logEvent(adminClient, tenant.id, att.bid_request_id, appUser.id, 'attachment_removed', {
    attachment_id: attachmentId,
    label: att.label,
    role: att.attachment_role,
  })

  revalidatePath(`/admin/bids/${att.bid_request_id}`)
  return { success: true }
}

export async function getAttachmentUrl(attachmentId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: att } = await adminClient
    .from('bid_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!att?.storage_path) return { error: 'Attachment not found.' }

  const { data, error } = await adminClient.storage
    .from('bid-packages')
    .createSignedUrl(att.storage_path, 300, { download: true })
  if (error || !data?.signedUrl) return { error: 'Failed to generate download URL.' }

  return { url: data.signedUrl }
}
