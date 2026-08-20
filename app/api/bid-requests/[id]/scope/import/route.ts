// POST /api/bid-requests/:id/scope/import — spec integration point.
// Accepts the full nested structure from the scoping system; Gate 1 validates,
// source_ref keys make re-import update in place. Auth: admin session cookie.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { importScopeCore, parseImportPayload } from '@/lib/bid-board/import'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, tenant_id, role, status')
    .eq('supabase_auth_id', authUser.id)
    .single()
  if (!appUser || appUser.role !== 'admin' || appUser.status !== 'active') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = parseImportPayload(body)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const result = await importScopeCore(adminClient, appUser.tenant_id, appUser.id, params.id, parsed.groups)
  if (!result.ok) {
    return NextResponse.json({ error: result.error, gate1: result.gate1 ?? undefined }, { status: result.status })
  }

  return NextResponse.json({ ok: true, groups: result.groupsUpserted, items: result.itemsUpserted })
}
