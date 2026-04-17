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

export async function uploadDocumentForSub(
  subId: string,
  docType: 'w9' | 'coi',
  filePath: string
): Promise<{ success?: boolean; error?: string }> {
  const { tenant } = await getCurrentUser()
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

  const updateData: Record<string, string> = {}
  if (docType === 'w9') {
    updateData.w9_file_url = filePath
    updateData.w9_uploaded_at = new Date().toISOString()
  } else {
    updateData.coi_file_url = filePath
    updateData.coi_uploaded_at = new Date().toISOString()
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
