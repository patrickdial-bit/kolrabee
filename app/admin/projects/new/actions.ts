'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, normalizeUrl } from '@/lib/helpers'
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
  if (estimatedLaborHours !== null && (isNaN(estimatedLaborHours) || estimatedLaborHours < 0)) {
    return { error: 'Estimated labor hours must be a positive number.' }
  }

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

  if (tenant.max_projects >= 0 && projectCount !== null && projectCount >= tenant.max_projects) {
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
      work_order_link: normalizeUrl(workOrderLink),
      status: 'available',
      companycam_link: normalizeUrl(companycamLink),
      notes: notes?.trim() || null,
      admin_notes: adminNotes?.trim() || null,
      version: 1,
    })
    .select('id')
    .single()

  if (error) {
    return { error: 'Failed to create project. Please try again.' }
  }

  // Handle file attachments if any
  const attachmentsJson = formData.get('attachments_json') as string
  if (attachmentsJson) {
    try {
      const files = JSON.parse(attachmentsJson) as Array<{ name: string; path: string; size: number; type: string }>
      for (const file of files.slice(0, 3)) {
        await adminClient
          .from('project_attachments')
          .insert({
            tenant_id: tenant.id,
            project_id: project.id,
            file_name: file.name,
            file_url: file.path,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: appUser.id,
          })
      }
    } catch {
      // Non-fatal: project created but attachments may have failed
      console.error('Failed to save attachments')
    }
  }

  revalidatePath('/admin/dashboard')
  redirect(`/admin/projects/${project.id}`)
}
