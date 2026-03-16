'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getSubcontractors(tenantId: string) {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .select('id, first_name, last_name, email')
    .eq('tenant_id', tenantId)
    .eq('role', 'subcontractor')
    .eq('status', 'active')
    .order('first_name', { ascending: true })

  if (error) {
    return { error: 'Failed to fetch subcontractors.', data: [] }
  }

  return { data: data ?? [] }
}

export async function sendInvitations(projectId: string, subcontractorIds: string[]) {
  if (!subcontractorIds.length) {
    return { error: 'No subcontractors selected.' }
  }

  const { tenant } = await getCurrentUser()

  const adminClient = createAdminClient()

  const rows = subcontractorIds.map((subId) => ({
    tenant_id: tenant.id,
    project_id: projectId,
    subcontractor_id: subId,
    status: 'invited' as const,
    invited_at: new Date().toISOString(),
  }))

  const { error } = await adminClient
    .from('project_invitations')
    .upsert(rows, {
      onConflict: 'project_id,subcontractor_id',
      ignoreDuplicates: true,
    })

  if (error) {
    return { error: 'Failed to send invitations.' }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  return { success: true }
}
