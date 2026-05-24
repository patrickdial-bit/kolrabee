import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdsTenant, AdsAccessError } from '@/lib/ads/access'
import { signAsset, storagePaths } from '@/lib/ads/storage'
import type { AdConcept } from '@/lib/types'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenant } = await requireAdsTenant()
    const adminClient = createAdminClient()

    const { data: run } = await adminClient
      .from('ad_generation_runs')
      .select('id')
      .eq('id', params.id)
      .eq('tenant_id', tenant.id)
      .maybeSingle()
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

    const { data: concepts } = await adminClient
      .from('ad_concepts')
      .select('*')
      .eq('run_id', params.id)
      .eq('tenant_id', tenant.id)
      .order('variant_index', { ascending: true })
      .order('created_at', { ascending: true })

    // Re-sign image URLs fresh (stored signed URLs expire after 7 days).
    const signed = await Promise.all(
      (concepts ?? []).map(async (c: AdConcept) => {
        if (!c.image_url) return c
        try {
          const path = storagePaths.conceptImage(tenant.id, params.id, c.id)
          return { ...c, image_url: await signAsset(path) }
        } catch {
          return c
        }
      })
    )

    return NextResponse.json({ concepts: signed })
  } catch (err) {
    if (err instanceof AdsAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
