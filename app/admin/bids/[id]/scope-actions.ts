'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseScopeCode, checkDepthBalance } from '@/lib/bid-board/scope-code'
import { validateItem } from '@/lib/bid-board/gate1'
import { importScopeCore, parseImportPayload } from '@/lib/bid-board/import'
import type { GroupType, Uom } from '@/lib/bid-board/types'

async function getDraftRequest(bidRequestId: string) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()
  const { data: request } = await adminClient
    .from('bid_requests')
    .select('id, status')
    .eq('id', bidRequestId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!request) return { error: 'Bid request not found.' as string }
  if (request.status !== 'draft') {
    return { error: 'Scope is frozen once bidding opens — changes require an addendum.' as string }
  }
  return { appUser, tenant, adminClient, request }
}

function validateScopeCode(code: string | null): string | null {
  if (!code?.trim()) return null
  const parsed = parseScopeCode(code)
  if (!parsed.ok) return `Scope code: ${parsed.error}`
  const balance = checkDepthBalance(parsed)
  if (!balance.balanced) {
    return `Scope code depth mismatch: excavation ${balance.excavationDepth}" vs replacement layers ${balance.replacementSum}". These must match.`
  }
  return null
}

export async function addScopeGroup(
  bidRequestId: string,
  fields: {
    group_type: GroupType
    label: string
    ordinal: number | null
    parent_group_id: string | null
    scope_code: string | null
    description: string | null
  }
) {
  const ctx = await getDraftRequest(bidRequestId)
  if ('error' in ctx) return { error: ctx.error }
  const { appUser, tenant, adminClient } = ctx

  if (!fields.label.trim()) return { error: 'Label is required.' }
  const codeError = validateScopeCode(fields.scope_code)
  if (codeError) return { error: codeError }

  const { count } = await adminClient
    .from('bid_scope_groups')
    .select('*', { count: 'exact', head: true })
    .eq('bid_request_id', bidRequestId)

  const { error } = await adminClient.from('bid_scope_groups').insert({
    bid_request_id: bidRequestId,
    tenant_id: tenant.id,
    group_type: fields.group_type,
    label: fields.label.trim(),
    ordinal: fields.ordinal,
    parent_group_id: fields.parent_group_id,
    scope_code: fields.scope_code?.trim() || null,
    description: fields.description?.trim() || null,
    sort_order: count ?? 0,
    created_by: appUser.id,
  })
  if (error) {
    // Surface DB hierarchy violations legibly (trigger/constraint messages).
    return { error: friendlyDbError(error.message) }
  }

  await logScopeEvent(adminClient, tenant.id, bidRequestId, appUser.id, 'group_added', fields.label)
  revalidatePath(`/admin/bids/${bidRequestId}`)
  return { success: true }
}

export async function deleteScopeGroup(bidRequestId: string, groupId: string) {
  const ctx = await getDraftRequest(bidRequestId)
  if ('error' in ctx) return { error: ctx.error }
  const { appUser, tenant, adminClient } = ctx

  const { error } = await adminClient
    .from('bid_scope_groups')
    .delete()
    .eq('id', groupId)
    .eq('tenant_id', tenant.id)
  if (error) return { error: friendlyDbError(error.message) }

  await logScopeEvent(adminClient, tenant.id, bidRequestId, appUser.id, 'group_removed', groupId)
  revalidatePath(`/admin/bids/${bidRequestId}`)
  return { success: true }
}

export async function addScopeItem(
  bidRequestId: string,
  groupId: string,
  fields: { description: string; qty: number | null; uom: Uom | null; notes: string | null }
) {
  const ctx = await getDraftRequest(bidRequestId)
  if ('error' in ctx) return { error: ctx.error }
  const { appUser, tenant, adminClient } = ctx

  // Gate 1 rules apply to manual entry exactly as they do to import.
  const errs = validateItem(fields)
  if (errs.length > 0) return { error: errs.join(' ') }

  const { count } = await adminClient
    .from('bid_scope_items')
    .select('*', { count: 'exact', head: true })
    .eq('bid_scope_group_id', groupId)

  const { error } = await adminClient.from('bid_scope_items').insert({
    bid_scope_group_id: groupId,
    bid_request_id: bidRequestId,
    tenant_id: tenant.id,
    description: fields.description.trim(),
    qty: fields.qty,
    uom: fields.uom,
    notes: fields.notes?.trim() || null,
    sort_order: count ?? 0,
    created_by: appUser.id,
  })
  if (error) return { error: friendlyDbError(error.message) }

  await logScopeEvent(adminClient, tenant.id, bidRequestId, appUser.id, 'item_added', fields.description)
  revalidatePath(`/admin/bids/${bidRequestId}`)
  return { success: true }
}

export async function deleteScopeItem(bidRequestId: string, itemId: string) {
  const ctx = await getDraftRequest(bidRequestId)
  if ('error' in ctx) return { error: ctx.error }
  const { appUser, tenant, adminClient } = ctx

  const { error } = await adminClient
    .from('bid_scope_items')
    .delete()
    .eq('id', itemId)
    .eq('tenant_id', tenant.id)
  if (error) return { error: friendlyDbError(error.message) }

  await logScopeEvent(adminClient, tenant.id, bidRequestId, appUser.id, 'item_removed', itemId)
  revalidatePath(`/admin/bids/${bidRequestId}`)
  return { success: true }
}

export async function importScope(bidRequestId: string, payloadJson: string) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  let body: unknown
  try {
    body = JSON.parse(payloadJson)
  } catch {
    return { error: 'Invalid JSON.' }
  }
  const parsed = parseImportPayload(body)
  if ('error' in parsed) return { error: parsed.error }

  const result = await importScopeCore(adminClient, tenant.id, appUser.id, bidRequestId, parsed.groups)
  if (!result.ok) {
    return {
      error: result.error,
      gate1: result.gate1?.map((e) => `${e.group ? `[${e.group}] ` : ''}${e.item ? `${e.item}: ` : ''}${e.message}`),
    }
  }

  revalidatePath(`/admin/bids/${bidRequestId}`)
  return { success: true, groups: result.groupsUpserted, items: result.itemsUpserted }
}

function friendlyDbError(message: string): string {
  if (message.includes('idx_bid_scope_groups_one_base_bid')) {
    return 'This request already has a base bid group — there can be only one.'
  }
  if (message.includes('bid_scope_groups_parent_presence')) {
    return 'Base bids and options stand alone; add items and add options require a parent group.'
  }
  return message
}

async function logScopeEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  tenantId: string,
  bidRequestId: string,
  actorId: string,
  action: string,
  detail: string
) {
  await adminClient.from('bid_events').insert({
    tenant_id: tenantId,
    bid_request_id: bidRequestId,
    actor_type: 'admin',
    actor_id: actorId,
    event_type: 'scope_updated',
    payload: { action, detail },
  })
}
