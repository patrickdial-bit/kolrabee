'use server'

import { createClient } from '@/lib/supabase/server'

export async function forgotPasswordAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Email address is required.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
