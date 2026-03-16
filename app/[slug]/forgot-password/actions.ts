'use server'

import { createClient } from '@/lib/supabase/server'

export async function forgotPasswordAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const email = formData.get('email') as string
  const slug = formData.get('slug') as string

  if (!email) {
    return { error: 'Email address is required.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/${slug}/login`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
