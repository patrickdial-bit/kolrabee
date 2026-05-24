import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdsTenant, AdsAccessError } from '@/lib/ads/access'
import { logAuditEvent } from '@/lib/ads/audit'
import type { AdBrandKit } from '@/lib/types'

function handleError(err: unknown) {
  if (err instanceof AdsAccessError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error(err)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}

async function getOrCreateBrandKit(tenantId: string): Promise<AdBrandKit> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('ad_brand_kits')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (data) return data as AdBrandKit
  const { data: created } = await adminClient
    .from('ad_brand_kits')
    .insert({ tenant_id: tenantId })
    .select('*')
    .single()
  return created as AdBrandKit
}

export async function GET() {
  try {
    const { tenant } = await requireAdsTenant({ adminOnly: true })
    const brandKit = await getOrCreateBrandKit(tenant.id)
    return NextResponse.json({ brandKit })
  } catch (err) {
    return handleError(err)
  }
}

const EDITABLE_FIELDS = [
  'brand_name',
  'service_line',
  'brand_website_url',
  'primary_color_hex',
  'secondary_color_hex',
  'accent_color_hex',
  'font_family',
  'brand_voice',
  'value_props',
  'target_geo',
  'target_audience',
  'seed_image_urls',
  'seed_image_sources',
  'logo_url',
  'competitor_page_urls',
] as const

export async function PUT(req: NextRequest) {
  try {
    const { tenant, appUser } = await requireAdsTenant({ adminOnly: true })
    const body = await req.json()

    const update: Record<string, unknown> = {}
    for (const field of EDITABLE_FIELDS) {
      if (field in body) update[field] = body[field]
    }

    const existing = await getOrCreateBrandKit(tenant.id)
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('ad_brand_kits')
      .update(update)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await logAuditEvent({
      tenantId: tenant.id,
      userId: appUser.id,
      action: 'brand_kit.update',
      entityId: existing.id,
    })

    return NextResponse.json({ brandKit: data })
  } catch (err) {
    return handleError(err)
  }
}
