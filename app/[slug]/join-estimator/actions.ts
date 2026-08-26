'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function joinEstimatorAction(
  _prevState: { error?: string; notFound?: boolean } | null,
  formData: FormData
) {
  const slug = formData.get('slug') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const email = formData.get('email') as string
  const phone = (formData.get('phone') as string) || null
  const password = formData.get('password') as string

  if (!slug || !firstName || !lastName || !email || !password) {
    return { error: 'All required fields must be filled out.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const normalizedEmail = email.toLowerCase().trim()
  const adminClient = createAdminClient()

  const { data: tenant } = await adminClient
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!tenant) {
    return { notFound: true, error: 'Company not found.' }
  }

  // Require a valid pending estimator invite — prevents unsolicited sign-ups.
  const { data: invite } = await adminClient
    .from('platform_invites')
    .select('id, status, expires_at')
    .eq('tenant_id', tenant.id)
    .eq('email', normalizedEmail)
    .eq('role', 'estimator')
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite) {
    return { error: 'No valid estimator invitation found for this email. Please ask an admin to send you a new invite.' }
  }

  if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
    return { error: 'This invitation has expired. Please ask an admin to send you a new invite.' }
  }

  const { data: existingUser } = await adminClient
    .from('users')
    .select('id, status')
    .eq('tenant_id', tenant.id)
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingUser) {
    if (existingUser.status === 'deleted') {
      return { error: 'This email address is no longer eligible for registration with this company.' }
    }
    return { error: 'An account with this email already exists. Please sign in instead.' }
  }

  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
    },
  })

  if (authError) {
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: 'Failed to create user account.' }
  }

  const { error: userError } = await adminClient
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      tenant_id: tenant.id,
      email: normalizedEmail,
      first_name: firstName,
      last_name: lastName,
      phone,
      role: 'estimator',
    })

  if (userError) {
    return { error: `Failed to create user profile: ${userError.message}` }
  }

  await adminClient
    .from('platform_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  await supabase.auth.signInWithPassword({ email: normalizedEmail, password })

  redirect('/admin/quotes')
}
