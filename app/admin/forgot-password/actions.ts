'use server'

import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'

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
    redirectTo: `${getSiteUrl()}/admin/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
