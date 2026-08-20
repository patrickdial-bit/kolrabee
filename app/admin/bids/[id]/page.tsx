import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import BidDetailClient from './BidDetailClient'
import type {
  BidAttachment,
  BidRequest,
  BidScopeGroup,
  BidScopeItem,
  ScopeCodeMaterial,
} from '@/lib/bid-board/types'

export const dynamic = 'force-dynamic'

export default async function BidRequestDetailPage({ params }: { params: { id: string } }) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: request } = await adminClient
    .from('bid_requests')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .single()
  if (!request) notFound()

  const [{ data: groups }, { data: items }, { data: attachments }, { data: materials }] =
    await Promise.all([
      adminClient
        .from('bid_scope_groups')
        .select('*')
        .eq('bid_request_id', params.id)
        .order('sort_order'),
      adminClient
        .from('bid_scope_items')
        .select('*')
        .eq('bid_request_id', params.id)
        .order('sort_order'),
      adminClient
        .from('bid_attachments')
        .select('*')
        .eq('bid_request_id', params.id)
        .order('sort_order')
        .order('created_at'),
      adminClient
        .from('scope_code_materials')
        .select('*')
        .or(`tenant_id.is.null,tenant_id.eq.${tenant.id}`),
    ])

  // Pre-sign viewer URLs for uploaded files (1h; viewer + gallery use).
  const signedUrls: Record<string, string> = {}
  const uploads = (attachments ?? []).filter((a) => a.kind === 'upload' && a.storage_path)
  if (uploads.length > 0) {
    const { data: signed } = await adminClient.storage
      .from('bid-packages')
      .createSignedUrls(uploads.map((a) => a.storage_path as string), 3600)
    signed?.forEach((s, i) => {
      if (s.signedUrl) signedUrls[uploads[i].id] = s.signedUrl
    })
  }

  return (
    <BidDetailClient
      request={request as BidRequest}
      groups={(groups ?? []) as BidScopeGroup[]}
      items={(items ?? []) as BidScopeItem[]}
      attachments={(attachments ?? []) as BidAttachment[]}
      materials={(materials ?? []) as ScopeCodeMaterial[]}
      signedUrls={signedUrls}
      tenantName={tenant.name ?? ''}
      tenantId={tenant.id}
    />
  )
}
