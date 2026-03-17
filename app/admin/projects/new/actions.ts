'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { isTenantActive } from '@/lib/types'

export async function createProject(formData: FormData) {
  const customerName = formData.get('customer_name') as string
  const address = formData.get('address') as string
  const jobNumber = formData.get('job_number') as string
  const startDate = formData.get('start_date') as string
  const startTime = formData.get('start_time') as string
  const payoutAmountRaw = formData.get('payout_amount') as string
  const estimatedLaborHoursRaw = formData.get('estimated_labor_hours') as string
  const workOrderLink = formData.get('work_order_link') as string
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

  const estimatedLaborHours = estimatedLaborHoursRaw ? parseInt(estimatedLaborHoursRaw) : null

  const { appUser, tenant } = await getCurrentUser()

  // Plan enforcement: block if trial expired and no active subscription
  if (!isTenantActive(tenant)) {
    return { error: 'Your trial has expired. Please subscribe to a plan to create projects.' }
  }

  const adminClient = createAdminClient()

  // Check project limit
  const { count: projectCount } = await adminClient
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .neq('status', 'cancelled')

  if (projectCount !== null && projectCount >= tenant.max_projects) {
    return { error: `You've reached your plan limit of ${tenant.max_projects} projects. Please upgrade your plan.` }
  }

  const { data: project, error } = await adminClient
    .from('projects')
    .insert({
      tenant_id: tenant.id,
      created_by: appUser.id,
      job_number: jobNumber?.trim() || null,
      customer_name: customerName.trim(),
      address: address.trim(),
      start_date: startDate || null,
      start_time: startTime || null,
      payout_amount: payoutAmount,
      estimated_labor_hours: estimatedLaborHours,
      work_order_link: workOrderLink?.trim() || null,
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
