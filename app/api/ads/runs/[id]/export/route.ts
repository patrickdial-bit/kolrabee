import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdsTenant, AdsAccessError } from '@/lib/ads/access'
import { logAuditEvent } from '@/lib/ads/audit'
import { buildExportZip } from '@/lib/ads/export'
import { uploadAsset, storagePaths } from '@/lib/ads/storage'
import type { AdBrandKit, AdConcept, AdGenerationRun } from '@/lib/types'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenant, appUser } = await requireAdsTenant({ adminOnly: true })
    const adminClient = createAdminClient()

    const { data: run } = await adminClient
      .from('ad_generation_runs')
      .select('*')
      .eq('id', params.id)
      .eq('tenant_id', tenant.id)
      .maybeSingle()
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

    const { data: approved } = await adminClient
      .from('ad_concepts')
      .select('*')
      .eq('run_id', params.id)
      .eq('tenant_id', tenant.id)
      .eq('status', 'approved')
      .order('variant_index', { ascending: true })

    if (!approved || approved.length === 0) {
      return NextResponse.json({ error: 'No approved concepts to export.' }, { status: 400 })
    }

    const { data: brandKit } = await adminClient
      .from('ad_brand_kits')
      .select('*')
      .eq('id', (run as AdGenerationRun).brand_kit_id ?? '')
      .maybeSingle()

    // Point each concept at its storage path so the ZIP builder downloads the
    // canonical PNG (not a possibly-expired signed URL).
    const conceptsForZip = (approved as AdConcept[]).map((c) => ({
      ...c,
      image_url: storagePaths.conceptImage(tenant.id, params.id, c.id),
    }))

    const zip = await buildExportZip({
      run: run as AdGenerationRun,
      brandKit: (brandKit as AdBrandKit) ?? null,
      concepts: conceptsForZip,
    })

    // Persist to Storage for audit / re-download (best-effort).
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    try {
      await uploadAsset(storagePaths.export(tenant.id, params.id, timestamp), zip, 'application/zip')
    } catch (err) {
      console.error('export archive save failed', err)
    }

    await adminClient
      .from('ad_generation_runs')
      .update({ concepts_exported: approved.length })
      .eq('id', params.id)

    await logAuditEvent({
      tenantId: tenant.id,
      userId: appUser.id,
      action: 'run.export',
      entityId: params.id,
      metadata: { concept_count: approved.length },
    })

    const filename = `kolrabee-ads-${params.id.slice(0, 8)}-${timestamp}.zip`
    return new NextResponse(zip as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zip.length),
      },
    })
  } catch (err) {
    if (err instanceof AdsAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
