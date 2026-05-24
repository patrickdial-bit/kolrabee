import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdsTenant, AdsAccessError } from '@/lib/ads/access'
import { logAuditEvent } from '@/lib/ads/audit'
import { runAdsPipeline } from '@/lib/ads/orchestrator'

const ACTIVE_STATUSES = ['queued', 'scraping', 'synthesizing', 'generating_images', 'writing_copy']

function handleError(err: unknown) {
  if (err instanceof AdsAccessError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error(err)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}

export async function GET() {
  try {
    const { tenant } = await requireAdsTenant()
    const adminClient = createAdminClient()
    const { data: runs } = await adminClient
      .from('ad_generation_runs')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    return NextResponse.json({ runs: runs ?? [] })
  } catch (err) {
    return handleError(err)
  }
}

export async function POST() {
  try {
    const { tenant, appUser, settings } = await requireAdsTenant({ adminOnly: true })
    const adminClient = createAdminClient()

    // Monthly run cap (spec §3).
    if (settings.runs_this_month >= settings.monthly_run_limit) {
      return NextResponse.json(
        { error: `Monthly run limit reached (${settings.monthly_run_limit}).` },
        { status: 429 }
      )
    }

    // One in-flight run per tenant (spec §9).
    const { data: active } = await adminClient
      .from('ad_generation_runs')
      .select('id')
      .eq('tenant_id', tenant.id)
      .in('status', ACTIVE_STATUSES)
      .limit(1)
    if (active && active.length > 0) {
      return NextResponse.json({ error: 'A generation run is already in progress.' }, { status: 409 })
    }

    // Brand kit must exist and be minimally configured.
    const { data: brandKit } = await adminClient
      .from('ad_brand_kits')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle()
    if (!brandKit || !brandKit.brand_name) {
      return NextResponse.json({ error: 'Complete your brand kit before generating.' }, { status: 400 })
    }

    const { data: run, error } = await adminClient
      .from('ad_generation_runs')
      .insert({
        tenant_id: tenant.id,
        brand_kit_id: brandKit.id,
        status: 'queued',
        triggered_by: appUser.id,
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single()
    if (error || !run) {
      // Unique partial index collision => another run snuck in.
      return NextResponse.json({ error: 'Could not start a run. One may already be active.' }, { status: 409 })
    }

    await adminClient
      .from('ad_addon_settings')
      .update({ runs_this_month: settings.runs_this_month + 1 })
      .eq('id', settings.id)

    await logAuditEvent({
      tenantId: tenant.id,
      userId: appUser.id,
      action: 'run.create',
      entityId: run.id,
    })

    // Fire-and-forget: the pipeline persists status as it progresses; the UI polls
    // GET /api/ads/runs/:id. (v2: move to a Supabase Edge Function / queue.)
    void runAdsPipeline({ id: run.id, tenant_id: tenant.id, brand_kit_id: brandKit.id })

    return NextResponse.json({ run }, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
