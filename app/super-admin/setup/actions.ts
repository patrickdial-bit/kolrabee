'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function setupSuperAdmin(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const secretKey = formData.get('secret_key') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.' }
  }

  // Require SUPER_ADMIN_SETUP_KEY env var to prevent unauthorized setup
  const expectedKey = process.env.SUPER_ADMIN_SETUP_KEY
  if (!expectedKey || secretKey !== expectedKey) {
    return { error: 'Invalid setup key.' }
  }

  const adminClient = createAdminClient()

  // Check if any super admin already exists
  const { data: existing } = await adminClient
    .from('super_admins')
    .select('id')
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'A super admin already exists. Use Supabase SQL to add more.' }
  }

  // Create auth user via admin API
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    return { error: authError.message }
  }

  // Insert into super_admins
  const { error: insertError } = await adminClient
    .from('super_admins')
    .insert({
      supabase_auth_id: authData.user.id,
      email,
    })

  if (insertError) {
    return { error: insertError.message }
  }

  // Sign in
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password })

  redirect('/super-admin')
}
