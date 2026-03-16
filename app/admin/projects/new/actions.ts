'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createProject(formData: FormData) {
  const customerName = formData.get('customer_name') as string
  const address = formData.get('address') as string
  const jobNumber = formData.get('job_number') as string
  const startDate = formData.get('start_date') as string
  const payoutAmountRaw = formData.get('payout_amount') as string
  const companycamLink = formData.get('companycam_link') as string
  const notes = formData.get('notes') as string
  const adminNotes = formData.get('admin_notes') as string

  if (!customerName?.trim()) {
    return { error: 'Customer name is required.' }
  }

  if (!address?.trim()) {
    return { error: 'Address is required.' }
  }

  const payoutAmount = parseFloat(payoutAmountRaw)
  if (isNaN(payoutAmount) || payoutAmount < 0) {
    return { error: 'A valid payout amount is required.' }
  }

  const { appUser, tenant } = await getCurrentUser()

  const adminClient = createAdminClient()
  const { data: project, error } = await adminClient
    .from('projects')
    .insert({
      tenant_id: tenant.id,
      created_by: appUser.id,
      job_number: jobNumber?.trim() || null,
      customer_name: customerName.trim(),
      address: address.trim(),
      start_date: startDate || null,
      payout_amount: payoutAmount,
      status: 'available',
      companycam_link: companycamLink?.trim() || null,
      notes: notes?.trim() || null,
      admin_notes: adminNotes?.trim() || null,
      version: 1,
    })
    .select('id')
    .single()

  if (error) {
    return { error: 'Failed to create project. Please try again.' }
  }

  revalidatePath('/admin/dashboard')
  redirect(`/admin/projects/${project.id}`)
}
