'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/helpers'
import { sendPlatformInviteEmail } from '@/lib/email'

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

export async function inviteSubToJoin(email: string, name: string) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  // Check if this email already exists for the tenant
  const adminClient = createAdminClient()
  const { data: existing } = await adminClient
    .from('users')
    .select('id, status')
    .eq('tenant_id', appUser.tenant_id)
    .eq('email', email.toLowerCase().trim())
    .single()

  if (existing) {
    if (existing.status === 'active') {
      return { error: 'This email is already registered as a subcontractor.' }
    }
    return { error: 'This email belongs to a deleted subcontractor. Reactivate them from the list instead.' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tradetap-seven.vercel.app'
  const joinUrl = `${baseUrl}/${tenant.slug}/join`

  await sendPlatformInviteEmail({
    to: email.toLowerCase().trim(),
    name,
    tenantName: tenant.name,
    notificationEmail: tenant.notification_email ?? null,
    joinUrl,
  })

  return { success: true }
}
