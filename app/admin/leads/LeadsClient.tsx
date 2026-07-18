'use client'

import React, { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import Tooltip from '@/components/Tooltip'
import {
  MK_LEAD_SOURCE_LABELS,
  MK_LEAD_STATUS_LABELS,
  mkLeadName,
  type MkCampaign,
  type MkLead,
  type MkLeadEvent,
  type MkLeadStatus,
} from '@/lib/types'
import type { AttributedProject } from './page'
import {
  addLeadNote,
  convertLeadToProject,
  createCampaign,
  updateCampaignSpend,
  updateCampaignStatus,
  updateLeadStatus,
} from './actions'

interface Props {
  tenantSlug: string
  leads: MkLead[]
  campaigns: MkCampaign[]
  events: MkLeadEvent[]
  projects: AttributedProject[]
}

const STATUS_BADGE: Record<MkLeadStatus, string> = {
  new: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-indigo-100 text-indigo-700',
  booked: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-gray-100 text-gray-500',
}

function scoreColor(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-500'
  if (score >= 80) return 'bg-emerald-100 text-emerald-700'
  if (score >= 60) return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-600'
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

export default function LeadsClient({ tenantSlug, leads, campaigns, events, projects }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<'all' | MkLeadStatus>('all')
  const [expandedLead, setExpandedLead] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [showAddCampaign, setShowAddCampaign] = useState(false)
  const [spendDrafts, setSpendDrafts] = useState<Record<string, string>>({})
  const [showEndpointHelp, setShowEndpointHelp] = useState(false)

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const campaignById = useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns])
  const eventsByLead = useMemo(() => {
    const map = new Map<string, MkLeadEvent[]>()
    for (const e of events) {
      const list = map.get(e.lead_id)
      if (list) list.push(e)
      else map.set(e.lead_id, [e])
    }
    return map
  }, [events])

  // Attribution rollups — the spec's headline number is ROAS on COLLECTED
  // revenue (jobs at status 'paid'), not form fills.
  const summary = useMemo(() => {
    const booked = leads.filter((l) => l.status === 'booked')
    const collected = booked.reduce((sum, l) => {
      const p = l.project_id ? projectById.get(l.project_id) : undefined
      return p && p.status === 'paid' && p.revenue_amount != null ? sum + Number(p.revenue_amount) : sum
    }, 0)
    const bookedRevenue = booked.reduce((sum, l) => {
      const p = l.project_id ? projectById.get(l.project_id) : undefined
      return p && p.revenue_amount != null ? sum + Number(p.revenue_amount) : sum
    }, 0)
    const spend = campaigns.reduce((sum, c) => sum + Number(c.spend_to_date ?? 0), 0)
    return {
      total: leads.length,
      newCount: leads.filter((l) => l.status === 'new').length,
      qualified: leads.filter((l) => l.status === 'qualified').length,
      booked: booked.length,
      collected,
      bookedRevenue,
      spend,
      roas: spend > 0 ? collected / spend : null,
      cpl: spend > 0 && leads.length > 0 ? spend / leads.length : null,
    }
  }, [leads, campaigns, projectById])

  const campaignRollups = useMemo(() => {
    return campaigns.map((c) => {
      const campaignLeads = leads.filter((l) => l.campaign_id === c.id)
      const bookedLeads = campaignLeads.filter((l) => l.status === 'booked')
      const collected = bookedLeads.reduce((sum, l) => {
        const p = l.project_id ? projectById.get(l.project_id) : undefined
        return p && p.status === 'paid' && p.revenue_amount != null ? sum + Number(p.revenue_amount) : sum
      }, 0)
      const spend = Number(c.spend_to_date ?? 0)
      return {
        campaign: c,
        leads: campaignLeads.length,
        booked: bookedLeads.length,
        collected,
        roas: spend > 0 ? collected / spend : null,
        cpl: spend > 0 && campaignLeads.length > 0 ? spend / campaignLeads.length : null,
      }
    })
  }, [campaigns, leads, projectById])

  const visibleLeads = useMemo(
    () => (statusFilter === 'all' ? leads : leads.filter((l) => l.status === statusFilter)),
    [leads, statusFilter]
  )

  function handleStatusChange(leadId: string, status: MkLeadStatus) {
    startTransition(async () => {
      const result = await updateLeadStatus(leadId, status)
      if (result?.error) toast.error(result.error)
      else {
        toast.success(`Lead marked ${MK_LEAD_STATUS_LABELS[status].toLowerCase()}.`)
        router.refresh()
      }
    })
  }

  function handleConvert(leadId: string) {
    startTransition(async () => {
      const result = await convertLeadToProject(leadId)
      if (result?.error) toast.error(result.error)
      else {
        toast.success('Job created from lead.')
        router.refresh()
      }
    })
  }

  function handleAddNote(leadId: string) {
    if (!noteDraft.trim()) return
    startTransition(async () => {
      const result = await addLeadNote(leadId, noteDraft)
      if (result?.error) toast.error(result.error)
      else {
        toast.success('Note added.')
        setNoteDraft('')
        router.refresh()
      }
    })
  }

  function handleCreateCampaign(formData: FormData) {
    startTransition(async () => {
      const result = await createCampaign(formData)
      if (result?.error) toast.error(result.error)
      else {
        toast.success('Campaign added.')
        setShowAddCampaign(false)
        router.refresh()
      }
    })
  }

  function handleSaveSpend(campaignId: string) {
    const raw = spendDrafts[campaignId]
    if (raw === undefined) return
    const value = parseFloat(raw)
    startTransition(async () => {
      const result = await updateCampaignSpend(campaignId, value)
      if (result?.error) toast.error(result.error)
      else {
        toast.success('Spend updated.')
        setSpendDrafts((prev) => {
          const next = { ...prev }
          delete next[campaignId]
          return next
        })
        router.refresh()
      }
    })
  }

  function handleCampaignStatus(campaignId: string, status: string) {
    startTransition(async () => {
      const result = await updateCampaignStatus(campaignId, status)
      if (result?.error) toast.error(result.error)
      else router.refresh()
    })
  }

  const captureSnippet = `POST ${typeof window !== 'undefined' ? window.location.origin : ''}/api/leads
Content-Type: application/json

{
  "tenant": "${tenantSlug}",
  "name": "Jane Smith",
  "phone": "614-555-0100",
  "email": "jane@example.com",
  "address": "123 Main St, Columbus, OH",
  "service": "Interior painting",
  "message": "Looking for a quote on 3 bedrooms",
  "utm_campaign": "spring-paint-2026",
  "fbclid": "...", "gclid": "..."
}`

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every lead traced from click to collected revenue.
          </p>
        </div>
        <button
          onClick={() => setShowEndpointHelp((v) => !v)}
          className="mt-4 sm:mt-0 rounded-md bg-white border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {showEndpointHelp ? 'Hide' : 'Connect a form'}
        </button>
      </div>

      {showEndpointHelp && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">Send leads from any form</p>
          <p className="text-xs text-gray-600 mb-3">
            Point your landing page, website form, or a Zapier/Make step (e.g. relaying Meta lead
            forms) at this endpoint. Include <code className="rounded bg-gray-100 px-1">fbclid</code>/
            <code className="rounded bg-gray-100 px-1">gclid</code> and{' '}
            <code className="rounded bg-gray-100 px-1">utm_campaign</code> so leads attach to the right
            campaign automatically.
          </p>
          <pre className="overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-emerald-300">{captureSnippet}</pre>
        </div>
      )}

      {/* Attribution summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <Stat label="Leads" value={String(summary.total)} sub={`${summary.newCount} new`} />
        <Stat label="Booked jobs" value={String(summary.booked)} sub={`${summary.qualified} qualified waiting`} />
        <Stat
          label="Collected revenue"
          value={formatCurrency(summary.collected)}
          sub={summary.bookedRevenue > summary.collected ? `${formatCurrency(summary.bookedRevenue)} booked` : 'from paid jobs'}
        />
        <Stat
          label="ROAS"
          value={summary.roas !== null ? `${summary.roas.toFixed(1)}×` : '—'}
          sub={
            summary.spend > 0
              ? `${formatCurrency(summary.spend)} spend${summary.cpl !== null ? ` · ${formatCurrency(summary.cpl)}/lead` : ''}`
              : 'add campaign spend below'
          }
        />
      </div>

      {/* Campaigns */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Campaigns</h2>
          <button
            onClick={() => setShowAddCampaign((v) => !v)}
            className="text-sm font-medium text-ember hover:text-primary-700"
          >
            {showAddCampaign ? 'Cancel' : '+ Add campaign'}
          </button>
        </div>

        {showAddCampaign && (
          <form action={handleCreateCampaign} className="grid grid-cols-1 gap-3 border-b border-gray-200 bg-gray-50 px-4 py-4 sm:grid-cols-4">
            <input
              name="name"
              required
              placeholder="Campaign name"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <select name="channel" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
              <option value="meta">Meta (FB/IG)</option>
              <option value="google">Google</option>
              <option value="other">Other</option>
            </select>
            <input
              name="utm_campaign"
              placeholder="utm_campaign to match (optional)"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                name="monthly_budget"
                type="number"
                min="0"
                step="0.01"
                placeholder="Monthly budget $"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {campaignRollups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No campaigns yet. Add the campaign you&apos;re running (e.g. your Meta campaign) and keep
            its spend up to date — that&apos;s what turns lead counts into CPL and ROAS.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Campaign</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Spend to date</th>
                  <th className="px-4 py-2 text-right">Leads</th>
                  <th className="px-4 py-2 text-right">CPL</th>
                  <th className="px-4 py-2 text-right">Booked</th>
                  <th className="px-4 py-2 text-right">Collected</th>
                  <th className="px-4 py-2 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaignRollups.map(({ campaign, leads: leadCount, booked, collected, roas, cpl }) => (
                  <tr key={campaign.id}>
                    <td className="px-4 py-2">
                      <p className="font-medium text-gray-900">{campaign.name}</p>
                      <p className="text-xs text-gray-500">
                        {campaign.channel === 'meta' ? 'Meta' : campaign.channel === 'google' ? 'Google' : 'Other'}
                        {campaign.utm_campaign ? ` · utm: ${campaign.utm_campaign}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={campaign.status}
                        onChange={(e) => handleCampaignStatus(campaign.id, e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="ended">Ended</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-gray-400">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={spendDrafts[campaign.id] ?? String(campaign.spend_to_date ?? 0)}
                          onChange={(e) =>
                            setSpendDrafts((prev) => ({ ...prev, [campaign.id]: e.target.value }))
                          }
                          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-xs tabular-nums"
                        />
                        {spendDrafts[campaign.id] !== undefined && (
                          <button
                            onClick={() => handleSaveSpend(campaign.id)}
                            disabled={isPending}
                            className="rounded bg-ember px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{leadCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{cpl !== null ? formatCurrency(cpl) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{booked}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(collected)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {roas !== null ? `${roas.toFixed(1)}×` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lead status filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(['all', 'new', 'contacted', 'qualified', 'booked', 'lost'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-gray-900 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? 'All' : MK_LEAD_STATUS_LABELS[s]}
            <span className="ml-1 opacity-70">
              {s === 'all' ? leads.length : leads.filter((l) => l.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {/* Leads table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Lead</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Service</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Source</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Score</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visibleLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                  No leads here yet. Use &quot;Connect a form&quot; above to wire up your landing page or
                  Meta campaign.
                </td>
              </tr>
            ) : (
              visibleLeads.map((lead) => {
                const expanded = expandedLead === lead.id
                const project = lead.project_id ? projectById.get(lead.project_id) : undefined
                const campaign = lead.campaign_id ? campaignById.get(lead.campaign_id) : undefined
                const leadEvents = eventsByLead.get(lead.id) ?? []
                return (
                  <React.Fragment key={lead.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{mkLeadName(lead)}</p>
                        <p className="text-xs text-gray-500">
                          {[lead.phone, lead.email].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{lead.service_requested ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {MK_LEAD_SOURCE_LABELS[lead.source]}
                        {campaign && <p className="text-xs text-gray-400">{campaign.name}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Tooltip
                          text={
                            lead.score_reasons?.map((r) => `${r.label} +${r.points}`).join(' · ') ||
                            'No score breakdown'
                          }
                        >
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(lead.score)}`}
                          >
                            {lead.score ?? '—'}
                          </span>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[lead.status]}`}
                        >
                          {MK_LEAD_STATUS_LABELS[lead.status]}
                        </span>
                        {project && (
                          <Link
                            href={`/admin/projects/${project.id}`}
                            className="ml-2 text-xs font-medium text-ember hover:text-primary-700"
                          >
                            {project.job_number ? `#${project.job_number}` : 'View job'}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {lead.status !== 'booked' && lead.status !== 'lost' && (
                          <button
                            onClick={() => handleConvert(lead.id)}
                            disabled={isPending}
                            className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Create job
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setExpandedLead(expanded ? null : lead.id)
                            setNoteDraft('')
                          }}
                          className="ml-1 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                        >
                          {expanded ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50 px-4 py-4">
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div className="space-y-2 text-sm">
                              {lead.address && (
                                <p className="text-gray-700"><span className="font-medium">Address:</span> {lead.address}</p>
                              )}
                              {lead.message && (
                                <p className="whitespace-pre-wrap text-gray-700"><span className="font-medium">Message:</span> {lead.message}</p>
                              )}
                              <p className="text-xs text-gray-500">
                                Received {new Date(lead.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                {lead.utm_campaign ? ` · utm: ${lead.utm_campaign}` : ''}
                                {lead.fbclid ? ' · fbclid ✓' : ''}
                                {lead.gclid ? ' · gclid ✓' : ''}
                              </p>
                              <div className="flex items-center gap-2 pt-1">
                                <label className="text-xs font-medium text-gray-500">Set status:</label>
                                <select
                                  value={lead.status}
                                  onChange={(e) => handleStatusChange(lead.id, e.target.value as MkLeadStatus)}
                                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                                >
                                  {(['new', 'contacted', 'qualified', 'booked', 'lost'] as const).map((s) => (
                                    <option key={s} value={s}>{MK_LEAD_STATUS_LABELS[s]}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="text"
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                  placeholder="Add a note…"
                                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                                />
                                <button
                                  onClick={() => handleAddNote(lead.id)}
                                  disabled={isPending || !noteDraft.trim()}
                                  className="rounded-md bg-gray-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Timeline</p>
                              <ul className="space-y-1">
                                {leadEvents.map((e) => (
                                  <li key={e.id} className="text-xs text-gray-600">
                                    <span className="text-gray-400">
                                      {new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </span>{' '}
                                    — {e.detail ?? e.event_type}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
