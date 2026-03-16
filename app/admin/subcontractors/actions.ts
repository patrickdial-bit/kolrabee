'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/helpers'

export async function softDeleteSub(userId: string) {
  // Verify caller is an admin
  const { appUser } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('users')
    .update({ status: 'deleted' })
    .eq('id', userId)
    .eq('tenant_id', appUser.tenant_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/subcontractors')
  return { success: true }
}

export async function reactivateSub(userId: string) {
  // Verify caller is an admin
  const { appUser } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('users')
    .update({ status: 'active' })
    .eq('id', userId)
    .eq('tenant_id', appUser.tenant_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/subcontractors')
  return { success: true }
}
