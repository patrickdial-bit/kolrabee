import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendLeadNotificationEmail } from '@/lib/email'
import { scoreLead } from '@/lib/marketing'
import { recordConsent } from '@/lib/compliance'
import { getNotificationPrefs, MK_LEAD_SOURCE_LABELS, type MkLeadSource } from '@/lib/types'

// Public lead-capture endpoint (marketing engine M4). Accepts submissions from
// landing pages, embedded website forms, or bridge tools (e.g. Zapier relaying
// Meta lead forms) until the native Meta webhook lands.
//
// POST /api/leads
// {
//   tenant:   "painter1-vf1e",          // tenant slug — required
//   first_name / last_name | name,      // at least a name
//   email | phone,                      // at least one contact method
//   address?, service?, message?,
//   fbclid?, gclid?,                    // click IDs → attribution chain
//   utm_source?, utm_medium?, utm_campaign?,
//   source?,                            // one of the mk_leads sources
//   company_website?                    // honeypot — must be empty
// }

export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function str(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

const VALID_SOURCES: MkLeadSource[] = [
  'landing_form', 'meta_lead_form', 'google', 'sms', 'call', 'chat', 'referral', 'manual',
]

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: CORS_HEADERS })
  }

  // Honeypot: bots fill every field. Accept silently so they don't adapt.
  if (str(body.company_website)) {
    return NextResponse.json({ success: true }, { headers: CORS_HEADERS })
  }

  // Preferred: a source token identifies tenant + source without exposing the
  // tenant slug. Fallback: explicit tenant slug (legacy/manual integrations).
  const sourceToken = str(body.source_token, 80)
  const slug = str(body.tenant, 100)
  if (!sourceToken && !slug) {
    return NextResponse.json({ error: 'source_token or tenant is required.' }, { status: 400, headers: CORS_HEADERS })
  }

  // Support either a single "name" or first/last.
  let firstName = str(body.first_name, 100)
  let lastName = str(body.last_name, 100)
  const fullName = str(body.name, 200)
  if (!firstName && fullName) {
    const parts = fullName.split(/\s+/)
    firstName = parts[0] ?? null
    lastName = parts.slice(1).join(' ') || null
  }

  const email = str(body.email, 255)
  const phone = str(body.phone, 30)

  if (!firstName && !email && !phone) {
    return NextResponse.json(
      { error: 'A name and at least one contact method (email or phone) are required.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }
  if (!email && !phone) {
    return NextResponse.json(
      { error: 'At least one contact method (email or phone) is required.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const adminClient = createAdminClient()

  // Resolve the tenant via source token (preferred) or slug.
  let sourceId: string | null = null
  let sourceKind: string | null = null
  let tenant: { id: string; name: string; slug: string; notification_email: string | null; status: string } | null = null

  if (sourceToken) {
    const { data: src } = await adminClient
      .from('mk_lead_sources')
      .select('id, kind, status, tenant:tenant_id (id, name, slug, notification_email, status, marketing_enabled)')
      .eq('token', sourceToken)
      .maybeSingle()
    if (!src || src.status !== 'active') {
      return NextResponse.json({ error: 'Unknown or paused source.' }, { status: 404, headers: CORS_HEADERS })
    }
    sourceId = src.id
    sourceKind = src.kind
    tenant = (src as any).tenant
  } else {
    const { data } = await adminClient
      .from('tenants')
      .select('id, name, slug, notification_email, status, marketing_enabled')
      .eq('slug', slug!)
      .single()
    tenant = data
  }

  if (!tenant || tenant.status !== 'active') {
    return NextResponse.json({ error: 'Unknown tenant.' }, { status: 404, headers: CORS_HEADERS })
  }
  if ((tenant as any).marketing_enabled !== true) {
    return NextResponse.json({ error: 'Marketing engine not enabled for this company.' }, { status: 403, headers: CORS_HEADERS })
  }

  const address = str(body.address, 300)
  const service = str(body.service ?? body.service_requested, 200)
  const message = str(body.message, 2000)
  const sourceRaw = str(body.source, 30) as MkLeadSource | null
  const kindToSource: Record<string, MkLeadSource> = {
    website_form: 'landing_form',
    meta_lead_form: 'meta_lead_form',
    google_lead_form: 'google',
    webhook: 'manual',
  }
  const source: MkLeadSource =
    (sourceKind && kindToSource[sourceKind]) ||
    (sourceRaw && VALID_SOURCES.includes(sourceRaw) ? sourceRaw : 'landing_form')
  const utmCampaign = str(body.utm_campaign, 200)

  // Repeat-customer signal: name appears in this tenant's job history.
  let isRepeatCustomer = false
  const nameForMatch = `${firstName ?? ''} ${lastName ?? ''}`.trim()
  if (nameForMatch.length > 3) {
    const { count } = await adminClient
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .ilike('customer_name', `%${nameForMatch}%`)
    isRepeatCustomer = (count ?? 0) > 0
  }

  const { score, reasons } = scoreLead({
    phone,
    email,
    address,
    service_requested: service,
    message,
    isRepeatCustomer,
  })

  // Auto-associate with a campaign when utm_campaign matches.
  let campaignId: string | null = null
  if (utmCampaign) {
    const { data: campaign } = await adminClient
      .from('mk_campaigns')
      .select('id')
      .eq('tenant_id', tenant.id)
      .ilike('utm_campaign', utmCampaign)
      .maybeSingle()
    campaignId = campaign?.id ?? null
  }

  const { data: lead, error } = await adminClient
    .from('mk_leads')
    .insert({
      tenant_id: tenant.id,
      campaign_id: campaignId,
      source,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address,
      service_requested: service,
      message,
      fbclid: str(body.fbclid, 500),
      gclid: str(body.gclid, 500),
      utm_source: str(body.utm_source, 200),
      utm_medium: str(body.utm_medium, 200),
      utm_campaign: utmCampaign,
      score,
      score_reasons: reasons,
      status: 'new',
      source_id: sourceId,
    })
    .select('id')
    .single()

  if (error || !lead) {
    console.error('[api/leads] insert failed:', error)
    return NextResponse.json({ error: 'Failed to save lead.' }, { status: 500, headers: CORS_HEADERS })
  }

  await adminClient.from('mk_lead_events').insert({
    tenant_id: tenant.id,
    lead_id: lead.id,
    event_type: 'created',
    detail: `Captured via ${MK_LEAD_SOURCE_LABELS[source]}${isRepeatCustomer ? ' · existing customer match' : ''}`,
  })

  // M13 consent capture: an inbound inquiry unlocks response contact on the
  // channels the homeowner volunteered. (Not express written consent — SMS
  // marketing stays locked unless the form explicitly collected it.)
  if (phone) {
    await recordConsent(adminClient, {
      tenantId: tenant.id,
      contactType: 'phone',
      contactValue: phone,
      consentType: 'inbound_inquiry',
      source: `lead:${lead.id} (${source})`,
    })
  }
  if (email) {
    await recordConsent(adminClient, {
      tenantId: tenant.id,
      contactType: 'email',
      contactValue: email,
      consentType: 'inbound_inquiry',
      source: `lead:${lead.id} (${source})`,
    })
  }

  // Speed-to-lead: notify every active admin right away (awaited so the
  // serverless function doesn't freeze before the emails go out).
  const { data: admins } = await adminClient
    .from('users')
    .select('email, notification_preferences')
    .eq('tenant_id', tenant.id)
    .eq('role', 'admin')
    .eq('status', 'active')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const leadName = nameForMatch || email || phone || 'Unknown'
  await Promise.all(
    (admins ?? [])
      .filter((admin) => getNotificationPrefs(admin).new_lead)
      .map((admin) =>
        sendLeadNotificationEmail({
          to: admin.email,
          tenantName: tenant.name,
          notificationEmail: tenant.notification_email,
          leadName,
          service,
          phone,
          email,
          sourceLabel: MK_LEAD_SOURCE_LABELS[source],
          score,
          leadUrl: `${siteUrl}/admin/leads`,
        })
      )
  )

  return NextResponse.json({ success: true, lead_id: lead.id }, { headers: CORS_HEADERS })
}
