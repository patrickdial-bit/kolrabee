import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdsTenant, AdsAccessError } from '@/lib/ads/access'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenant } = await requireAdsTenant()
    const adminClient = createAdminClient()
    const { data: run } = await adminClient
      .from('ad_generation_runs')
      .select('*')
      .eq('id', params.id)
      .eq('tenant_id', tenant.id)
      .maybeSingle()
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    return NextResponse.json({ run })
  } catch (err) {
    if (err instanceof AdsAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
