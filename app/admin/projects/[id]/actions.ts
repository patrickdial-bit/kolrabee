'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser, normalizeUrl } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function updateProject(projectId: string, formData: FormData) {
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

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('projects')
    .update({
      job_number: jobNumber?.trim() || null,
      customer_name: customerName.trim(),
      address: address.trim(),
      start_date: startDate || null,
      start_time: startTime || null,
      payout_amount: payoutAmount,
      estimated_labor_hours: estimatedLaborHours,
      work_order_link: normalizeUrl(workOrderLink),
      companycam_link: normalizeUrl(companycamLink),
      notes: notes?.trim() || null,
      admin_notes: adminNotes?.trim() || null,
    })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)

  if (error) {
    return { error: 'Failed to update project.' }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  return { success: true }
}

export async function markCompleted(projectId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('projects')
    .update({ status: 'completed' })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .in('status', ['accepted', 'in_progress'])

  if (error) {
    return { error: 'Failed to mark project as completed.' }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  return { success: true }
}

export async function markPaid(projectId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('projects')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .in('status', ['accepted', 'in_progress', 'completed'])

  if (error) {
    return { error: 'Failed to mark project as paid.' }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function cancelProject(projectId: string, version: number) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('projects')
    .update({
      status: 'available',
      accepted_by: null,
      accepted_at: null,
      version: version + 1,
    })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('version', version)
    .in('status', ['accepted', 'in_progress', 'completed'])
    .select('id')

  if (error) {
    return { error: 'Failed to cancel project.' }
  }

  if (!data || data.length === 0) {
    return { error: 'Conflict: this project was modified by someone else. Please refresh.' }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function deleteProject(projectId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('status', 'available')
    .select('id')

  if (error) {
    return { error: 'Failed to delete project.' }
  }

  if (!data || data.length === 0) {
    return { error: 'Only available projects can be deleted.' }
  }

  revalidatePath('/admin/dashboard')
  redirect('/admin/dashboard')
}
