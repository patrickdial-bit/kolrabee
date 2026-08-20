// Scope import core — shared by the server action and the API route
// (POST /api/bid-requests/:id/scope/import). Spec: docs/bid-board-spec.md
// "Integration point": groups + items are imported from the scoping system;
// source_ref at both levels lets re-import update in place rather than
// duplicating. Re-import after bids exist is blocked.

import type { SupabaseClient } from '@supabase/supabase-js'
import { runGate1, type Gate1Error, type ImportGroup } from './gate1'

export type ImportResult =
  | { ok: true; groupsUpserted: number; itemsUpserted: number }
  | { ok: false; status: number; error: string; gate1?: Gate1Error[] }

export function parseImportPayload(body: unknown): { groups: ImportGroup[] } | { error: string } {
  if (typeof body !== 'object' || body === null || !Array.isArray((body as any).groups)) {
    return { error: 'Payload must be an object with a "groups" array.' }
  }
  const groups = (body as any).groups as ImportGroup[]
  for (const g of groups) {
    if (!g || typeof g.label !== 'string' || typeof g.group_type !== 'string') {
      return { error: 'Every group needs at least "label" and "group_type".' }
    }
    if (!Array.isArray(g.items)) g.items = []
  }
  return { groups }
}

export async function importScopeCore(
  adminClient: SupabaseClient,
  tenantId: string,
  actorUserId: string,
  bidRequestId: string,
  groups: ImportGroup[]
): Promise<ImportResult> {
  const { data: request } = await adminClient
    .from('bid_requests')
    .select('id, status')
    .eq('id', bidRequestId)
    .eq('tenant_id', tenantId)
    .single()
  if (!request) return { ok: false, status: 404, error: 'Bid request not found.' }

  // Silently changing scope under a live bid is how you get sued.
  if (request.status !== 'draft') {
    return {
      ok: false,
      status: 409,
      error: `Scope is frozen: request status is "${request.status}". Open a new bid round (addendum) to change scope.`,
    }
  }

  // Gate 1 — hard blocks, reject the payload outright.
  const gate1 = runGate1(groups)
  if (gate1.length > 0) {
    return { ok: false, status: 422, error: 'Gate 1 validation failed.', gate1 }
  }

  // Existing groups by source_ref for update-in-place.
  const { data: existingGroups } = await adminClient
    .from('bid_scope_groups')
    .select('id, source_ref')
    .eq('bid_request_id', bidRequestId)
  const existingByRef = new Map<string, string>(
    (existingGroups ?? []).filter((g) => g.source_ref).map((g) => [g.source_ref as string, g.id])
  )

  // Pass 1: upsert groups without parents (parents wired in pass 2 so ordering
  // in the payload never matters).
  const idByRef = new Map<string, string>()
  let groupsUpserted = 0
  let itemsUpserted = 0

  for (let idx = 0; idx < groups.length; idx++) {
    const g = groups[idx]
    const fields = {
      group_type: g.group_type,
      label: g.label,
      ordinal: g.ordinal ?? null,
      scope_code: g.scope_code ?? null,
      description: g.description ?? null,
      sort_order: g.sort_order ?? idx,
      source_ref: g.source_ref ?? null,
    }
    const existingId = g.source_ref ? existingByRef.get(g.source_ref) : undefined
    if (existingId) {
      const { error } = await adminClient
        .from('bid_scope_groups')
        .update(fields)
        .eq('id', existingId)
      if (error) return { ok: false, status: 500, error: `Failed updating group "${g.label}": ${error.message}` }
      if (g.source_ref) idByRef.set(g.source_ref, existingId)
      groupsUpserted++
    } else {
      const { data: inserted, error } = await adminClient
        .from('bid_scope_groups')
        .insert({ ...fields, bid_request_id: bidRequestId, tenant_id: tenantId, created_by: actorUserId })
        .select('id')
        .single()
      if (error || !inserted) return { ok: false, status: 500, error: `Failed inserting group "${g.label}": ${error?.message}` }
      if (g.source_ref) idByRef.set(g.source_ref, inserted.id)
      groupsUpserted++
    }
  }

  // Pass 2: wire parents (DB trigger re-checks the hierarchy rules).
  for (const g of groups) {
    if (!g.source_ref) continue
    const selfId = idByRef.get(g.source_ref)
    if (!selfId) continue
    const parentId = g.parent_source_ref ? idByRef.get(g.parent_source_ref) ?? null : null
    const { error } = await adminClient
      .from('bid_scope_groups')
      .update({ parent_group_id: parentId })
      .eq('id', selfId)
    if (error) return { ok: false, status: 500, error: `Failed wiring parent for "${g.label}": ${error.message}` }
  }

  // Items: update-in-place by source_ref, insert otherwise.
  const { data: existingItems } = await adminClient
    .from('bid_scope_items')
    .select('id, source_ref')
    .eq('bid_request_id', bidRequestId)
  const existingItemByRef = new Map<string, string>(
    (existingItems ?? []).filter((i) => i.source_ref).map((i) => [i.source_ref as string, i.id])
  )

  for (const g of groups) {
    const groupId = g.source_ref ? idByRef.get(g.source_ref) : undefined
    if (!groupId) continue
    for (let idx = 0; idx < g.items.length; idx++) {
      const item = g.items[idx]
      const fields = {
        description: item.description,
        qty: item.qty,
        uom: item.uom,
        notes: item.notes ?? null,
        sort_order: item.sort_order ?? idx,
        source_ref: item.source_ref ?? null,
      }
      const existingId = item.source_ref ? existingItemByRef.get(item.source_ref) : undefined
      if (existingId) {
        const { error } = await adminClient
          .from('bid_scope_items')
          .update({ ...fields, bid_scope_group_id: groupId })
          .eq('id', existingId)
        if (error) return { ok: false, status: 500, error: `Failed updating item "${item.description}": ${error.message}` }
      } else {
        const { error } = await adminClient.from('bid_scope_items').insert({
          ...fields,
          bid_scope_group_id: groupId,
          bid_request_id: bidRequestId,
          tenant_id: tenantId,
          created_by: actorUserId,
        })
        if (error) return { ok: false, status: 500, error: `Failed inserting item "${item.description}": ${error.message}` }
      }
      itemsUpserted++
    }
  }

  await adminClient.from('bid_events').insert({
    tenant_id: tenantId,
    bid_request_id: bidRequestId,
    actor_type: 'admin',
    actor_id: actorUserId,
    event_type: 'scope_imported',
    payload: { groups: groupsUpserted, items: itemsUpserted },
  })

  return { ok: true, groupsUpserted, itemsUpserted }
}
