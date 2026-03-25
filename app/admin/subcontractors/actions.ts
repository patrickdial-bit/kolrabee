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
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function reactivateSub(userId: string) {
  // Verify caller is an admin
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()

  // Enforce subcontractor plan limit before reactivating
  const { count: activeSubCount } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', appUser.tenant_id)
    .eq('role', 'subcontractor')
    .eq('status', 'active')

  if (activeSubCount !== null && activeSubCount >= tenant.max_subcontractors) {
    return { error: `You've reached your plan limit of ${tenant.max_subcontractors} subcontractor${tenant.max_subcontractors === 1 ? '' : 's'}. Upgrade your plan to reactivate.` }
  }

  const { error } = await adminClient
    .from('users')
    .update({ status: 'active' })
    .eq('id', userId)
    .eq('tenant_id', appUser.tenant_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/subcontractors')
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function inviteSubToJoin(email: string, name: string) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()

  // Enforce subcontractor plan limit
  const { count: activeSubCount } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', appUser.tenant_id)
    .eq('role', 'subcontractor')
    .eq('status', 'active')

  if (activeSubCount !== null && activeSubCount >= tenant.max_subcontractors) {
    return { error: `You've reached your plan limit of ${tenant.max_subcontractors} subcontractor${tenant.max_subcontractors === 1 ? '' : 's'}. Upgrade your plan to invite more.` }
  }

  // Check if this email already exists for the tenant
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

  const normalizedEmail = email.toLowerCase().trim()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`
  const params = new URLSearchParams({ email: normalizedEmail })
  if (name) params.set('name', name)
  const joinUrl = `${baseUrl}/${tenant.slug}/join?${params.toString()}`

  // Record the invite in the database
  await adminClient
    .from('platform_invites')
    .upsert(
      {
        tenant_id: appUser.tenant_id,
        email: normalizedEmail,
        name: name || null,
        status: 'pending',
        invited_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
      { onConflict: 'tenant_id,email' }
    )

  await sendPlatformInviteEmail({
    to: normalizedEmail,
    name,
    tenantName: tenant.name,
    notificationEmail: tenant.notification_email ?? null,
    joinUrl,
  })

  revalidatePath('/admin/dashboard')
  return { success: true }
}
