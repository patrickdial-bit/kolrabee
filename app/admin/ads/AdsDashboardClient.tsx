'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import AdsTestingBanner from '@/components/AdsTestingBanner'
import {
  AD_RUN_STEPS,
  type AdBrandKit,
  type AdComplianceStatus,
  type AdGenerationRun,
  type AdRunStatus,
} from '@/lib/types'

interface Props {
  companyName: string
  complianceStatus: AdComplianceStatus
  monthlyRunLimit: number
  runsThisMonth: number
  brandKit: AdBrandKit | null
  runs: AdGenerationRun[]
}

const ACTIVE: AdRunStatus[] = ['queued', 'scraping', 'synthesizing', 'generating_images', 'writing_copy']

const statusLabel: Record<AdRunStatus, string> = {
  queued: 'Queued',
  scraping: 'Researching competitors',
  synthesizing: 'Synthesizing angles',
  generating_images: 'Generating imagery',
  writing_copy: 'Writing copy',
  ready_for_review: 'Ready for review',
  failed: 'Failed',
}

export default function AdsDashboardClient({
  companyName,
  complianceStatus,
  monthlyRunLimit,
  runsThisMonth,
  brandKit,
  runs: initialRuns,
}: Props) {
  const router = useRouter()
  const [runs, setRuns] = useState(initialRuns)
  const [activeRunId, setActiveRunId] = useState<string | null>(
    initialRuns.find((r) => ACTIVE.includes(r.status))?.id ?? null
  )
  const [activeStatus, setActiveStatus] = useState<AdRunStatus | null>(
    initialRuns.find((r) => ACTIVE.includes(r.status))?.status ?? null
  )
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const brandKitReady = !!brandKit?.brand_name
  const limitReached = runsThisMonth >= monthlyRunLimit
  const canGenerate = brandKitReady && !limitReached && !activeRunId && !starting

  const poll = useCallback(
    async (runId: string) => {
      try {
        const res = await fetch(`/api/ads/runs/${runId}`)
        if (!res.ok) return
        const { run } = (await res.json()) as { run: AdGenerationRun }
        setActiveStatus(run.status)
        setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)))
        if (run.status === 'ready_for_review') {
          if (pollRef.current) clearInterval(pollRef.current)
          router.push(`/admin/ads/runs/${run.id}`)
        } else if (run.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current)
          setActiveRunId(null)
          setError(run.error_message || 'Generation failed.')
        }
      } catch {
        /* keep polling */
      }
    },
    [router]
  )

  useEffect(() => {
    if (!activeRunId) return
    poll(activeRunId)
    pollRef.current = setInterval(() => poll(activeRunId), 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeRunId, poll])

  async function generate() {
    setError(null)
    setStarting(true)
    try {
      const res = await fetch('/api/ads/runs', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not start a run.')
        setStarting(false)
        return
      }
      const run = data.run as AdGenerationRun
      setRuns((prev) => [run, ...prev])
      setActiveRunId(run.id)
      setActiveStatus(run.status)
    } catch {
      setError('Network error starting the run.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={companyName} />
      <AdsTestingBanner status={complianceStatus} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Ads Agent</h1>

        {/* Usage + generate */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {runsThisMonth} of {monthlyRunLimit} runs used this month
              </p>
              <Link href="/admin/ads/setup" className="text-sm text-ember hover:underline">
                Edit brand kit
              </Link>
            </div>
            <button
              onClick={generate}
              disabled={!canGenerate}
              className="inline-flex items-center justify-center rounded-md bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-ember/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting || activeRunId ? 'Generating…' : 'Generate weekly creative'}
            </button>
          </div>

          {!brandKitReady && (
            <p className="mt-4 text-sm text-amber-700">
              Complete your{' '}
              <Link href="/admin/ads/setup" className="font-medium underline">
                brand kit
              </Link>{' '}
              before generating.
            </p>
          )}
          {limitReached && brandKitReady && (
            <p className="mt-4 text-sm text-amber-700">Monthly run limit reached. Resets on the 1st.</p>
          )}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {activeRunId && activeStatus && <ProgressIndicator status={activeStatus} />}
        </div>

        {/* Past runs */}
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Past runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">No runs yet. Generate your first weekly creative above.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-900">
                <tr>
                  {['Date', 'Status', 'Generated', 'Approved', 'Exported', 'Cost'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/ads/runs/${run.id}`)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(run.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{run.concepts_generated}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{run.concepts_approved}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{run.concepts_exported}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      ${(run.total_cost_cents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

function ProgressIndicator({ status }: { status: AdRunStatus }) {
  const currentIndex = AD_RUN_STEPS.findIndex((s) => s.status === status)
  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <p className="text-sm font-medium text-gray-900 mb-4">{statusLabel[status]}…</p>
      <ol className="space-y-2">
        {AD_RUN_STEPS.map((step, i) => {
          const done = currentIndex > i
          const active = currentIndex === i
          return (
            <li key={step.status} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? 'bg-green-500 text-white'
                    : active
                    ? 'bg-ember text-white animate-pulse'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className={active ? 'text-gray-900 font-medium' : done ? 'text-gray-600' : 'text-gray-400'}>
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-xs text-gray-400">This usually takes 3–8 minutes. You can leave this page open.</p>
    </div>
  )
}

const badgeColors: Record<AdRunStatus, string> = {
  queued: 'bg-gray-100 text-gray-700',
  scraping: 'bg-blue-100 text-blue-700',
  synthesizing: 'bg-blue-100 text-blue-700',
  generating_images: 'bg-blue-100 text-blue-700',
  writing_copy: 'bg-blue-100 text-blue-700',
  ready_for_review: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

function StatusBadge({ status }: { status: AdRunStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColors[status]}`}>
      {statusLabel[status]}
    </span>
  )
}
