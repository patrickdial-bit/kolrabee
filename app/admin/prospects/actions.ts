'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreProspect, scoreLead } from '@/lib/marketing'
import { normalizeAddress, recordSuppression } from '@/lib/compliance'

const MAX_IMPORT_ROWS = 2000

// Fuzzy header matching for county auditor CSV exports — column names vary by
// county, so map by keyword instead of position.
function headerIndex(headers: string[], ...keywords: string[]): number {
  return headers.findIndex((h) => keywords.some((k) => h.includes(k)))
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

function num(value: string | undefined): number | null {
  if (!value) return null
  const n = parseFloat(value.replace(/[$,\s]/g, ''))
  return isNaN(n) ? null : n
}

function bool(value: string | undefined): boolean | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  if (['y', 'yes', 'true', '1', 'owner', 'owner occupied', 'o'].includes(v)) return true
  if (['n', 'no', 'false', '0'].includes(v)) return false
  return null
}

// Import county auditor/assessor parcel data (public record — the only
// approved cold prospect source). Every field carries provenance; addresses
// already suppressed (opt-out/do-not-mail) import as suppressed.
export async function importProspectsCsv(csvText: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { error: 'Paste a CSV with a header row and at least one data row.' }
  if (lines.length - 1 > MAX_IMPORT_ROWS) {
    return { error: `Import capped at ${MAX_IMPORT_ROWS} rows per batch — split the file.` }
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const idx = {
    parcel: headerIndex(headers, 'parcel', 'apn'),
    address: headerIndex(headers, 'site address', 'property address', 'address', 'situs'),
    city: headerIndex(headers, 'city'),
    state: headerIndex(headers, 'state'),
    zip: headerIndex(headers, 'zip'),
    owner: headerIndex(headers, 'owner'),
    ownerOcc: headerIndex(headers, 'occupied', 'homestead', 'owner occ'),
    yearBuilt: headerIndex(headers, 'year built', 'yr built', 'yearbuilt'),
    sqft: headerIndex(headers, 'sq ft', 'sqft', 'square'),
    acres: headerIndex(headers, 'acre'),
    saleDate: headerIndex(headers, 'sale date', 'transfer date'),
    salePrice: headerIndex(headers, 'sale price', 'sale amount', 'transfer price'),
    assessed: headerIndex(headers, 'assessed', 'appraised', 'market value'),
  }
  if (idx.address < 0) return { error: 'Could not find an address column in the CSV header.' }

  // Pre-load suppressed addresses so imports honor prior opt-outs.
  const { data: suppressedRows } = await adminClient
    .from('mk_suppression')
    .select('contact_value, suppression_scope, tenant_id')
    .eq('contact_type', 'address')
  const suppressedSet = new Set(
    (suppressedRows ?? [])
      .filter((r) => r.suppression_scope === 'global' || r.tenant_id === tenant.id)
      .map((r) => r.contact_value)
  )

  const importedAt = new Date().toISOString()
  let imported = 0
  let suppressedCount = 0
  let skipped = 0

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line)
    const get = (i: number) => (i >= 0 ? cols[i]?.trim() || undefined : undefined)
    const address = get(idx.address)
    if (!address) { skipped++; continue }

    const record = {
      owner_occupied: bool(get(idx.ownerOcc)),
      year_built: num(get(idx.yearBuilt)) ? Math.round(num(get(idx.yearBuilt))!) : null,
      assessed_value: num(get(idx.assessed)),
      lot_acres: num(get(idx.acres)),
      last_sale_date: get(idx.saleDate) ? new Date(get(idx.saleDate)!).toISOString().slice(0, 10) : null,
    }
    if (record.last_sale_date === 'Invalid Date' || (record.last_sale_date && isNaN(Date.parse(record.last_sale_date)))) {
      record.last_sale_date = null
    }
    const { score, reasons } = scoreProspect(record)
    const isSuppressed = suppressedSet.has(normalizeAddress(address))
    if (isSuppressed) suppressedCount++

    const provenance = Object.fromEntries(
      ['address', 'owner_name', 'owner_occupied', 'year_built', 'assessed_value', 'lot_acres', 'last_sale_date'].map(
        (f) => [f, { source_key: 'county_parcel', imported_at: importedAt }]
      )
    )

    const { error } = await adminClient.from('mk_prospects').upsert(
      {
        tenant_id: tenant.id,
        parcel_id: get(idx.parcel) ?? null,
        address,
        city: get(idx.city) ?? null,
        state: get(idx.state) ?? null,
        zip: get(idx.zip) ?? null,
        owner_name: get(idx.owner) ?? null,
        owner_occupied: record.owner_occupied,
        year_built: record.year_built,
        sqft: num(get(idx.sqft)) ? Math.round(num(get(idx.sqft))!) : null,
        lot_acres: record.lot_acres,
        last_sale_date: record.last_sale_date,
        last_sale_price: num(get(idx.salePrice)),
        assessed_value: record.assessed_value,
        provenance,
        score,
        score_reasons: reasons,
        suppressed: isSuppressed,
      },
      { onConflict: get(idx.parcel) ? 'tenant_id,parcel_id' : undefined, ignoreDuplicates: false }
    )
    if (error) skipped++
    else imported++
  }

  await adminClient.from('mk_usage_events').insert({
    tenant_id: tenant.id,
    event_type: 'prospect_import',
    quantity: imported,
    ref: 'county_parcel csv',
  })

  revalidatePath('/admin/prospects')
  return { success: true, imported, suppressed: suppressedCount, skipped }
}

// Prospect → lead: enters the standard M4 pipeline (scored, then convertible
// to a job like any other lead).
export async function convertProspectToLead(prospectId: string) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: prospect } = await adminClient
    .from('mk_prospects')
    .select('*')
    .eq('id', prospectId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!prospect) return { error: 'Prospect not found.' }
  if (prospect.suppressed) return { error: 'This address is suppressed — it cannot be contacted.' }
  if (prospect.lead_id) return { error: 'Already converted to a lead.' }

  const nameParts = (prospect.owner_name ?? '').split(/\s+/)
  const fullAddress = [prospect.address, prospect.city, prospect.state, prospect.zip].filter(Boolean).join(', ')
  const { score, reasons } = scoreLead({ address: fullAddress, isRepeatCustomer: false })

  const { data: lead, error } = await adminClient
    .from('mk_leads')
    .insert({
      tenant_id: tenant.id,
      source: 'manual',
      first_name: nameParts[0] || null,
      last_name: nameParts.slice(1).join(' ') || null,
      address: fullAddress,
      message: `Created from Prospector parcel ${prospect.parcel_id ?? '(no parcel id)'}.`,
      score,
      score_reasons: reasons,
      status: 'new',
    })
    .select('id')
    .single()
  if (error || !lead) return { error: 'Failed to create lead.' }

  await adminClient.from('mk_lead_events').insert({
    tenant_id: tenant.id,
    lead_id: lead.id,
    event_type: 'created',
    detail: 'Created from Prospector (county parcel data)',
    created_by: appUser.id,
  })
  await adminClient
    .from('mk_prospects')
    .update({ status: 'converted', lead_id: lead.id })
    .eq('id', prospectId)

  revalidatePath('/admin/prospects')
  revalidatePath('/admin/leads')
  return { success: true }
}

// Deletion request: remove the record entirely and suppress the address so a
// future import can never resurrect it.
export async function deleteProspectData(prospectId: string) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: prospect } = await adminClient
    .from('mk_prospects')
    .select('id, address, city, state, zip')
    .eq('id', prospectId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!prospect) return { error: 'Prospect not found.' }

  await recordSuppression(adminClient, {
    tenantId: tenant.id,
    scope: 'global',
    kind: 'do_not_mail',
    contactType: 'address',
    contactValue: prospect.address,
    reason: 'Data deletion request',
    source: `prospect:${prospectId}`,
    createdBy: appUser.id,
  })
  await adminClient.from('mk_prospects').delete().eq('id', prospectId).eq('tenant_id', tenant.id)

  revalidatePath('/admin/prospects')
  return { success: true }
}
