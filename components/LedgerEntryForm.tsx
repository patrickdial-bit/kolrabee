'use client'

import { useState, useEffect } from 'react'
import { ProjectEstimate, ProjectLedgerEntry, ProfitThresholds, getMarginStatus } from '@/lib/types'

interface LedgerEntryFormProps {
  projectId: string
  estimate: ProjectEstimate | null
  ledgerEntry?: ProjectLedgerEntry | null
  thresholds: ProfitThresholds
  onSave?: (entry: ProjectLedgerEntry) => void
}

export default function LedgerEntryForm({
  projectId,
  estimate,
  ledgerEntry,
  thresholds,
  onSave,
}: LedgerEntryFormProps) {
  const [formData, setFormData] = useState({
    actualMaterialCost: ledgerEntry?.actual_material_cost || estimate?.material_cost_estimate || 0,
    actualCrewHours: ledgerEntry?.actual_crew_hours || estimate?.estimated_hours || 0,
    actualCrewPay: ledgerEntry?.actual_crew_pay || (estimate?.estimated_hours || 0) * (estimate?.crew_rate_per_hour || 30) * (estimate?.crew_count || 1),
    referralFee: ledgerEntry?.referral_fee || 0,
    notes: ledgerEntry?.notes || '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!estimate) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
        No estimate found. Please create an estimate first.
      </div>
    )
  }

  // Calculate actual percentages
  const totalPrice = estimate.total_price
  const cogs = formData.actualMaterialCost + formData.actualCrewPay + (formData.referralFee || 0)
  const grossProfit = totalPrice - cogs
  const materialPct = totalPrice > 0 ? (formData.actualMaterialCost / totalPrice) * 100 : 0
  const laborPct = totalPrice > 0 ? (formData.actualCrewPay / totalPrice) * 100 : 0
  const profitPct = totalPrice > 0 ? (grossProfit / totalPrice) * 100 : 0

  const marginStatus = getMarginStatus(materialPct, laborPct, profitPct, thresholds)

  const handleSave = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          actualMaterialCost: formData.actualMaterialCost,
          actualCrewHours: formData.actualCrewHours,
          actualCrewPay: formData.actualCrewPay,
          referralFee: formData.referralFee || null,
          notes: formData.notes || null,
        }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const saved = await res.json()
      onSave?.(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ledger entry')
    } finally {
      setLoading(false)
    }
  }

  const VarianceIndicator = ({ label, estimated, actual }: any) => {
    const variance = actual - estimated
    const variancePct = estimated > 0 ? (variance / estimated) * 100 : 0
    const isUnderBudget = variance < 0

    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-200">
        <span className="text-sm text-gray-600">{label}</span>
        <div className="text-right">
          <div className="text-sm font-semibold">${actual.toFixed(2)}</div>
          <div className={`text-xs font-medium ${isUnderBudget ? 'text-green-600' : 'text-red-600'}`}>
            {isUnderBudget ? '−' : '+'}${Math.abs(variance).toFixed(2)} ({variancePct.toFixed(1)}%)
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Actual Material Cost</label>
          <input
            type="number"
            value={formData.actualMaterialCost}
            onChange={(e) => setFormData({ ...formData, actualMaterialCost: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <div className="text-xs text-gray-500 mt-1">Est: ${estimate.material_cost_estimate.toFixed(2)}</div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Actual Crew Hours</label>
          <input
            type="number"
            value={formData.actualCrewHours}
            onChange={(e) => setFormData({ ...formData, actualCrewHours: parseFloat(e.target.value) || 0 })}
            step="0.5"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <div className="text-xs text-gray-500 mt-1">Est: {estimate.estimated_hours} hrs</div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Actual Crew Pay</label>
          <input
            type="number"
            value={formData.actualCrewPay}
            onChange={(e) => setFormData({ ...formData, actualCrewPay: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <div className="text-xs text-gray-500 mt-1">
            Est: ${(estimate.estimated_hours * estimate.crew_rate_per_hour * estimate.crew_count).toFixed(2)}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referral Fee (if any)</label>
          <input
            type="number"
            value={formData.referralFee}
            onChange={(e) => setFormData({ ...formData, referralFee: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="e.g., Job completed ahead of schedule, crew upsell included"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      {/* Variance analysis */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">vs. Estimate</h3>
        <VarianceIndicator
          label="Material Cost"
          estimated={estimate.material_cost_estimate}
          actual={formData.actualMaterialCost}
        />
        <VarianceIndicator
          label="Crew Pay"
          estimated={estimate.estimated_hours * estimate.crew_rate_per_hour * estimate.crew_count}
          actual={formData.actualCrewPay}
        />
        <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-sm">
          <span>Total COGS</span>
          <span>${cogs.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold text-sm text-green-700">
          <span>Actual Gross Profit</span>
          <span>${grossProfit.toFixed(2)}</span>
        </div>
      </div>

      {/* Actual margin status */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Actual Margin</h3>
        <div className={`rounded-lg p-4 text-center font-semibold ${
          marginStatus === 'pass'
            ? 'bg-green-50 text-green-700'
            : marginStatus === 'warning'
              ? 'bg-yellow-50 text-yellow-700'
              : 'bg-red-50 text-red-700'
        }`}>
          <div className="text-2xl font-bold">{profitPct.toFixed(1)}%</div>
          <div className="text-xs mt-2">
            {marginStatus === 'pass' && '✓ On target'}
            {marginStatus === 'warning' && '⚠ Below target'}
            {marginStatus === 'fail' && '✗ Margin violation'}
          </div>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Ledger Entry'}
      </button>
    </div>
  )
}
