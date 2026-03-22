'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function updateNotificationEmail(email: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const trimmed = email.trim()

  // Basic email validation (or allow empty to clear)
  if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { error: 'Please enter a valid email address.' }
  }

  const { error } = await adminClient
    .from('tenants')
    .update({ notification_email: trimmed || null })
    .eq('id', tenant.id)

  if (error) {
    return { error: 'Failed to update notification email.' }
  }

  revalidatePath('/admin/billing')
  return { success: true }
}
