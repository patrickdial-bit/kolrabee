import Link from 'next/link'
import { getCurrentUser, formatDate } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/AppShell'
import NewBidRequestForm from './NewBidRequestForm'
import type { BidRequest } from '@/lib/bid-board/types'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-green-100 text-green-800',
  closed: 'bg-amber-100 text-amber-800',
  awarded: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-700',
}

export default async function BidBoardPage() {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: requests } = await adminClient
    .from('bid_requests')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  const list = (requests ?? []) as BidRequest[]

  return (
    <AppShell variant="admin" companyName={tenant.name ?? ''}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-forge">Bid Board</h1>
            <p className="mt-1 text-sm text-gray-500">
              Price-in sourcing: scope a job, broadcast it to subs, compare their numbers.
            </p>
          </div>
          <NewBidRequestForm />
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {list.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">
              No bid requests yet. Create one to get started.
            </p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Trade</th>
                  <th className="px-4 py-3">Bids due</th>
                  <th className="px-4 py-3">Target window</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/bids/${r.id}`} className="font-medium text-ember hover:underline">
                        {r.title}
                      </Link>
                      {r.site_address && (
                        <div className="text-xs text-gray-500">{r.site_address}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.trade ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(r.bids_due_at)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(r.target_start)} – {formatDate(r.target_end)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  )
}
