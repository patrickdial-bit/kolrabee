import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST as leadsPost } from '../../route'

// Per-source inbound webhook: /api/leads/webhook/<token>
// Works three ways:
//  - Meta lead ads webhook: GET verification handshake below, POST leadgen
//    payloads with entry[].changes[].value.field_data
//  - Zapier/Make bridges (Meta or Google lead forms): POST flat JSON
//  - Any custom system: POST flat JSON {name/email/phone/address/service/message}

export const dynamic = 'force-dynamic'

// Meta webhook verification: echo hub.challenge when the token matches a
// registered active source (hub.verify_token is our source token).
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const verifyToken = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && challenge && verifyToken === params.token) {
    const adminClient = createAdminClient()
    const { data: src } = await adminClient
      .from('mk_lead_sources')
      .select('id, status')
      .eq('token', params.token)
      .maybeSingle()
    if (src?.status === 'active') {
      return new NextResponse(challenge, { status: 200 })
    }
  }
  return new NextResponse('Verification failed', { status: 403 })
}

function fromFieldData(fieldData: Array<{ name?: string; values?: string[] }>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fieldData ?? []) {
    const key = (f.name ?? '').toLowerCase()
    const value = f.values?.[0]
    if (!value) continue
    if (key.includes('full') && key.includes('name')) out.name = value
    else if (key.includes('first')) out.first_name = value
    else if (key.includes('last')) out.last_name = value
    else if (key.includes('email')) out.email = value
    else if (key.includes('phone')) out.phone = value
    else if (key.includes('address') || key.includes('street')) out.address = value
    else if (key.includes('service') || key.includes('interested')) out.service = value
    else out.message = [out.message, `${f.name}: ${value}`].filter(Boolean).join('\n')
  }
  return out
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  let payload: any
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  // Normalize: Meta leadgen envelope or flat JSON.
  const submissions: Record<string, unknown>[] = []
  const entries = Array.isArray(payload?.entry) ? payload.entry : null
  if (entries) {
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value
        if (value?.field_data) submissions.push(fromFieldData(value.field_data))
      }
    }
  }
  if (submissions.length === 0) submissions.push(payload)

  let accepted = 0
  let lastError: string | null = null
  for (const sub of submissions.slice(0, 20)) {
    const body = { ...sub, source_token: params.token }
    const forwarded = new NextRequest(
      new Request(new URL('/api/leads', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    )
    const res = await leadsPost(forwarded)
    if (res.ok) accepted++
    else lastError = `status ${res.status}`
  }

  if (accepted === 0) {
    return NextResponse.json({ error: `No submissions accepted (${lastError ?? 'no data'}).` }, { status: 400 })
  }
  return NextResponse.json({ success: true, accepted })
}
