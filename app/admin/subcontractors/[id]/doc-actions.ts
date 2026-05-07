'use server'

import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getDocumentUrl(subId: string, docType: 'w9' | 'coi'): Promise<{ url?: string; error?: string }> {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  // Verify the sub belongs to this tenant
  const { data: sub } = await adminClient
    .from('users')
    .select('w9_file_url, coi_file_url, tenant_id')
    .eq('id', subId)
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .single()

  if (!sub) {
    return { error: 'Subcontractor not found.' }
  }

  const filePath = docType === 'w9' ? sub.w9_file_url : sub.coi_file_url
  if (!filePath) {
    return { error: `No ${docType.toUpperCase()} on file.` }
  }

  const { data, error } = await adminClient.storage
    .from('documents')
    .createSignedUrl(filePath, 60 * 5) // 5 minute expiry

  if (error || !data?.signedUrl) {
    return { error: `Failed to generate download link.` }
  }

  return { url: data.signedUrl }
}

function parseReviewDate(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString()
}

export async function uploadDocumentForSub(
  subId: string,
  docType: 'w9' | 'coi',
  filePath: string,
  reviewedAt?: string | null
): Promise<{ success?: boolean; error?: string }> {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()

  const { data: sub } = await adminClient
    .from('users')
    .select('id, tenant_id')
    .eq('id', subId)
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .single()

  if (!sub) {
    return { error: 'Subcontractor not found.' }
  }

  const parsed = parseReviewDate(reviewedAt)
  if (parsed === undefined && reviewedAt) {
    return { error: 'Invalid date.' }
  }
  const timestamp = parsed ?? new Date().toISOString()

  const updateData: Record<string, string> = {}
  if (docType === 'w9') {
    updateData.w9_file_url = filePath
    updateData.w9_uploaded_at = timestamp
  } else {
    updateData.coi_file_url = filePath
    updateData.coi_uploaded_at = timestamp
  }

  const { error } = await adminClient
    .from('users')
    .update(updateData)
    .eq('id', sub.id)

  if (error) {
    return { error: 'Failed to save document reference.' }
  }

  revalidatePath(`/admin/subcontractors/${subId}`)
  return { success: true }
}

export async function updateDocumentReviewDate(
  subId: string,
  docType: 'w9' | 'coi',
  reviewedAt: string | null
): Promise<{ success?: boolean; error?: string }> {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()

  const { data: sub } = await adminClient
    .from('users')
    .select('id, w9_file_url, coi_file_url')
    .eq('id', subId)
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .single()

  if (!sub) {
    return { error: 'Subcontractor not found.' }
  }

  const fileUrl = docType === 'w9' ? sub.w9_file_url : sub.coi_file_url
  if (!fileUrl) {
    return { error: `Upload a ${docType.toUpperCase()} before setting a review date.` }
  }

  const parsed = parseReviewDate(reviewedAt)
  if (parsed === undefined) {
    return { error: 'Invalid date.' }
  }

  const column = docType === 'w9' ? 'w9_uploaded_at' : 'coi_uploaded_at'
  const { error } = await adminClient
    .from('users')
    .update({ [column]: parsed })
    .eq('id', sub.id)

  if (error) {
    return { error: 'Failed to save review date.' }
  }

  revalidatePath(`/admin/subcontractors/${subId}`)
  return { success: true }
}

export async function updateInsuranceForSub(
  subId: string,
  provider: string | null,
  expiration: string | null
): Promise<{ success?: boolean; error?: string }> {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()

  const { data: sub } = await adminClient
    .from('users')
    .select('id')
    .eq('id', subId)
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .single()

  if (!sub) {
    return { error: 'Subcontractor not found.' }
  }

  let expirationValue: string | null = null
  if (expiration && expiration.trim() !== '') {
    const d = new Date(expiration)
    if (isNaN(d.getTime())) {
      return { error: 'Invalid expiration date.' }
    }
    expirationValue = expiration
  }

  const trimmedProvider = provider?.trim() ?? ''
  const { error } = await adminClient
    .from('users')
    .update({
      insurance_provider: trimmedProvider === '' ? null : trimmedProvider,
      insurance_expiration: expirationValue,
    })
    .eq('id', sub.id)

  if (error) {
    return { error: 'Failed to save insurance details.' }
  }

  revalidatePath(`/admin/subcontractors/${subId}`)
  return { success: true }
}
