'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData
) {
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

  // Verify admin role
  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('role, status')
    .eq('supabase_auth_id', data.user.id)
    .single()

  if (!appUser) {
    await supabase.auth.signOut()
    return { error: 'Account not found.' }
  }

  if (appUser.status === 'deleted') {
    await supabase.auth.signOut()
    return { error: 'This account has been deactivated.' }
  }

  // Check if super admin
  const { data: superAdmin } = await adminClient
    .from('super_admins')
    .select('id')
    .eq('supabase_auth_id', data.user.id)
    .single()

  if (superAdmin) {
    redirect('/super-admin')
  }

  if (appUser.role !== 'admin') {
    await supabase.auth.signOut()
    return { error: 'Access denied. This portal is for admin users only.' }
  }

  redirect('/admin/dashboard')
}
