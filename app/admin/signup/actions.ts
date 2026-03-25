'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${base}-${suffix}`
}

export async function signupAction(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const companyName = formData.get('companyName') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!companyName || !firstName || !lastName || !email || !password) {
    return { error: 'All fields are required.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
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

  const slug = generateSlug(companyName)

  // Create tenant on the free plan
  const { data: tenant, error: tenantError } = await adminClient
    .from('tenants')
    .insert({
      name: companyName,
      slug,
      plan: 'free',
      billing_email: email,
      max_projects: 3,
      max_subcontractors: 3,
    })
    .select('id')
    .single()

  if (tenantError) {
    return { error: `Failed to create company: ${tenantError.message}` }
  }

  // Create user record with admin role
  const { data: appUser, error: userError } = await adminClient
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      tenant_id: tenant.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'admin',
    })
    .select('id')
    .single()

  if (userError) {
    return { error: `Failed to create user profile: ${userError.message}` }
  }

  // Set tenant owner
  await adminClient
    .from('tenants')
    .update({ owner_user_id: appUser.id })
    .eq('id', tenant.id)

  redirect('/admin/billing')
}
