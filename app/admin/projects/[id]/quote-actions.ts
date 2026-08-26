'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

// Attach a pre-sale quote (created by an estimator before the contract was
// signed) to the project the admin created after signing. The quote's numbers
// become the project's estimate — no re-keying.
export async function linkQuoteToProject(projectId: string, quoteId: string) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()

  const { data: project } = await adminClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!project) {
    return { error: 'Project not found.' }
  }

  const { data: existing } = await adminClient
    .from('project_estimates')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle()

  if (existing) {
    return { error: 'This project already has an estimate.' }
  }

  const { error } = await adminClient
    .from('project_estimates')
    .update({ project_id: projectId, updated_by: appUser.id, updated_at: new Date().toISOString() })
    .eq('id', quoteId)
    .eq('tenant_id', tenant.id)
    .is('project_id', null)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/admin/quotes')
  return { success: true }
}
