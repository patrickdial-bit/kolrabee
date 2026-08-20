'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createBidRequest(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const title = (formData.get('title') as string)?.trim()
  if (!title) {
    return { error: 'Title is required.' }
  }

  const num = (name: string) => {
    const v = (formData.get(name) as string)?.trim()
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const str = (name: string) => (formData.get(name) as string)?.trim() || null

  const { data: request, error } = await adminClient
    .from('bid_requests')
    .insert({
      tenant_id: tenant.id,
      title,
      site_address: str('site_address'),
      trade: str('trade'),
      scope_narrative: str('scope_narrative'),
      bids_due_at: str('bids_due_at'),
      target_start: str('target_start'),
      target_end: str('target_end'),
      visibility_mode: str('visibility_mode') ?? 'blind',
      internal_budget: num('internal_budget'),
      customer_price: num('customer_price'),
      created_by: appUser.id,
    })
    .select('id')
    .single()

  if (error || !request) {
    return { error: 'Failed to create bid request.' }
  }

  await adminClient.from('bid_events').insert({
    tenant_id: tenant.id,
    bid_request_id: request.id,
    actor_type: 'admin',
    actor_id: appUser.id,
    event_type: 'request_created',
    payload: { title },
  })

  revalidatePath('/admin/bids')
  redirect(`/admin/bids/${request.id}`)
}
