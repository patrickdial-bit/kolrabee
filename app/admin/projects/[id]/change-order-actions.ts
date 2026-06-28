'use server'

import { getSiteUrl } from '@/lib/site-url'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendChangeOrderEmail } from '@/lib/email'
import { getNotificationPrefs } from '@/lib/types'

function siteUrl() {
  return getSiteUrl()
}

// Statuses where adjusting scope/pay is sensible. Paid jobs are settled,
// cancelled jobs are dead, and imported rows aren't part of the dispatch flow.
const ADJUSTABLE_STATUSES = ['available', 'accepted', 'in_progress', 'pending_completion', 'completed']

/**
 * Add a change order to a project: records the scope/pay adjustment as a dated,
 * attributed line item and rolls the delta into the project's running payout.
 * Notifies the assigned subcontractor (if any) so pay changes are never a surprise.
 */
export async function addChangeOrder(projectId: string, formData: FormData) {
  const amountRaw = formData.get('amount') as string
  const description = (formData.get('description') as string)?.trim()

  const amount = parseFloat(amountRaw)
  if (isNaN(amount)) {
    return { error: 'Enter a valid dollar amount (use a negative value to reduce pay).' }
  }
  if (amount === 0) {
    return { error: 'A change order amount cannot be zero.' }
  }
  if (!description) {
    return { error: 'Describe what changed so the contractor knows what the adjustment is for.' }
  }

  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: project, error: fetchErr } = await adminClient
    .from('projects')
    .select('payout_amount, status, accepted_by, job_number, customer_name')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  if (fetchErr || !project) {
    return { error: 'Project not found.' }
  }

  if (!ADJUSTABLE_STATUSES.includes(project.status)) {
    return { error: 'Change orders can only be added before a project is paid or cancelled.' }
  }

  const previousPayout = Number(project.payout_amount)
  const newPayout = Math.round((previousPayout + amount) * 100) / 100

  if (newPayout < 0) {
    return { error: `That reduction is larger than the current payout of ${previousPayout}. Adjust the amount.` }
  }

  // Record the change order, then update the project's running total.
  const { error: insertErr } = await adminClient
    .from('change_orders')
    .insert({
      tenant_id: tenant.id,
      project_id: projectId,
      amount,
      description,
      previous_payout: previousPayout,
      new_payout: newPayout,
      created_by: appUser.id,
    })

  if (insertErr) {
    return { error: 'Failed to record the change order.' }
  }

  const { error: updateErr } = await adminClient
    .from('projects')
    .update({ payout_amount: newPayout })
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)

  if (updateErr) {
    return { error: 'Recorded the change order but failed to update the payout. Please refresh.' }
  }

  // Notify the assigned sub (fire-and-forget).
  let subNotified = false
  if (project.accepted_by) {
    const { data: sub } = await adminClient
      .from('users')
      .select('email, first_name, notification_preferences')
      .eq('id', project.accepted_by)
      .single()

    if (sub) {
      const prefs = getNotificationPrefs(sub)
      if (prefs.project_change_order) {
        sendChangeOrderEmail({
          to: sub.email,
          subName: sub.first_name,
          tenantName: tenant.name,
          notificationEmail: tenant.notification_email,
          jobNumber: project.job_number,
          customerName: project.customer_name,
          amount,
          description,
          previousPayout,
          newPayout,
          projectUrl: `${siteUrl()}/${tenant.slug}/projects/${projectId}`,
        })
        subNotified = true
      }
    }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/admin/dashboard')
  return { success: true, subNotified }
}

/**
 * Delete a change order entered by mistake. Reverses its delta out of the
 * project's running payout so the total stays consistent.
 */
export async function deleteChangeOrder(changeOrderId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: co, error: fetchErr } = await adminClient
    .from('change_orders')
    .select('id, project_id, amount')
    .eq('id', changeOrderId)
    .eq('tenant_id', tenant.id)
    .single()

  if (fetchErr || !co) {
    return { error: 'Change order not found.' }
  }

  const { data: project } = await adminClient
    .from('projects')
    .select('payout_amount, status')
    .eq('id', co.project_id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!project) {
    return { error: 'Project not found.' }
  }

  if (project.status === 'paid') {
    return { error: 'Cannot remove a change order on a paid project.' }
  }

  const newPayout = Math.round((Number(project.payout_amount) - Number(co.amount)) * 100) / 100
  if (newPayout < 0) {
    return { error: 'Removing this change order would make the payout negative. Remove later change orders first.' }
  }

  const { error: deleteErr } = await adminClient
    .from('change_orders')
    .delete()
    .eq('id', changeOrderId)
    .eq('tenant_id', tenant.id)

  if (deleteErr) {
    return { error: 'Failed to remove the change order.' }
  }

  const { error: updateErr } = await adminClient
    .from('projects')
    .update({ payout_amount: newPayout })
    .eq('id', co.project_id)
    .eq('tenant_id', tenant.id)

  if (updateErr) {
    return { error: 'Removed the change order but failed to update the payout. Please refresh.' }
  }

  revalidatePath(`/admin/projects/${co.project_id}`)
  revalidatePath('/admin/dashboard')
  return { success: true }
}
