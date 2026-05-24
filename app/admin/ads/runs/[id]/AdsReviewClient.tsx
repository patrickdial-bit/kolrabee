'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import AdminNav from '@/components/AdminNav'
import AdsTestingBanner from '@/components/AdsTestingBanner'
import {
  AD_VARIANT_LABELS,
  type AdComplianceStatus,
  type AdConcept,
  type AdConceptStatus,
  type AdGenerationRun,
} from '@/lib/types'

interface Props {
  companyName: string
  complianceStatus: AdComplianceStatus
  run: AdGenerationRun
  initialConcepts: AdConcept[]
}

export default function AdsReviewClient({ companyName, complianceStatus, run, initialConcepts }: Props) {
  const [concepts, setConcepts] = useState(initialConcepts)
  const [enlarged, setEnlarged] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const counts = useMemo(() => {
    const approved = concepts.filter((c) => c.status === 'approved').length
    const rejected = concepts.filter((c) => c.status === 'rejected').length
    return { approved, rejected, pending: concepts.length - approved - rejected }
  }, [concepts])

  async function setStatus(concept: AdConcept, status: AdConceptStatus) {
    // Toggle off if clicking the same status again.
    const next = concept.status === status ? 'draft' : status
    const prev = concept.status
    setConcepts((cs) => cs.map((c) => (c.id === concept.id ? { ...c, status: next } : c)))
    try {
      const res = await fetch(`/api/ads/concepts/${concept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setConcepts((cs) => cs.map((c) => (c.id === concept.id ? { ...c, status: prev } : c)))
    }
  }

  function downloadZip() {
    setExporting(true)
    window.location.href = `/api/ads/runs/${run.id}/export`
    setTimeout(() => setExporting(false), 4000)
  }

  const angles = (run.synthesized_angles ?? []).map((a) => a.name).join(' · ')

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AdminNav companyName={companyName} />
      <AdsTestingBanner status={complianceStatus} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin/ads" className="text-sm text-ember hover:underline">
          ← Back to Ads Agent
        </Link>

        <div className="mt-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Review concepts</h1>
          <p className="mt-1 text-sm text-gray-500">
            {new Date(run.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            {' · '}${(run.total_cost_cents / 100).toFixed(2)} cost
          </p>
          {angles && <p className="mt-1 text-sm text-gray-500">Angles: {angles}</p>}
        </div>

        {run.status === 'failed' && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Generation failed: {run.error_message || 'Unknown error.'}
          </div>
        )}

        {concepts.length === 0 ? (
          <p className="text-sm text-gray-500">No concepts yet — this run may still be generating.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {concepts.map((concept) => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                onEnlarge={() => concept.image_url && setEnlarged(concept.image_url)}
                onApprove={() => setStatus(concept, 'approved')}
                onReject={() => setStatus(concept, 'rejected')}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 border-t border-gray-200 bg-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-green-700">{counts.approved} approved</span>
            {' · '}
            <span className="text-red-600">{counts.rejected} rejected</span>
            {' · '}
            <span className="text-gray-500">{counts.pending} pending</span>
          </p>
          <button
            onClick={downloadZip}
            disabled={counts.approved === 0 || exporting}
            className="inline-flex items-center rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-ember/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? 'Preparing…' : `Download ZIP (${counts.approved})`}
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {enlarged && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8" onClick={() => setEnlarged(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enlarged} alt="concept" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}

function ConceptCard({
  concept,
  onEnlarge,
  onApprove,
  onReject,
}: {
  concept: AdConcept
  onEnlarge: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const ring =
    concept.status === 'approved'
      ? 'ring-2 ring-green-500'
      : concept.status === 'rejected'
      ? 'ring-2 ring-red-400 opacity-60'
      : 'ring-1 ring-gray-200'

  return (
    <div className={`overflow-hidden rounded-lg bg-white shadow-sm ${ring}`}>
      <button onClick={onEnlarge} className="block w-full aspect-square bg-gray-100">
        {concept.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={concept.image_url} alt={concept.angle} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">No image</div>
        )}
      </button>
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 truncate">{concept.angle}</span>
          <span className="rounded bg-ember/10 px-1.5 py-0.5 text-[10px] font-medium text-ember whitespace-nowrap">
            {AD_VARIANT_LABELS[concept.variant_type]}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-tight">{concept.headline || '—'}</p>
        <p className="mt-1 text-xs text-gray-600 leading-snug">{concept.primary_text || '—'}</p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={onApprove}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
              concept.status === 'approved' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            Approve
          </button>
          <button
            onClick={onReject}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
              concept.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
