'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function joinAction(
  _prevState: { error?: string; notFound?: boolean } | null,
  formData: FormData
) {
  const slug = formData.get('slug') as string
  const companyName = formData.get('companyName') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const email = formData.get('email') as string
  const phone = (formData.get('phone') as string) || null
  const password = formData.get('password') as string
  const address = (formData.get('address') as string) || null
  const crewSizeRaw = formData.get('crewSize') as string
  const yearsInBusinessRaw = formData.get('yearsInBusiness') as string
  const insuranceProvider = (formData.get('insuranceProvider') as string) || null
  const insuranceExpiration = (formData.get('insuranceExpiration') as string) || null

  if (!slug || !companyName || !firstName || !lastName || !email || !password) {
    return { error: 'All required fields must be filled out.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const crewSize = crewSizeRaw ? parseInt(crewSizeRaw) : 1
  const yearsInBusiness = yearsInBusinessRaw ? parseInt(yearsInBusinessRaw) : null

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

  // Create users record with all profile fields
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
      company_name: companyName.trim(),
      crew_size: crewSize,
      address: address?.trim() || null,
      years_in_business: yearsInBusiness,
      insurance_provider: insuranceProvider?.trim() || null,
      insurance_expiration: insuranceExpiration || null,
    })

  if (userError) {
    return { error: `Failed to create user profile: ${userError.message}` }
  }

  // Mark any pending platform invite as accepted
  await adminClient
    .from('platform_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('tenant_id', tenant.id)
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')

  // Sign in the user
  await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password })

  redirect(`/${slug}/profile`)
}
