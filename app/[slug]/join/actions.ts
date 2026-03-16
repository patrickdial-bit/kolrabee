'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function joinAction(
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

  const adminClient = createAdminClient()

  // Look up tenant by slug
  const { data: tenant } = await adminClient
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!tenant) {
    return { notFound: true, error: 'Company not found.' }
  }

  // Check if email is already registered for this tenant (including deleted)
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id, status')
    .eq('tenant_id', tenant.id)
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (existingUser) {
    if (existingUser.status === 'deleted') {
      return { error: 'This email address is no longer eligible for registration with this company.' }
    }
    return { error: 'An account with this email already exists. Please sign in instead.' }
  }

  const supabase = await createClient()

  // Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.toLowerCase(),
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

  // Create users record
  const { error: userError } = await adminClient
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      tenant_id: tenant.id,
      email: email.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      phone,
      role: 'subcontractor',
    })

  if (userError) {
    return { error: `Failed to create user profile: ${userError.message}` }
  }

  // Sign in the user
  await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password })

  redirect(`/${slug}/dashboard`)
}
