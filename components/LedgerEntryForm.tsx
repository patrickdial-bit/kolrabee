'use client'

import { useState, useEffect } from 'react'
import { ProjectEstimate, ProjectLedgerEntry, ProfitThresholds, getMarginStatus } from '@/lib/types'

interface LedgerEntryFormProps {
  projectId: string
  estimate?: ProjectEstimate | null
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
    actualMaterialCost: ledgerEntry?.actual_material_cost || 0,
    actualCrewHours: ledgerEntry?.actual_crew_hours || 0,
    actualCrewPay: ledgerEntry?.actual_crew_pay || 0,
    referralFee: ledgerEntry?.referral_fee || 0,
    notes: ledgerEntry?.notes || '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!estimate) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
        <p className="font-semibold">No estimate found</p>
        <p className="text-sm">Create an estimate first before recording actual costs.</p>
      </div>
    )
  }

  const totalPrice = estimate.total_price
  const totalCogs = formData.actualMaterialCost + formData.actualCrewPay + (formData.referralFee || 0)
  const actualGrossProfit = totalPrice - totalCogs
  const actualMarginPct = totalPrice > 0 ? (actualGrossProfit / totalPrice) * 100 : 0

  const estimatedLaborCost = estimate.estimated_hours * estimate.crew_rate_per_hour * estimate.crew_count
  const estimatedMaterialCost = estimate.material_cost_estimate || 0

  const materialVariance = formData.actualMaterialCost - estimatedMaterialCost
  const materialVariancePct = estimatedMaterialCost > 0 ? (materialVariance / estimatedMaterialCost) * 100 : 0

  const crewPayVariance = formData.actualCrewPay - estimatedLaborCost
  const crewPayVariancePct = estimatedLaborCost > 0 ? (crewPayVariance / estimatedLaborCost) * 100 : 0

  const marginStatus = getMarginStatus(
    (formData.actualMaterialCost / totalPrice) * 100,
    (formData.actualCrewPay / totalPrice) * 100,
    actualMarginPct,
    thresholds
  )

  const handleSave = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          ...formData,
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

  const VarianceIndicator = ({ label, estimated, actual, variance, variancePct }: any) => {
    const isOverage = variance > 0
    const bgColor = variancePct < 5 ? 'bg-green-50' : variancePct < 15 ? 'bg-yellow-50' : 'bg-red-50'
    const textColor = variancePct < 5 ? 'text-green-700' : variancePct < 15 ? 'text-yellow-700' : 'text-red-700'

    return (
      <div className={`rounded-lg p-3 ${bgColor}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-medium ${textColor}`}>{label}</p>
            <div className="flex gap-4 mt-1 text-xs">
              <div>
                <span className="text-gray-600">Estimate:</span>
                <span className="ml-1 font-semibold">${estimated.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Actual:</span>
                <span className="ml-1 font-semibold">${actual.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${textColor}`}>{isOverage ? '+' : ''}${variance.toFixed(2)}</p>
            <p className={`text-xs ${textColor}`}>{isOverage ? '+' : ''}{variancePct.toFixed(1)}%</p>
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Actual Crew Pay</label>
          <input
            type="number"
            value={formData.actualCrewPay}
            onChange={(e) => setFormData({ ...formData, actualCrewPay: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referral Fee</label>
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
          placeholder="e.g., additional prep work, weather delays, material issues..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      {/* Variance analysis */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Variance Analysis</h3>
        <div className="space-y-2">
          <VarianceIndicator
            label="Materials"
            estimated={estimatedMaterialCost}
            actual={formData.actualMaterialCost}
            variance={materialVariance}
            variancePct={Math.abs(materialVariancePct)}
          />
          <VarianceIndicator
            label="Crew Pay"
            estimated={estimatedLaborCost}
            actual={formData.actualCrewPay}
            variance={crewPayVariance}
            variancePct={Math.abs(crewPayVariancePct)}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Price:</span>
          <span className="font-semibold">${totalPrice.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total COGS:</span>
          <span className="font-semibold">${totalCogs.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-semibold">
          <span>Actual Gross Profit:</span>
          <span className={actualMarginPct >= thresholds.min_profit_margin_pct ? 'text-green-700' : 'text-red-700'}>
            ${actualGrossProfit.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Actual Margin %:</span>
          <span className={`font-semibold ${actualMarginPct >= thresholds.min_profit_margin_pct ? 'text-green-700' : 'text-red-700'}`}>
            {actualMarginPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Status */}
      <div
        className={`rounded-lg p-3 text-center font-semibold ${
          marginStatus === 'pass'
            ? 'bg-green-50 text-green-700'
            : marginStatus === 'warning'
              ? 'bg-yellow-50 text-yellow-700'
              : 'bg-red-50 text-red-700'
        }`}
      >
        {marginStatus === 'pass' && '✓ Margin target met'}
        {marginStatus === 'warning' && '⚠ Below target — review variances'}
        {marginStatus === 'fail' && '✗ Significant margin loss'}
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Actual Costs'}
      </button>
    </div>
  )
}
