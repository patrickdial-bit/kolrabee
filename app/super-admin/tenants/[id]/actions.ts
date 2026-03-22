'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_LIMITS } from '@/lib/types'

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
