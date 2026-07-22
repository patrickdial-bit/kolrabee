'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeAndStoreProject } from '@/lib/geocode'
import { recordSuppression } from '@/lib/compliance'
import { mkLeadName, type MkLeadStatus } from '@/lib/types'

const VALID_STATUSES: MkLeadStatus[] = ['new', 'contacted', 'qualified', 'booked', 'lost']

export async function updateLeadStatus(leadId: string, status: MkLeadStatus) {
  if (!VALID_STATUSES.includes(status)) return { error: 'Invalid status.' }
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: rows, error } = await adminClient
    .from('mk_leads')
    .update({ status })
    .eq('id', leadId)
    .eq('tenant_id', tenant.id)
    .select('id')

  if (error || !rows || rows.length === 0) return { error: 'Failed to update lead.' }

  await adminClient.from('mk_lead_events').insert({
    tenant_id: tenant.id,
    lead_id: leadId,
    event_type: status,
    detail: `Marked ${status}`,
    created_by: appUser.id,
  })

  revalidatePath('/admin/leads')
  return { success: true }
}

export async function addLeadNote(leadId: string, note: string) {
  const trimmed = note.trim()
  if (!trimmed) return { error: 'Note cannot be empty.' }
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: lead } = await adminClient
    .from('mk_leads')
    .select('id')
    .eq('id', leadId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!lead) return { error: 'Lead not found.' }

  const { error } = await adminClient.from('mk_lead_events').insert({
    tenant_id: tenant.id,
    lead_id: leadId,
    event_type: 'note',
    detail: trimmed.slice(0, 1000),
    created_by: appUser.id,
  })
  if (error) return { error: 'Failed to add note.' }

  revalidatePath('/admin/leads')
  return { success: true }
}

// M5 handoff: the lead becomes a real job on the dispatch board — not a
// calendar invite. The admin fills in payout/schedule via the normal project
// flow afterwards.
export async function convertLeadToProject(leadId: string) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: lead } = await adminClient
    .from('mk_leads')
    .select('*')
    .eq('id', leadId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!lead) return { error: 'Lead not found.' }
  if (lead.project_id) return { error: 'This lead already has a job.' }

  const customerName = mkLeadName(lead)
  const contactBits = [lead.phone, lead.email].filter(Boolean).join(' · ')
  const notes = [
    lead.service_requested ? `Requested service: ${lead.service_requested}` : null,
    lead.message ? `Lead message: ${lead.message}` : null,
    contactBits ? `Contact: ${contactBits}` : null,
    'Created from marketing lead.',
  ]
    .filter(Boolean)
    .join('\n')

  const { data: project, error } = await adminClient
    .from('projects')
    .insert({
      tenant_id: tenant.id,
      created_by: appUser.id,
      customer_name: customerName,
      address: lead.address?.trim() || 'Address TBD',
      payout_amount: 0,
      status: 'available',
      notes,
      version: 1,
    })
    .select('id')
    .single()

  if (error || !project) return { error: 'Failed to create the job.' }

  await adminClient
    .from('mk_leads')
    .update({ status: 'booked', project_id: project.id })
    .eq('id', leadId)

  await adminClient.from('mk_lead_events').insert({
    tenant_id: tenant.id,
    lead_id: leadId,
    event_type: 'booked',
    detail: `Converted to job for ${customerName}`,
    created_by: appUser.id,
  })

  // Best-effort geocode so the new job shows on the map.
  if (lead.address?.trim()) {
    await geocodeAndStoreProject(project.id, lead.address.trim(), tenant.service_area)
  }

  revalidatePath('/admin/leads')
  revalidatePath('/admin/dashboard')
  return { success: true, projectId: project.id }
}

// M13: permanent cross-brand opt-out. Suppresses the lead's phone, email, and
// address globally — one opt-out honors everywhere — and closes the lead.
export async function markLeadDoNotContact(leadId: string) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: lead } = await adminClient
    .from('mk_leads')
    .select('id, phone, email, address')
    .eq('id', leadId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!lead) return { error: 'Lead not found.' }

  const base = {
    tenantId: tenant.id,
    scope: 'global' as const,
    kind: 'internal_opt_out' as const,
    reason: 'Requested no further contact',
    source: `lead:${leadId}`,
    createdBy: appUser.id,
  }
  if (lead.phone) await recordSuppression(adminClient, { ...base, contactType: 'phone', contactValue: lead.phone })
  if (lead.email) await recordSuppression(adminClient, { ...base, contactType: 'email', contactValue: lead.email })
  if (lead.address) await recordSuppression(adminClient, { ...base, contactType: 'address', contactValue: lead.address })

  await adminClient.from('mk_leads').update({ status: 'lost' }).eq('id', leadId).eq('tenant_id', tenant.id)
  await adminClient.from('mk_lead_events').insert({
    tenant_id: tenant.id,
    lead_id: leadId,
    event_type: 'do_not_contact',
    detail: 'Opted out — phone/email/address suppressed across all brands',
    created_by: appUser.id,
  })

  revalidatePath('/admin/leads')
  return { success: true }
}

export async function createLeadSource(formData: FormData) {
  const { tenant } = await getCurrentUser()
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Source name is required.' }
  const kindRaw = formData.get('kind') as string
  const kind = ['website_form', 'meta_lead_form', 'google_lead_form', 'webhook'].includes(kindRaw)
    ? kindRaw
    : 'webhook'

  const { randomUUID } = await import('crypto')
  const token = `src_${randomUUID().replace(/-/g, '')}`

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('mk_lead_sources').insert({
    tenant_id: tenant.id,
    name: name.slice(0, 150),
    kind,
    token,
  })
  if (error) return { error: 'Failed to create source.' }

  revalidatePath('/admin/leads')
  return { success: true }
}

export async function toggleLeadSource(sourceId: string, status: 'active' | 'paused') {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()
  const { data: rows, error } = await adminClient
    .from('mk_lead_sources')
    .update({ status })
    .eq('id', sourceId)
    .eq('tenant_id', tenant.id)
    .select('id')
  if (error || !rows?.length) return { error: 'Failed to update source.' }
  revalidatePath('/admin/leads')
  return { success: true }
}

export async function createCampaign(formData: FormData) {
  const { tenant } = await getCurrentUser()

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Campaign name is required.' }

  const channelRaw = formData.get('channel') as string
  const channel = ['meta', 'google', 'other'].includes(channelRaw) ? channelRaw : 'other'

  const budgetRaw = formData.get('monthly_budget') as string
  const budget = budgetRaw ? parseFloat(budgetRaw) : null
  if (budget !== null && (isNaN(budget) || budget < 0)) {
    return { error: 'Monthly budget must be a positive number.' }
  }

  const utmCampaign = (formData.get('utm_campaign') as string)?.trim() || null

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('mk_campaigns').insert({
    tenant_id: tenant.id,
    name: name.slice(0, 200),
    channel,
    status: 'active',
    monthly_budget: budget,
    utm_campaign: utmCampaign,
  })

  if (error) return { error: 'Failed to create campaign.' }

  revalidatePath('/admin/leads')
  return { success: true }
}

export async function updateCampaignSpend(campaignId: string, spendToDate: number) {
  if (isNaN(spendToDate) || spendToDate < 0) return { error: 'Spend must be a positive number.' }
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: rows, error } = await adminClient
    .from('mk_campaigns')
    .update({ spend_to_date: spendToDate })
    .eq('id', campaignId)
    .eq('tenant_id', tenant.id)
    .select('id')

  if (error || !rows || rows.length === 0) return { error: 'Failed to update spend.' }

  revalidatePath('/admin/leads')
  return { success: true }
}

export async function updateCampaignStatus(campaignId: string, status: string) {
  if (!['draft', 'active', 'paused', 'ended'].includes(status)) return { error: 'Invalid status.' }
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: rows, error } = await adminClient
    .from('mk_campaigns')
    .update({ status })
    .eq('id', campaignId)
    .eq('tenant_id', tenant.id)
    .select('id')

  if (error || !rows || rows.length === 0) return { error: 'Failed to update campaign.' }

  revalidatePath('/admin/leads')
  return { success: true }
}
