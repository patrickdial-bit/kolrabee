'use client'

import { useState, useEffect } from 'react'
import { ProjectEstimate, ProfitThresholds, getMarginStatus, formatThresholdRange } from '@/lib/types'

interface MarginCalculatorProps {
  // Omit projectId to run in standalone quote mode: the estimate is saved
  // against a customer name instead of a project (pre-contract workflow).
  projectId?: string
  projectValue?: number
  estimate?: ProjectEstimate | null
  thresholds: ProfitThresholds
  onSave?: (estimate: ProjectEstimate) => void
}

export default function MarginCalculator({
  projectId,
  projectValue = 0,
  estimate,
  thresholds,
  onSave,
}: MarginCalculatorProps) {
  const quoteMode = !projectId

  const [formData, setFormData] = useState({
    customerName: estimate?.customer_name || '',
    customerAddress: estimate?.customer_address || '',
    paintscoutQuoteId: estimate?.paintscout_quote_id || '',
    totalPrice: estimate?.total_price || projectValue,
    estimatedHours: estimate?.estimated_hours || 0,
    crewCount: estimate?.crew_count || 1,
    crewRatePerHour: estimate?.crew_rate_per_hour || 30,
    materialCostEstimate: estimate?.material_cost_estimate || 0,
    referralFee: estimate?.referral_fee || 0,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate percentages
  const laborCost = formData.estimatedHours * formData.crewRatePerHour * formData.crewCount
  const laborPct = formData.totalPrice > 0 ? (laborCost / formData.totalPrice) * 100 : 0
  const materialPct = formData.totalPrice > 0 ? (formData.materialCostEstimate / formData.totalPrice) * 100 : 0
  const profitPct = 100 - laborPct - materialPct

  const marginStatus = getMarginStatus(materialPct, laborPct, profitPct, thresholds)

  const handleSave = async () => {
    if (quoteMode && !formData.customerName.trim()) {
      setError('Customer name is required.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      // Project mode upserts by project; quote mode updates by estimate id
      // when editing an existing quote, otherwise creates a new one.
      const target = projectId
        ? { projectId }
        : estimate?.id
          ? { estimateId: estimate.id }
          : {}
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...target,
          ...formData,
        }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const saved = await res.json()
      onSave?.(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save estimate')
    } finally {
      setLoading(false)
    }
  }

  const StatusBadge = ({ label, value, floor, ceiling }: { label: string; value: number; floor: number; ceiling: number }) => {
    const isOk = value >= floor && value <= ceiling
    const bgColor = isOk ? 'bg-green-50' : 'bg-red-50'
    const textColor = isOk ? 'text-green-700' : 'text-red-700'
    const dotColor = isOk ? 'bg-green-400' : 'bg-red-400'

    return (
      <div className={`rounded-lg p-3 ${bgColor}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${textColor}`}>{label}</span>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
            <span className={`text-lg font-bold ${textColor}`}>{value.toFixed(1)}%</span>
          </div>
        </div>
        <div className={`text-xs ${textColor} mt-1`}>
          {formatThresholdRange(floor, ceiling)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {quoteMode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              placeholder="e.g., Sarah Johnson"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Address</label>
            <input
              type="text"
              value={formData.customerAddress}
              onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
              placeholder="e.g., 175 Loveman Ave, Columbus, OH"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Price</label>
          <input
            type="number"
            value={formData.totalPrice}
            onChange={(e) => setFormData({ ...formData, totalPrice: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PaintScout Quote #</label>
          <input
            type="text"
            value={formData.paintscoutQuoteId}
            onChange={(e) => setFormData({ ...formData, paintscoutQuoteId: e.target.value })}
            placeholder="e.g., 3938"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
          <input
            type="number"
            value={formData.estimatedHours}
            onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) || 0 })}
            step="0.5"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Crew Rate/Hour</label>
          <input
            type="number"
            value={formData.crewRatePerHour}
            onChange={(e) => setFormData({ ...formData, crewRatePerHour: parseFloat(e.target.value) || 0 })}
            step="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Crew Count</label>
          <input
            type="number"
            value={formData.crewCount}
            onChange={(e) => setFormData({ ...formData, crewCount: Math.max(1, parseInt(e.target.value) || 1) })}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Material Cost Est.</label>
          <input
            type="number"
            value={formData.materialCostEstimate}
            onChange={(e) => setFormData({ ...formData, materialCostEstimate: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      {/* Guardrail indicators */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Guardrails</h3>
        <div className="space-y-2">
          <StatusBadge
            label="Painter Labor"
            value={laborPct}
            floor={thresholds.labor_min_pct}
            ceiling={thresholds.labor_max_pct}
          />
          <StatusBadge
            label="Materials"
            value={materialPct}
            floor={thresholds.materials_min_pct}
            ceiling={thresholds.materials_max_pct}
          />
          <StatusBadge
            label="Gross Profit Margin"
            value={profitPct}
            floor={thresholds.min_profit_margin_pct}
            ceiling={thresholds.profit_max_pct}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Labor Cost:</span>
          <span className="font-semibold">${laborCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">COGS (Labor + Materials):</span>
          <span className="font-semibold">${(laborCost + formData.materialCostEstimate).toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-semibold">
          <span>Est. Gross Profit:</span>
          <span className={profitPct >= thresholds.min_profit_margin_pct ? 'text-green-700' : 'text-red-700'}>
            ${(formData.totalPrice - laborCost - formData.materialCostEstimate).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className={`rounded-lg p-3 text-center font-semibold ${
        marginStatus === 'pass'
          ? 'bg-green-50 text-green-700'
          : marginStatus === 'warning'
            ? 'bg-yellow-50 text-yellow-700'
            : 'bg-red-50 text-red-700'
      }`}>
        {marginStatus === 'pass' && '✓ Good to quote'}
        {marginStatus === 'warning' && '⚠ Caution — review thresholds'}
        {marginStatus === 'fail' && '✗ Cannot quote — exceeds thresholds'}
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : quoteMode ? 'Save Quote' : 'Save Estimate'}
      </button>
    </div>
  )
}
