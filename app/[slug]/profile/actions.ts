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
  const companyName = (formData.get('companyName') as string) || null
  const address = (formData.get('address') as string) || null
  const crewSizeRaw = formData.get('crewSize') as string
  const yearsInBusinessRaw = formData.get('yearsInBusiness') as string
  const insuranceProvider = (formData.get('insuranceProvider') as string) || null
  const insuranceExpiration = (formData.get('insuranceExpiration') as string) || null

  if (!firstName || !lastName) {
    return { error: 'First name and last name are required.' }
  }

  const crewSize = crewSizeRaw ? parseInt(crewSizeRaw) : 1
  const yearsInBusiness = yearsInBusinessRaw ? parseInt(yearsInBusinessRaw) : null

  const { appUser } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('users')
    .update({
      first_name: firstName,
      last_name: lastName,
      phone,
      company_name: companyName?.trim() || null,
      address: address?.trim() || null,
      crew_size: crewSize,
      years_in_business: yearsInBusiness,
      insurance_provider: insuranceProvider?.trim() || null,
      insurance_expiration: insuranceExpiration || null,
    })
    .eq('id', appUser.id)

  if (error) {
    return { error: 'Failed to update profile. Please try again.' }
  }

  return {
    success: true,
    values: {
      firstName,
      lastName,
      email: appUser.email,
      phone: phone || '',
      companyName: companyName || '',
      address: address || '',
      crewSize: crewSize.toString(),
      yearsInBusiness: yearsInBusiness?.toString() || '',
      insuranceProvider: insuranceProvider || '',
      insuranceExpiration: insuranceExpiration || '',
      w9FileUrl: appUser.w9_file_url || '',
      coiFileUrl: appUser.coi_file_url || '',
    },
  }
}

export async function uploadDocument(slug: string, docType: 'w9' | 'coi', fileUrl: string) {
  const { appUser } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  const updateData: Record<string, string> = {}
  if (docType === 'w9') {
    updateData.w9_file_url = fileUrl
    updateData.w9_uploaded_at = new Date().toISOString()
  } else {
    updateData.coi_file_url = fileUrl
    updateData.coi_uploaded_at = new Date().toISOString()
  }

  const { error } = await adminClient
    .from('users')
    .update(updateData)
    .eq('id', appUser.id)

  if (error) {
    return { error: 'Failed to save document reference.' }
  }

  return { success: true }
}

export async function updateNotificationPreferences(
  slug: string,
  preferences: { project_invites: boolean; project_updates: boolean }
) {
  const { appUser } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  // Merge with existing preferences (keep admin-side prefs intact)
  const existing = appUser.notification_preferences ?? {
    project_invites: true,
    project_updates: true,
    project_accepted: true,
    project_cancelled: true,
  }

  const { error } = await adminClient
    .from('users')
    .update({
      notification_preferences: {
        ...existing,
        project_invites: preferences.project_invites,
        project_updates: preferences.project_updates,
      },
    })
    .eq('id', appUser.id)

  if (error) {
    return { error: 'Failed to update notification preferences.' }
  }

  return { success: true }
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

  await getCurrentSub(slug)
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
