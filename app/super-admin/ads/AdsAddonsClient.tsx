'use client'

import { useState } from 'react'
import SuperAdminNav from '@/components/SuperAdminNav'
import type { AdAddonSettings } from '@/lib/types'

type Row = {
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  settings: AdAddonSettings | null
}

export default function AdsAddonsClient({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function patch(tenantId: string, body: Record<string, unknown>) {
    setBusy(tenantId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/ads/addons/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Update failed.')
        return
      }
      setRows((rs) => rs.map((r) => (r.tenant_id === tenantId ? { ...r, settings: data.settings } : r)))
    } catch {
      setError('Network error.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Ads Agent — Add-on Management</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enable the Ads Agent per tenant and control whether output is cleared for paid spend.
        </p>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-900">
              <tr>
                {['Tenant', 'Enabled', 'Compliance', 'Monthly limit', 'Used'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-200">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row) => {
                const s = row.settings
                const enabled = !!s?.enabled
                const compliance = s?.compliance_status ?? 'testing_only'
                const isBusy = busy === row.tenant_id
                return (
                  <tr key={row.tenant_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{row.tenant_name}</div>
                      <div className="text-xs text-gray-500">/{row.tenant_slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => patch(row.tenant_id, { enabled: !enabled })}
                        disabled={isBusy}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                          enabled ? 'bg-ember' : 'bg-gray-300'
                        }`}
                        aria-label="Toggle add-on"
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={compliance}
                        disabled={isBusy}
                        onChange={(e) => patch(row.tenant_id, { compliance_status: e.target.value })}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember disabled:opacity-50"
                      >
                        <option value="testing_only">Testing only</option>
                        <option value="cleared_for_paid">Cleared for paid</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={s?.monthly_run_limit ?? 4}
                        disabled={isBusy}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10)
                          if (!Number.isNaN(v) && v !== (s?.monthly_run_limit ?? 4)) {
                            patch(row.tenant_id, { monthly_run_limit: v })
                          }
                        }}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember disabled:opacity-50"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s?.runs_this_month ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
