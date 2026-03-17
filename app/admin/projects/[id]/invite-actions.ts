'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSubCompliant, isTenantActive } from '@/lib/types'
import type { AppUser } from '@/lib/types'

export async function getSubcontractors(tenantId: string) {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('role', 'subcontractor')
    .eq('status', 'active')
    .order('first_name', { ascending: true })

  if (error) {
    return { error: 'Failed to fetch subcontractors.', data: [] }
  }

  const subs = (data ?? []).map((s: AppUser) => ({
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    email: s.email,
    company_name: s.company_name,
    compliant: isSubCompliant(s),
  }))

  return { data: subs }
}

export async function sendInvitations(projectId: string, subcontractorIds: string[]) {
  if (!subcontractorIds.length) {
    return { error: 'No subcontractors selected.' }
  }

  const { tenant } = await getCurrentUser()

  // Plan enforcement
  if (!isTenantActive(tenant)) {
    return { error: 'Your trial has expired. Please subscribe to a plan.' }
  }

  const adminClient = createAdminClient()

  // Check subcontractor limit
  const { count: subCount } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .eq('status', 'active')

  if (subCount !== null && subCount >= tenant.max_subcontractors) {
    return { error: `You've reached your plan limit of ${tenant.max_subcontractors} subcontractors. Please upgrade your plan.` }
  }

  // Verify all selected subs are compliant
  const { data: subs } = await adminClient
    .from('users')
    .select('*')
    .in('id', subcontractorIds)
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .eq('status', 'active')

  const nonCompliant = (subs ?? []).filter((s: AppUser) => !isSubCompliant(s))
  if (nonCompliant.length > 0) {
    const names = nonCompliant.map((s: AppUser) => `${s.first_name} ${s.last_name}`).join(', ')
    return { error: `Cannot invite: ${names} — missing W-9, COI, or insurance is expired.` }
  }

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
  revalidatePath('/admin/dashboard')
  return { success: true }
}
