import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdsTenant, AdsAccessError } from '@/lib/ads/access'
import { logAuditEvent } from '@/lib/ads/audit'

const VALID = ['draft', 'approved', 'rejected']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenant, appUser } = await requireAdsTenant({ adminOnly: true })
    const body = await req.json()
    const status: string = body.status
    if (!VALID.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: concept } = await adminClient
      .from('ad_concepts')
      .select('id, run_id')
      .eq('id', params.id)
      .eq('tenant_id', tenant.id)
      .maybeSingle()
    if (!concept) return NextResponse.json({ error: 'Concept not found' }, { status: 404 })

    const reviewing = status === 'draft' ? null : appUser.id
    const reviewedAt = status === 'draft' ? null : new Date().toISOString()

    const { data: updated, error } = await adminClient
      .from('ad_concepts')
      .update({ status, reviewed_by: reviewing, reviewed_at: reviewedAt })
      .eq('id', params.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Keep the run's approved counter in sync.
    const { count } = await adminClient
      .from('ad_concepts')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', concept.run_id)
      .eq('status', 'approved')
    await adminClient
      .from('ad_generation_runs')
      .update({ concepts_approved: count ?? 0 })
      .eq('id', concept.run_id)

    await logAuditEvent({
      tenantId: tenant.id,
      userId: appUser.id,
      action: `concept.${status}`,
      entityId: params.id,
    })

    return NextResponse.json({ concept: updated })
  } catch (err) {
    if (err instanceof AdsAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
