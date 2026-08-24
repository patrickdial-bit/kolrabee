'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { formatDate } from '@/lib/utils'
import type { ProfitThresholds } from '@/lib/types'

export type MarginRow = {
  projectId: string
  jobNumber: string | null
  customerName: string
  status: string
  startDate: string | null
  hasEstimate: boolean
  hasLedger: boolean
  laborPct: number | null
  materialPct: number | null
  profitPct: number | null
  isActual: boolean
  marginStatus: 'pass' | 'warning' | 'fail' | null
}

interface MarginsClientProps {
  rows: MarginRow[]
  thresholds: Pick<ProfitThresholds, 'labor_max_pct' | 'materials_max_pct' | 'min_profit_margin_pct'>
  tenantName: string
}

const FILTERS = ['All', 'Needs attention', 'No estimate'] as const
type Filter = (typeof FILTERS)[number]

const statusOrder: Record<string, number> = { fail: 0, warning: 1, pass: 3 }

const statusBadge: Record<'pass' | 'warning' | 'fail', { label: string; className: string }> = {
  pass: { label: 'On target', className: 'bg-green-100 text-green-700' },
  warning: { label: 'Caution', className: 'bg-yellow-100 text-yellow-700' },
  fail: { label: 'Off target', className: 'bg-red-100 text-red-700' },
}

function Pct({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400">—</span>
  return <span>{value.toFixed(1)}%</span>
}

export default function MarginsClient({ rows, thresholds, tenantName }: MarginsClientProps) {
  const [filter, setFilter] = useState<Filter>('All')

  const filtered = useMemo(() => {
    let list = rows
    if (filter === 'Needs attention') {
      list = list.filter((r) => r.marginStatus === 'fail' || r.marginStatus === 'warning')
    } else if (filter === 'No estimate') {
      list = list.filter((r) => !r.hasEstimate)
    }
    // Worst guardrail status first, then no-estimate rows, then everything else,
    // so the jobs that need eyes on them surface at the top of the list.
    return [...list].sort((a, b) => {
      const aRank = a.marginStatus ? statusOrder[a.marginStatus] : 2
      const bRank = b.marginStatus ? statusOrder[b.marginStatus] : 2
      if (aRank !== bRank) return aRank - bRank
      if (a.profitPct !== null && b.profitPct !== null) return a.profitPct - b.profitPct
      return 0
    })
  }, [rows, filter])

  const needsAttentionCount = rows.filter((r) => r.marginStatus === 'fail' || r.marginStatus === 'warning').length
  const noEstimateCount = rows.filter((r) => !r.hasEstimate).length

  return (
    <AppShell variant="admin" companyName={tenantName}>
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Margins</h1>
          <p className="mt-1 text-sm text-gray-500">
            Guardrails: painter labor ≤{thresholds.labor_max_pct}%, materials &lt;{thresholds.materials_max_pct}%, gross profit ≥{thresholds.min_profit_margin_pct}%.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total jobs</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{rows.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Needs attention</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{needsAttentionCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">No estimate yet</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{noEstimateCount}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                filter === f ? 'bg-ember text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Labor %</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Material %</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Profit %</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Guardrails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.projectId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/projects/${row.projectId}`} className="text-sm font-medium text-ember hover:text-primary-700">
                        {row.jobNumber ? `#${row.jobNumber} · ` : ''}{row.customerName}
                      </Link>
                      <p className="text-xs text-gray-400">{formatDate(row.startDate)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-gray-600">{row.status.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900"><Pct value={row.laborPct} /></td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900"><Pct value={row.materialPct} /></td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900"><Pct value={row.profitPct} /></td>
                    <td className="px-4 py-3">
                      {!row.hasEstimate ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                          No estimate
                        </span>
                      ) : row.marginStatus ? (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[row.marginStatus].className}`}>
                          {statusBadge[row.marginStatus].label}
                          {row.isActual && <span className="text-[10px] font-normal opacity-75">(actual)</span>}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      No jobs match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
