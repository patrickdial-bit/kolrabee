'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import Tooltip from '@/components/Tooltip'
import type { ProspectRow } from './page'
import { convertProspectToLead, deleteProspectData, importProspectsCsv } from './actions'

function scoreColor(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-500'
  if (score >= 75) return 'bg-emerald-100 text-emerald-700'
  if (score >= 55) return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-600'
}

export default function ProspectsClient({ prospects }: { prospects: ProspectRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showImport, setShowImport] = useState(prospects.length === 0)
  const [csvDraft, setCsvDraft] = useState('')
  const [ownerOccOnly, setOwnerOccOnly] = useState(true)
  const [minScore, setMinScore] = useState(0)

  const visible = useMemo(
    () =>
      prospects.filter((p) => {
        if (ownerOccOnly && p.owner_occupied === false) return false
        if ((p.score ?? 0) < minScore) return false
        return true
      }),
    [prospects, ownerOccOnly, minScore]
  )

  const stats = useMemo(
    () => ({
      total: prospects.length,
      ownerOcc: prospects.filter((p) => p.owner_occupied).length,
      suppressed: prospects.filter((p) => p.suppressed).length,
      converted: prospects.filter((p) => p.status === 'converted').length,
    }),
    [prospects]
  )

  function handleImport() {
    if (!csvDraft.trim()) return
    startTransition(async () => {
      const result = await importProspectsCsv(csvDraft)
      if ('error' in result && result.error) toast.error(result.error)
      else if ('imported' in result) {
        toast.success(`Imported ${result.imported} prospects (${result.suppressed} suppressed, ${result.skipped} skipped).`)
        setCsvDraft('')
        setShowImport(false)
        router.refresh()
      }
    })
  }

  function handleConvert(id: string) {
    startTransition(async () => {
      const result = await convertProspectToLead(id)
      if (result?.error) toast.error(result.error)
      else { toast.success('Lead created — see the Leads screen.'); router.refresh() }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this record and permanently suppress the address? (Data deletion request)')) return
    startTransition(async () => {
      const result = await deleteProspectData(id)
      if (result?.error) toast.error(result.error)
      else { toast.success('Record deleted; address suppressed.'); router.refresh() }
    })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospector</h1>
          <p className="mt-1 text-sm text-gray-500">
            Homeowner prospects from public county parcel data — scored, provenance-tracked, suppression-aware.
          </p>
        </div>
        <button
          onClick={() => setShowImport((v) => !v)}
          className="mt-4 sm:mt-0 rounded-md bg-ember px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {showImport ? 'Close import' : 'Import parcel CSV'}
        </button>
      </div>

      {showImport && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">Import county auditor parcel data</p>
          <p className="text-xs text-gray-600 mb-2">
            Download the bulk parcel export from the county auditor (Delaware, Franklin, Licking, Union all publish
            these free) and paste rows here. Columns are matched by header name — address is required; parcel ID,
            owner, owner-occupied/homestead, year built, acreage, sale date/price, and assessed value are used when
            present. Addresses previously opted out import as suppressed and can never be contacted.
          </p>
          <textarea
            value={csvDraft}
            onChange={(e) => setCsvDraft(e.target.value)}
            rows={6}
            placeholder={'Parcel ID,Site Address,City,State,Zip,Owner,Homestead,Year Built,Acres,Sale Date,Sale Price,Assessed Value\n41912345,745 Oak St,Sunbury,OH,43074,SMITH JOHN,Y,1998,0.42,2024-05-01,385000,310000'}
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
          />
          <button
            onClick={handleImport}
            disabled={isPending || !csvDraft.trim()}
            className="mt-2 rounded-md bg-ember px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isPending ? 'Importing…' : 'Import'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {[
          { label: 'Prospects', value: stats.total },
          { label: 'Owner-occupied', value: stats.ownerOcc },
          { label: 'Converted to leads', value: stats.converted },
          { label: 'Suppressed', value: stats.suppressed },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{s.label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={ownerOccOnly} onChange={(e) => setOwnerOccOnly(e.target.checked)} />
          Owner-occupied only
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Min score
          <input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(parseInt(e.target.value) || 0)}
            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <span className="text-xs text-gray-500">{visible.length} shown</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Property</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Owner</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Built</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Assessed</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Score</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                  No prospects match. Import a county parcel CSV to get started.
                </td>
              </tr>
            ) : (
              visible.map((p) => (
                <tr key={p.id} className={p.suppressed ? 'opacity-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{p.address}</p>
                    <p className="text-xs text-gray-500">
                      {[p.city, p.state, p.zip].filter(Boolean).join(', ')}
                      {p.parcel_id ? ` · ${p.parcel_id}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {p.owner_name ?? '—'}
                    {p.owner_occupied === false && <span className="ml-1 text-xs text-amber-600">(non-occupant)</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">{p.year_built ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                    {p.assessed_value != null ? formatCurrency(Number(p.assessed_value)) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Tooltip text={p.score_reasons?.map((r) => `${r.label} +${r.points}`).join(' · ') || 'No breakdown'}>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(p.score)}`}>
                        {p.score ?? '—'}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {p.suppressed ? <span className="text-red-500">suppressed</span> : p.status}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {!p.suppressed && p.status !== 'converted' && (
                      <button
                        onClick={() => handleConvert(p.id)}
                        disabled={isPending}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Make lead
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={isPending}
                      className="ml-1 rounded-md bg-white border border-gray-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
