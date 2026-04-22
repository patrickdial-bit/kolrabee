'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/helpers'
import { sendAdminInviteEmail } from '@/lib/email'

export async function inviteAdminToJoin(email: string, name: string) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const normalizedEmail = email.toLowerCase().trim()
  if (!normalizedEmail) {
    return { error: 'Email is required.' }
  }

  const adminClient = createAdminClient()

  // TODO: enforce per-seat admin plan limit when Stripe billing is live (SPEC.md:249).

  const { data: existing } = await adminClient
    .from('users')
    .select('id, role, status')
    .eq('tenant_id', appUser.tenant_id)
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existing) {
    if (existing.role === 'admin') {
      return existing.status === 'active'
        ? { error: 'This email is already registered as an admin.' }
        : { error: 'This email belongs to a removed admin. Reactivate them from the list instead.' }
    }
    return { error: 'This email is already registered as a subcontractor on your account.' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`
  const params = new URLSearchParams({ email: normalizedEmail })
  if (name) params.set('name', name)
  const joinUrl = `${baseUrl}/${tenant.slug}/join-admin?${params.toString()}`

  const { error: inviteError } = await adminClient
    .from('platform_invites')
    .upsert(
      {
        tenant_id: appUser.tenant_id,
        email: normalizedEmail,
        name: name || null,
        role: 'admin',
        status: 'pending',
        invited_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
      { onConflict: 'tenant_id,email' }
    )

  if (inviteError) {
    return { error: inviteError.message }
  }

  await sendAdminInviteEmail({
    to: normalizedEmail,
    name,
    tenantName: tenant.name,
    notificationEmail: tenant.notification_email ?? null,
    joinUrl,
  })

  revalidatePath('/admin/team')
  return { success: true }
}

export async function removeAdmin(userId: string) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  if (userId === appUser.id) {
    return { error: "You can't remove yourself." }
  }
  if (userId === tenant.owner_user_id) {
    return { error: "The account owner can't be removed." }
  }

  const adminClient = createAdminClient()

  const { count: activeAdminCount } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', appUser.tenant_id)
    .eq('role', 'admin')
    .eq('status', 'active')

  if ((activeAdminCount ?? 0) <= 1) {
    return { error: 'You must keep at least one active admin on the account.' }
  }

  const { error } = await adminClient
    .from('users')
    .update({ status: 'deleted' })
    .eq('id', userId)
    .eq('tenant_id', appUser.tenant_id)
    .eq('role', 'admin')

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/team')
  return { success: true }
}

export async function reactivateAdmin(userId: string) {
  const { appUser } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()

  // TODO: enforce per-seat admin plan limit when Stripe billing is live (SPEC.md:249).

  const { error } = await adminClient
    .from('users')
    .update({ status: 'active' })
    .eq('id', userId)
    .eq('tenant_id', appUser.tenant_id)
    .eq('role', 'admin')

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/team')
  return { success: true }
}

export async function revokeAdminInvite(inviteId: string) {
  const { appUser } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('platform_invites')
    .delete()
    .eq('id', inviteId)
    .eq('tenant_id', appUser.tenant_id)
    .eq('role', 'admin')

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/team')
  return { success: true }
}
