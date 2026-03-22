'use server'

import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

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
