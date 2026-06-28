'use server'

import { getSiteUrl } from '@/lib/site-url'

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

  if (tenant.max_subcontractors >= 0 && activeSubCount !== null && activeSubCount >= tenant.max_subcontractors) {
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

  if (tenant.max_subcontractors >= 0 && activeSubCount !== null && activeSubCount >= tenant.max_subcontractors) {
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
  const baseUrl = getSiteUrl()
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

export async function cancelSubInvite(inviteId: string) {
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
    .eq('role', 'subcontractor')
    .eq('status', 'pending')

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function editSubInvite(inviteId: string, email: string, name: string) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const normalizedEmail = email.toLowerCase().trim()
  if (!normalizedEmail) {
    return { error: 'Email is required.' }
  }

  const adminClient = createAdminClient()

  const { data: invite } = await adminClient
    .from('platform_invites')
    .select('id, email, status')
    .eq('id', inviteId)
    .eq('tenant_id', appUser.tenant_id)
    .eq('role', 'subcontractor')
    .single()

  if (!invite) {
    return { error: 'Invite not found.' }
  }
  if (invite.status !== 'pending') {
    return { error: 'This invite has already been accepted.' }
  }

  // If email changed, make sure the new one isn't already in use.
  if (normalizedEmail !== invite.email) {
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id, status')
      .eq('tenant_id', appUser.tenant_id)
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingUser) {
      return existingUser.status === 'active'
        ? { error: 'A subcontractor with this email already exists.' }
        : { error: 'This email belongs to a deleted subcontractor. Reactivate them from the list instead.' }
    }

    const { data: existingInvite } = await adminClient
      .from('platform_invites')
      .select('id')
      .eq('tenant_id', appUser.tenant_id)
      .eq('email', normalizedEmail)
      .neq('id', inviteId)
      .maybeSingle()

    if (existingInvite) {
      return { error: 'Another invite for this email already exists.' }
    }
  }

  const trimmedName = name.trim()
  const { error } = await adminClient
    .from('platform_invites')
    .update({
      email: normalizedEmail,
      name: trimmedName || null,
    })
    .eq('id', inviteId)
    .eq('tenant_id', appUser.tenant_id)

  if (error) {
    return { error: error.message }
  }

  // Re-send the invite email so the recipient (especially if email changed) gets the updated link.
  const baseUrl = getSiteUrl()
  const params = new URLSearchParams({ email: normalizedEmail })
  if (trimmedName) params.set('name', trimmedName)
  const joinUrl = `${baseUrl}/${tenant.slug}/join?${params.toString()}`

  await sendPlatformInviteEmail({
    to: normalizedEmail,
    name: trimmedName,
    tenantName: tenant.name,
    notificationEmail: tenant.notification_email ?? null,
    joinUrl,
  })

  revalidatePath('/admin/dashboard')
  return { success: true }
}
