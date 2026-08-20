'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import AttachmentsPanel from '@/components/bid-board/AttachmentsPanel'
import ScopePanel from '@/components/bid-board/ScopePanel'
import { formatDate, formatCurrency } from '@/lib/utils'
import type {
  BidAttachment,
  BidRequest,
  BidScopeGroup,
  BidScopeItem,
  ScopeCodeMaterial,
} from '@/lib/bid-board/types'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-green-100 text-green-800',
  closed: 'bg-amber-100 text-amber-800',
  awarded: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-700',
}

type Props = {
  request: BidRequest
  groups: BidScopeGroup[]
  items: BidScopeItem[]
  attachments: BidAttachment[]
  materials: ScopeCodeMaterial[]
  signedUrls: Record<string, string>
  tenantName: string
  tenantId: string
}

export default function BidDetailClient({
  request,
  groups,
  items,
  attachments,
  materials,
  signedUrls,
  tenantName,
  tenantId,
}: Props) {
  const [tab, setTab] = useState<'package' | 'scope'>('package')

  return (
    <AppShell variant="admin" companyName={tenantName}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin/bids" className="text-sm text-gray-500 hover:text-ember">
          ← Bid Board
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-forge">{request.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              {request.site_address && <span>{request.site_address}</span>}
              {request.trade && <span className="capitalize">{request.trade}</span>}
              <span>Bids due {formatDate(request.bids_due_at)}</span>
              <span>
                Window {formatDate(request.target_start)} – {formatDate(request.target_end)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[request.status] ?? ''}`}>
              {request.status}
            </span>
          </div>
        </div>

        {/* Internal-only figures — never exposed on sub-facing routes */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="text-xs text-gray-500">Internal budget</div>
            <div className="text-lg font-semibold text-forge">
              {request.internal_budget != null ? formatCurrency(request.internal_budget) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="text-xs text-gray-500">Customer price</div>
            <div className="text-lg font-semibold text-forge">
              {request.customer_price != null ? formatCurrency(request.customer_price) : '—'}
            </div>
          </div>
        </div>

        {request.scope_narrative && (
          <p className="mt-4 max-w-3xl whitespace-pre-line rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            {request.scope_narrative}
          </p>
        )}

        <div className="mt-6 border-b border-gray-200">
          <nav className="flex gap-4">
            {(['package', 'scope'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border-b-2 px-1 pb-2 text-sm font-medium ${
                  tab === t
                    ? 'border-ember text-ember'
                    : 'border-transparent text-gray-500 hover:text-forge'
                }`}
              >
                {t === 'package' ? `Package (${attachments.length})` : `Scope (${items.length} items)`}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          {tab === 'package' ? (
            <AttachmentsPanel
              request={request}
              attachments={attachments}
              signedUrls={signedUrls}
              tenantId={tenantId}
            />
          ) : (
            <ScopePanel
              request={request}
              groups={groups}
              items={items}
              attachments={attachments}
              materials={materials}
              signedUrls={signedUrls}
            />
          )}
        </div>
      </div>
    </AppShell>
  )
}
