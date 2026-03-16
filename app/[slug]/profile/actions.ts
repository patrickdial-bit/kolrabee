'use server'

import { getCurrentSub } from '@/lib/helpers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function updateProfile(
  _prevState: { error?: string; success?: boolean; values?: Record<string, string> } | null,
  formData: FormData
) {
  const slug = formData.get('slug') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const phone = (formData.get('phone') as string) || null

  if (!firstName || !lastName) {
    return { error: 'First name and last name are required.' }
  }

  const { appUser } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('users')
    .update({
      first_name: firstName,
      last_name: lastName,
      phone,
    })
    .eq('id', appUser.id)

  if (error) {
    return {
      error: 'Failed to update profile. Please try again.',
      values: {
        firstName: appUser.first_name,
        lastName: appUser.last_name,
        email: appUser.email,
        phone: appUser.phone || '',
      },
    }
  }

  return {
    success: true,
    values: {
      firstName,
      lastName,
      email: appUser.email,
      phone: phone || '',
    },
  }
}

export async function changePassword(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const slug = formData.get('slug') as string
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!newPassword || !confirmPassword) {
    return { error: 'All password fields are required.' }
  }

  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters.' }
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  // Verify the user is authenticated
  await getCurrentSub(slug)

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
