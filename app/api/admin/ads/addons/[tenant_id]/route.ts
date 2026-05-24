import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdminApi, AdsAccessError } from '@/lib/ads/access'

// Toggle the add-on / set compliance status / adjust the monthly cap for a tenant.
export async function PATCH(req: NextRequest, { params }: { params: { tenant_id: string } }) {
  try {
    await requireSuperAdminApi()
    const body = await req.json()
    const adminClient = createAdminClient()

    const update: Record<string, unknown> = {}
    if (typeof body.enabled === 'boolean') {
      update.enabled = body.enabled
      update.enabled_at = body.enabled ? new Date().toISOString() : null
    }
    if (body.compliance_status === 'testing_only' || body.compliance_status === 'cleared_for_paid') {
      update.compliance_status = body.compliance_status
    }
    if (typeof body.monthly_run_limit === 'number' && body.monthly_run_limit >= 0) {
      update.monthly_run_limit = Math.floor(body.monthly_run_limit)
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    // Upsert: ensure a settings row exists for this tenant.
    const { data: existing } = await adminClient
      .from('ad_addon_settings')
      .select('id')
      .eq('tenant_id', params.tenant_id)
      .maybeSingle()

    let result
    if (existing) {
      result = await adminClient
        .from('ad_addon_settings')
        .update(update)
        .eq('id', existing.id)
        .select('*')
        .single()
    } else {
      result = await adminClient
        .from('ad_addon_settings')
        .insert({ tenant_id: params.tenant_id, ...update })
        .select('*')
        .single()
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })
    return NextResponse.json({ settings: result.data })
  } catch (err) {
    if (err instanceof AdsAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
