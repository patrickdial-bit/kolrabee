'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Tooltip from '@/components/Tooltip'
import { projectCampaignResults } from '@/lib/marketing'
import { addCompetitor, addCompetitorAd, createScrapeRun } from './actions'

type Competitor = {
  id: string
  name: string
  geography: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  ad_activity: boolean
  score: number | null
  score_reasons: Array<{ label: string; points: number }> | null
  refreshed_at: string | null
}
type Ad = {
  id: string
  competitor_id: string
  platform: string
  theme: string | null
  pattern_summary: string | null
  first_seen: string | null
  last_seen: string | null
  run_days: number | null
  library_url: string | null
}
type Policy = { source_key: string; display_name: string; status: string; basis: string; requires_login: boolean }
type Run = { id: string; source_key: string; geography: string; cadence: string; status: string; items_found: number; cost_cents: number; last_run_at: string | null; created_at: string }
type Benchmark = { trade: string; metro: string; cpl_low: number; cpl_high: number; source: string; year: number | null }

interface Props {
  competitors: Competitor[]
  ads: Ad[]
  policies: Policy[]
  runs: Run[]
  benchmarks: Benchmark[]
}

const POLICY_BADGE: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-800',
  blocked: 'bg-red-100 text-red-700',
}

export default function MarketClient({ competitors, ads, policies, runs, benchmarks }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAddCompetitor, setShowAddCompetitor] = useState(competitors.length === 0)
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null)
  const [budgetDraft, setBudgetDraft] = useState('900')

  const adsByCompetitor = useMemo(() => {
    const map = new Map<string, Ad[]>()
    for (const ad of ads) {
      const list = map.get(ad.competitor_id)
      if (list) list.push(ad)
      else map.set(ad.competitor_id, [ad])
    }
    return map
  }, [ads])

  const benchmark = benchmarks.find((b) => b.trade === 'landscaping') ?? benchmarks[0]
  const projection = useMemo(() => {
    const budget = parseFloat(budgetDraft) || 0
    if (!benchmark || budget <= 0) return null
    return projectCampaignResults({
      monthlyBudget: budget,
      cplLow: Number(benchmark.cpl_low),
      cplHigh: Number(benchmark.cpl_high),
    })
  }, [budgetDraft, benchmark])

  function submit(action: (fd: FormData) => Promise<{ error?: string } | { success: boolean }>, done?: () => void) {
    return (formData: FormData) =>
      startTransition(async () => {
        const result = await action(formData)
        if (result && 'error' in result && result.error) toast.error(result.error)
        else {
          toast.success('Saved.')
          done?.()
          router.refresh()
        }
      })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Market Intelligence</h1>
        <p className="mt-1 text-sm text-gray-500">
          Competitors, their longest-running ads, and cost baselines — public data sources only, gated per source.
        </p>
      </div>

      {/* Budget projector */}
      {benchmark && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900 mb-2">Budget → projected leads</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Monthly budget $
              <input
                type="number" min="0" step="50" value={budgetDraft}
                onChange={(e) => setBudgetDraft(e.target.value)}
                className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            {projection && (
              <p className="text-sm text-gray-900">
                ≈ <strong>{projection.leadsLow}–{projection.leadsHigh} leads/month</strong>
                <span className="ml-2 text-xs text-gray-500">
                  (benchmark CPL ${Number(benchmark.cpl_low)}–${Number(benchmark.cpl_high)}, {benchmark.trade})
                </span>
              </p>
            )}
          </div>
          {projection && <p className="mt-1 text-xs text-gray-400">{projection.assumptions}</p>}
        </div>
      )}

      {/* Competitors */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Competitors ({competitors.length})</h2>
          <button onClick={() => setShowAddCompetitor((v) => !v)} className="text-sm font-medium text-ember hover:text-primary-700">
            {showAddCompetitor ? 'Cancel' : '+ Add competitor'}
          </button>
        </div>
        {showAddCompetitor && (
          <form action={submit(addCompetitor, () => setShowAddCompetitor(false))} className="grid grid-cols-2 gap-3 border-b border-gray-200 bg-gray-50 px-4 py-4 sm:grid-cols-6">
            <input name="name" required placeholder="Company name" className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input name="geography" placeholder="Geography (Columbus, OH)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input name="website" placeholder="Website" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input name="rating" type="number" min="0" max="5" step="0.1" placeholder="Rating" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <div className="flex items-center gap-2">
              <input name="review_count" type="number" min="0" placeholder="Reviews" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                <input type="checkbox" name="ad_activity" /> ads
              </label>
              <button type="submit" disabled={isPending} className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
            </div>
          </form>
        )}
        <ul className="divide-y divide-gray-100">
          {competitors.length === 0 ? (
            <li className="px-4 py-6 text-sm text-gray-500">
              No competitors yet. Add them manually now; approved-source scrape runs will populate this automatically
              once the Meta Ad Library app review and Places API key are in place.
            </li>
          ) : (
            competitors.map((c) => {
              const compAds = adsByCompetitor.get(c.id) ?? []
              const expanded = expandedCompetitor === c.id
              return (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {c.name}
                        {c.ad_activity && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">advertising</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[c.geography, c.rating != null ? `${c.rating}★` : null, c.review_count != null ? `${c.review_count} reviews` : null]
                          .filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tooltip text={c.score_reasons?.map((r) => `${r.label} +${r.points}`).join(' · ') || 'No breakdown'}>
                        <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-bold text-white">{c.score ?? '—'}</span>
                      </Tooltip>
                      <button
                        onClick={() => setExpandedCompetitor(expanded ? null : c.id)}
                        className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        {expanded ? 'Hide ads' : `Ads (${compAds.length})`}
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-3 rounded-md bg-gray-50 p-3">
                      <ul className="space-y-1 mb-3">
                        {compAds.length === 0 ? (
                          <li className="text-xs text-gray-500">No ad observations yet.</li>
                        ) : (
                          compAds.map((ad) => (
                            <li key={ad.id} className="text-xs text-gray-700">
                              <span className="font-semibold">{ad.theme ?? 'Untitled theme'}</span>
                              {' · '}{ad.platform}
                              {ad.run_days != null && <span className={ad.run_days >= 60 ? ' font-semibold text-emerald-700' : ''}> · running {ad.run_days}d{ad.run_days >= 60 ? ' (presumed converting)' : ''}</span>}
                              {ad.pattern_summary && <span className="text-gray-500"> — {ad.pattern_summary}</span>}
                              {ad.library_url && (
                                <a href={ad.library_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-ember hover:underline">library ↗</a>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                      <form action={submit((fd) => addCompetitorAd(c.id, fd))} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                        <select name="platform" className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs">
                          <option value="meta">Meta</option><option value="google">Google</option><option value="other">Other</option>
                        </select>
                        <input name="theme" placeholder="Theme (e.g. financing offer)" className="rounded-md border border-gray-300 px-2 py-1 text-xs" />
                        <input name="first_seen" type="date" className="rounded-md border border-gray-300 px-2 py-1 text-xs" />
                        <input name="last_seen" type="date" className="rounded-md border border-gray-300 px-2 py-1 text-xs" />
                        <input name="library_url" placeholder="Ad library URL" className="rounded-md border border-gray-300 px-2 py-1 text-xs" />
                        <div className="flex gap-2">
                          <input name="pattern_summary" placeholder="Pattern (not verbatim copy)" className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs" />
                          <button type="submit" disabled={isPending} className="rounded-md bg-gray-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">Add</button>
                        </div>
                      </form>
                      <p className="mt-1 text-[11px] text-gray-400">
                        Record structure and patterns only — competitor creative is never copied verbatim into generated campaigns.
                      </p>
                    </div>
                  )}
                </li>
              )
            })
          )}
        </ul>
      </div>

      {/* Scrape runs + source policy gate */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Scrape runs</h2>
          </div>
          <form action={submit(createScrapeRun)} className="flex flex-wrap gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <select name="source_key" className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs">
              {policies.filter((p) => p.status === 'approved').map((p) => (
                <option key={p.source_key} value={p.source_key}>{p.display_name}</option>
              ))}
            </select>
            <input name="geography" required placeholder="Geography (Columbus, OH)" className="rounded-md border border-gray-300 px-2 py-1.5 text-xs" />
            <select name="cadence" className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs">
              <option value="weekly">Weekly</option><option value="daily">Daily</option><option value="monthly">Monthly</option><option value="once">Once</option>
            </select>
            <button type="submit" disabled={isPending} className="rounded-md bg-ember px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Queue run</button>
          </form>
          <ul className="divide-y divide-gray-100">
            {runs.length === 0 ? (
              <li className="px-4 py-4 text-xs text-gray-500">No runs yet. Runs queue here; the worker fleet picks them up as connectors come online (Meta Ad Library pending app review).</li>
            ) : (
              runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-2 text-xs">
                  <span className="text-gray-700">{policies.find((p) => p.source_key === r.source_key)?.display_name ?? r.source_key} · {r.geography} · {r.cadence}</span>
                  <span className="text-gray-500">{r.status} · {r.items_found} items · ${(r.cost_cents / 100).toFixed(2)}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Source policy gate</h2>
            <p className="text-xs text-gray-500">Every source needs a written policy before a scraper may touch it. Blocked sources cannot be queued.</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {policies.map((p) => (
              <li key={p.source_key} className="px-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-900">{p.display_name}{p.requires_login ? ' 🔒' : ''}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${POLICY_BADGE[p.status] ?? 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                </div>
                <p className="text-[11px] text-gray-500">{p.basis}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
