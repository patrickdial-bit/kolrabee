import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdminApi, AdsAccessError } from '@/lib/ads/access'

// List every tenant alongside its Ads Agent add-on state (super-admin only).
export async function GET() {
  try {
    await requireSuperAdminApi()
    const adminClient = createAdminClient()

    const { data: tenants } = await adminClient
      .from('tenants')
      .select('id, name, slug')
      .order('name', { ascending: true })

    const { data: settings } = await adminClient.from('ad_addon_settings').select('*')
    const byTenant = new Map((settings ?? []).map((s: any) => [s.tenant_id, s]))

    const rows = (tenants ?? []).map((t: any) => ({
      tenant_id: t.id,
      tenant_name: t.name,
      tenant_slug: t.slug,
      settings: byTenant.get(t.id) ?? null,
    }))

    return NextResponse.json({ addons: rows })
  } catch (err) {
    if (err instanceof AdsAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
