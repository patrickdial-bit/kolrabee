'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ThresholdRanges } from '@/lib/types'
import { updateProfitThresholds } from './actions'

// Company-level guardrail ranges. Collapsed by default — this is a
// set-and-forget setting, not a daily control.
export default function ThresholdSettings({ thresholds }: { thresholds: ThresholdRanges }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    labor_min_pct: thresholds.labor_min_pct,
    labor_max_pct: thresholds.labor_max_pct,
    materials_min_pct: thresholds.materials_min_pct,
    materials_max_pct: thresholds.materials_max_pct,
    min_profit_margin_pct: thresholds.min_profit_margin_pct,
    profit_max_pct: thresholds.profit_max_pct,
  })

  const setField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: parseFloat(e.target.value) })

  const handleSave = async () => {
    for (const v of Object.values(form)) {
      if (Number.isNaN(v)) {
        toast.error('All bounds must be numbers between 0 and 100.')
        return
      }
    }
    setSaving(true)
    const result = await updateProfitThresholds(form)
    setSaving(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('Guardrails updated for the whole company.')
      setOpen(false)
      router.refresh()
    }
  }

  const rows: Array<{ label: string; hint: string; floorKey: keyof typeof form; ceilKey: keyof typeof form }> = [
    { label: 'Painter Labor %', hint: 'Too high eats the margin; far under range usually means the hours are underestimated.', floorKey: 'labor_min_pct', ceilKey: 'labor_max_pct' },
    { label: 'Materials %', hint: 'Too high eats the margin; suspiciously low usually means something was left out of the bid.', floorKey: 'materials_min_pct', ceilKey: 'materials_max_pct' },
    { label: 'Gross Profit %', hint: 'Below the floor the job is underpriced; above the ceiling the quote may not be competitive.', floorKey: 'min_profit_margin_pct', ceilKey: 'profit_max_pct' },
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <span className="text-sm font-semibold text-gray-900">Guardrail Settings</span>
          <span className="ml-2 text-xs text-gray-500">Company-wide floors and ceilings — applies to every quote and job</span>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-200 px-4 py-4 space-y-4">
          {rows.map((row) => (
            <div key={row.label} className="sm:flex sm:items-center sm:gap-4">
              <div className="sm:w-64">
                <p className="text-sm font-medium text-gray-900">{row.label}</p>
                <p className="text-xs text-gray-500">{row.hint}</p>
              </div>
              <div className="mt-2 sm:mt-0 flex items-center gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Floor</label>
                  <div className="relative">
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={Number.isNaN(form[row.floorKey]) ? '' : form[row.floorKey]}
                      onChange={setField(row.floorKey)}
                      className="w-24 rounded-md border border-gray-300 pl-3 pr-7 py-1.5 text-sm text-gray-900"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                </div>
                <span className="mt-4 text-gray-400">–</span>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Ceiling</label>
                  <div className="relative">
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={Number.isNaN(form[row.ceilKey]) ? '' : form[row.ceilKey]}
                      onChange={setField(row.ceilKey)}
                      className="w-24 rounded-md border border-gray-300 pl-3 pr-7 py-1.5 text-sm text-gray-900"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Guardrails'}
            </button>
            <p className="text-xs text-gray-500">Set a floor to 0 or a ceiling to 100 to leave that side open.</p>
          </div>
        </div>
      )}
    </div>
  )
}
