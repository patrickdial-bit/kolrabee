'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_LIMITS } from '@/lib/types'

export async function suspendTenant(tenantId: string) {
  await requireSuperAdmin()
  const adminClient = createAdminClient()

  // Toggle: if already suspended, reactivate
  const { data: tenant } = await adminClient
    .from('tenants')
    .select('status')
    .eq('id', tenantId)
    .single()

  if (!tenant) return { error: 'Tenant not found.' }

  const newStatus = tenant.status === 'suspended' ? 'active' : 'suspended'

  const { error } = await adminClient
    .from('tenants')
    .update({ status: newStatus })
    .eq('id', tenantId)

  if (error) return { error: error.message }

  revalidatePath(`/super-admin/tenants/${tenantId}`)
  revalidatePath('/super-admin')
  return { success: true, status: newStatus }
}

export async function deleteTenant(tenantId: string) {
  await requireSuperAdmin()
  const adminClient = createAdminClient()

  // Get all users for this tenant to delete their auth accounts
  const { data: users } = await adminClient
    .from('users')
    .select('id, supabase_auth_id')
    .eq('tenant_id', tenantId)

  // Clear owner FK so we can delete users
  await adminClient
    .from('tenants')
    .update({ owner_user_id: null })
    .eq('id', tenantId)

  // Delete related data in correct order
  await adminClient.from('project_invitations').delete().eq('tenant_id', tenantId)
  await adminClient.from('projects').delete().eq('tenant_id', tenantId)
  await adminClient.from('platform_invites').delete().eq('tenant_id', tenantId)
  await adminClient.from('users').delete().eq('tenant_id', tenantId)
  await adminClient.from('tenants').delete().eq('id', tenantId)

  // Delete auth users
  for (const user of users ?? []) {
    if (user.supabase_auth_id) {
      await adminClient.auth.admin.deleteUser(user.supabase_auth_id)
    }
  }

  revalidatePath('/super-admin')
  redirect('/super-admin')
}

export async function updateTenantPlan(tenantId: string, plan: string) {
  await requireSuperAdmin()

  const validPlans = ['free', 'trial', 'starter', 'pro', 'cancelled']
  if (!validPlans.includes(plan)) {
    return { error: 'Invalid plan.' }
  }

  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('tenants')
    .update({
      plan,
      max_projects: limits.max_projects,
      max_subcontractors: limits.max_subcontractors,
    })
    .eq('id', tenantId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/super-admin/tenants/${tenantId}`)
  revalidatePath('/super-admin')
  return { success: true }
}
