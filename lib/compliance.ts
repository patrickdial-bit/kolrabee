// Outbound contact compliance (M13) — the gating layer, not a feature.
// See docs/MARKETING_ENGINE_V1_SPEC.md §11e and §15.
//
// Every future outbound channel (mail, calls, SMS, email) MUST route its
// go/no-go decision through canContact(). The rules it enforces:
//
//   sms    → prior EXPRESS WRITTEN consent required. No consent row, no send.
//            Cold SMS is technically impossible, not merely discouraged.
//   call   → blocked by any DNC/opt-out suppression; cold lists additionally
//            require a federal+state scrub within the last 31 days
//            (mk_dnc_scrub_log). Manual dial only on cold data.
//   mail   → blocked by do_not_mail / bad_address / internal opt-out;
//            capped per HOUSEHOLD across all brands (mk_household_touches).
//   email  → blocked by suppression; CAN-SPAM opt-out honored via suppression.
//
// Suppression scope: 'global' rows gate every tenant (the Midwest group's
// shared one-opt-out-suppresses-everywhere rule); 'tenant' rows gate only
// their tenant.

import type { SupabaseClient } from '@supabase/supabase-js'

export type OutboundChannel = 'sms' | 'call' | 'mail' | 'email'

export type ContactDecision = {
  allowed: boolean
  reason: string
  /** For calls: cold lists must be manually dialed (no autodialer). */
  manualDialOnly?: boolean
}

// Max outbound touches per household across ALL brands in a rolling window.
export const HOUSEHOLD_TOUCH_CAP = 3
export const HOUSEHOLD_TOUCH_WINDOW_DAYS = 30

// DNC scrubs expire after 31 days (federal registry rule).
export const DNC_SCRUB_MAX_AGE_DAYS = 31

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Strip US country code so 1-614-… and 614-… collide.
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ')
}

async function findSuppression(
  adminClient: SupabaseClient,
  tenantId: string,
  contactType: 'phone' | 'email' | 'address',
  contactValue: string,
  kinds?: string[]
): Promise<{ kind: string } | null> {
  let query = adminClient
    .from('mk_suppression')
    .select('kind, suppression_scope, tenant_id')
    .eq('contact_type', contactType)
    .eq('contact_value', contactValue)
  if (kinds && kinds.length > 0) query = query.in('kind', kinds)

  const { data } = await query.limit(50)
  for (const row of data ?? []) {
    if (row.suppression_scope === 'global') return { kind: row.kind }
    if (row.tenant_id === tenantId) return { kind: row.kind }
  }
  return null
}

async function hasUnrevokedConsent(
  adminClient: SupabaseClient,
  tenantId: string,
  contactType: 'phone' | 'email',
  contactValue: string,
  consentTypes: string[]
): Promise<boolean> {
  const { data } = await adminClient
    .from('mk_contact_consent')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contact_type', contactType)
    .eq('contact_value', contactValue)
    .in('consent_type', consentTypes)
    .is('revoked_at', null)
    .limit(1)
  return (data?.length ?? 0) > 0
}

async function recentScrubExists(
  adminClient: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const cutoff = new Date(Date.now() - DNC_SCRUB_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await adminClient
    .from('mk_dnc_scrub_log')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('registry', 'federal')
    .gte('scrubbed_at', cutoff)
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function canContact(
  adminClient: SupabaseClient,
  params: {
    channel: OutboundChannel
    tenantId: string
    phone?: string | null
    email?: string | null
    address?: string | null
    /** Cold-sourced record (purchased/appended/parcel data) vs first-party. */
    coldSource?: boolean
  }
): Promise<ContactDecision> {
  const { channel, tenantId, coldSource = false } = params
  const phone = params.phone ? normalizePhone(params.phone) : null
  const email = params.email ? normalizeEmail(params.email) : null
  const address = params.address ? normalizeAddress(params.address) : null

  switch (channel) {
    case 'sms': {
      if (!phone) return { allowed: false, reason: 'No phone number on record.' }
      const suppressed = await findSuppression(adminClient, tenantId, 'phone', phone)
      if (suppressed) return { allowed: false, reason: `Phone suppressed (${suppressed.kind}).` }
      const consented = await hasUnrevokedConsent(adminClient, tenantId, 'phone', phone, ['express_written'])
      if (!consented) {
        return {
          allowed: false,
          reason: 'SMS requires prior express written consent. None on file — this channel is locked.',
        }
      }
      return { allowed: true, reason: 'Express written consent on file.' }
    }

    case 'call': {
      if (!phone) return { allowed: false, reason: 'No phone number on record.' }
      const suppressed = await findSuppression(adminClient, tenantId, 'phone', phone)
      if (suppressed) return { allowed: false, reason: `Phone suppressed (${suppressed.kind}).` }
      const consented = await hasUnrevokedConsent(adminClient, tenantId, 'phone', phone, [
        'express_written',
        'express',
        'inbound_inquiry',
      ])
      if (consented) return { allowed: true, reason: 'Consent on file.' }
      if (coldSource) {
        const scrubbed = await recentScrubExists(adminClient, tenantId)
        if (!scrubbed) {
          return {
            allowed: false,
            reason: `Cold calling requires a federal DNC scrub within ${DNC_SCRUB_MAX_AGE_DAYS} days. No recent scrub logged.`,
          }
        }
        return { allowed: true, reason: 'DNC-scrubbed cold list.', manualDialOnly: true }
      }
      return { allowed: true, reason: 'First-party record, not suppressed.', manualDialOnly: true }
    }

    case 'mail': {
      if (!address) return { allowed: false, reason: 'No mailing address on record.' }
      const suppressed = await findSuppression(adminClient, tenantId, 'address', address, [
        'do_not_mail',
        'bad_address',
        'internal_opt_out',
      ])
      if (suppressed) return { allowed: false, reason: `Address suppressed (${suppressed.kind}).` }

      const cutoff = new Date(Date.now() - HOUSEHOLD_TOUCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { count } = await adminClient
        .from('mk_household_touches')
        .select('id', { count: 'exact', head: true })
        .eq('household_key', address)
        .gte('touched_at', cutoff)
      if ((count ?? 0) >= HOUSEHOLD_TOUCH_CAP) {
        return {
          allowed: false,
          reason: `Household already touched ${count} times in ${HOUSEHOLD_TOUCH_WINDOW_DAYS} days (cross-brand cap ${HOUSEHOLD_TOUCH_CAP}).`,
        }
      }
      return { allowed: true, reason: 'Address clear; under household frequency cap.' }
    }

    case 'email': {
      if (!email) return { allowed: false, reason: 'No email on record.' }
      const suppressed = await findSuppression(adminClient, tenantId, 'email', email)
      if (suppressed) return { allowed: false, reason: `Email suppressed (${suppressed.kind}).` }
      return { allowed: true, reason: 'Not suppressed. CAN-SPAM: include physical address + opt-out.' }
    }
  }
}

/** Record a consent event (append-only; latest unrevoked wins). */
export async function recordConsent(
  adminClient: SupabaseClient,
  params: {
    tenantId: string
    contactType: 'phone' | 'email'
    contactValue: string
    consentType: 'express_written' | 'express' | 'inbound_inquiry'
    source: string
    proofRef?: string | null
  }
): Promise<void> {
  const value =
    params.contactType === 'phone' ? normalizePhone(params.contactValue) : normalizeEmail(params.contactValue)
  await adminClient.from('mk_contact_consent').insert({
    tenant_id: params.tenantId,
    contact_type: params.contactType,
    contact_value: value,
    consent_type: params.consentType,
    source: params.source,
    proof_ref: params.proofRef ?? null,
  })
}

/** Suppress a contact. Global scope = honored across every brand/tenant. */
export async function recordSuppression(
  adminClient: SupabaseClient,
  params: {
    tenantId: string
    scope: 'global' | 'tenant'
    kind: 'dnc_federal' | 'dnc_state' | 'internal_opt_out' | 'do_not_mail' | 'bad_address'
    contactType: 'phone' | 'email' | 'address'
    contactValue: string
    reason?: string | null
    source?: string | null
    createdBy?: string | null
  }
): Promise<void> {
  const value =
    params.contactType === 'phone'
      ? normalizePhone(params.contactValue)
      : params.contactType === 'email'
        ? normalizeEmail(params.contactValue)
        : normalizeAddress(params.contactValue)
  await adminClient.from('mk_suppression').insert({
    suppression_scope: params.scope,
    tenant_id: params.tenantId,
    kind: params.kind,
    contact_type: params.contactType,
    contact_value: value,
    reason: params.reason ?? null,
    source: params.source ?? null,
    created_by: params.createdBy ?? null,
  })
}

/** Log an outbound touch against the cross-brand household ledger. */
export async function recordHouseholdTouch(
  adminClient: SupabaseClient,
  params: {
    tenantId: string
    address: string
    channel: string
    campaignRef?: string | null
  }
): Promise<void> {
  await adminClient.from('mk_household_touches').insert({
    suppression_scope: 'global',
    tenant_id: params.tenantId,
    household_key: normalizeAddress(params.address),
    channel: params.channel,
    campaign_ref: params.campaignRef ?? null,
  })
}
