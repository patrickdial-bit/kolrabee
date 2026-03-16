'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const slug = formData.get('slug') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Invalid email or password.' }
  }

  // Verify user exists in this tenant
  const adminClient = createAdminClient()

  const { data: tenant } = await adminClient
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!tenant) {
    await supabase.auth.signOut()
    return { error: 'Company not found.' }
  }

  const { data: appUser } = await adminClient
    .from('users')
    .select('role, status')
    .eq('supabase_auth_id', data.user.id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!appUser) {
    await supabase.auth.signOut()
    return { error: 'Account not found for this company.' }
  }

  if (appUser.status === 'deleted') {
    await supabase.auth.signOut()
    return { error: 'This account has been deactivated.' }
  }

  if (appUser.role !== 'subcontractor') {
    await supabase.auth.signOut()
    return { error: 'Please use the admin portal to sign in.' }
  }

  redirect(`/${slug}/dashboard`)
}
