'use client'

import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ProfitThresholds } from '@/lib/types'

export type QuoteRow = {
  id: string
  customerName: string
  customerAddress: string | null
  paintscoutQuoteId: string | null
  totalPrice: number
  laborPct: number
  materialPct: number
  profitPct: number
  marginStatus: 'pass' | 'warning' | 'fail'
  createdAt: string
  createdByName: string
  linkedProject: { id: string; label: string } | null
}

interface QuotesClientProps {
  rows: QuoteRow[]
  thresholds: Pick<ProfitThresholds, 'labor_max_pct' | 'materials_max_pct' | 'min_profit_margin_pct'>
  tenantName: string
  role: 'admin' | 'estimator'
}

const statusBadge: Record<QuoteRow['marginStatus'], { label: string; className: string }> = {
  pass: { label: 'Good to quote', className: 'bg-green-100 text-green-700' },
  warning: { label: 'Caution', className: 'bg-yellow-100 text-yellow-700' },
  fail: { label: 'Off target', className: 'bg-red-100 text-red-700' },
}

export default function QuotesClient({ rows, thresholds, tenantName, role }: QuotesClientProps) {
  return (
    <AppShell variant="admin" companyName={tenantName} role={role}>
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
            <p className="mt-1 text-sm text-gray-500">
              Run the guardrails before the contract goes out — labor ≤{thresholds.labor_max_pct}%, materials &lt;{thresholds.materials_max_pct}%, profit ≥{thresholds.min_profit_margin_pct}%.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link
              href="/admin/quotes/new"
              className="inline-flex items-center gap-2 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Quote
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Quote #</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Profit %</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Guardrails</th>
                  {role === 'admin' && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estimator</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/quotes/${row.id}`} className="text-sm font-medium text-ember hover:text-primary-700">
                        {row.customerName}
                      </Link>
                      <p className="text-xs text-gray-400">
                        {row.customerAddress || ''}{row.customerAddress ? ' · ' : ''}{formatDate(row.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.paintscoutQuoteId || '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(row.totalPrice)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{row.profitPct.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[row.marginStatus].className}`}>
                        {statusBadge[row.marginStatus].label}
                      </span>
                    </td>
                    {role === 'admin' && (
                      <td className="px-4 py-3 text-sm text-gray-600">{row.createdByName}</td>
                    )}
                    <td className="px-4 py-3">
                      {row.linkedProject ? (
                        role === 'admin' ? (
                          <Link
                            href={`/admin/projects/${row.linkedProject.id}`}
                            className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 hover:bg-purple-200"
                          >
                            Won · {row.linkedProject.label}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                            Won
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                          Open
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={role === 'admin' ? 7 : 6} className="px-4 py-10 text-center text-sm text-gray-500">
                      No quotes yet. Hit <span className="font-medium">New Quote</span> to run your first guardrail check before sending a contract.
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
