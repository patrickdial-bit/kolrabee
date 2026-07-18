'use client'

// DoorActivityPanel — admin view of a door-to-door rep's canvassing activity:
// headline stats (knocks, contact rate, leads, knocks/hr), colored outcome
// pins on a map for GPS-stamped knocks, and the recent knock log.

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import {
  DOOR_KNOCK_OUTCOMES,
  doorKnockOutcomeMeta,
  isDoorContact,
  type DoorKnock,
} from '@/lib/types'
import { formatMinutes } from '@/lib/time-tracking'
import { formatCurrency } from '@/lib/utils'
import type { MapPoint } from '@/components/JobsMap'

const JobsMap = dynamic(() => import('@/components/JobsMap'), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-gray-100" />,
})

interface Props {
  knocks: DoorKnock[] // latest first
  clockedMinutes: number
  hourlyRate: number | null
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

export default function DoorActivityPanel({ knocks, clockedMinutes, hourlyRate }: Props) {
  const stats = useMemo(() => {
    const total = knocks.length
    const contacts = knocks.filter((k) => isDoorContact(k.outcome)).length
    const leads = knocks.filter((k) => k.outcome === 'lead' || k.outcome === 'appointment').length
    const sales = knocks.filter((k) => k.outcome === 'sale').length
    const todayKey = new Date().toDateString()
    const today = knocks.filter((k) => new Date(k.knocked_at).toDateString() === todayKey).length
    const hours = clockedMinutes / 60
    const byOutcome = new Map<string, number>()
    for (const k of knocks) byOutcome.set(k.outcome, (byOutcome.get(k.outcome) ?? 0) + 1)
    return {
      total,
      today,
      contactRate: total > 0 ? Math.round((contacts / total) * 100) : null,
      leads,
      sales,
      knocksPerHour: hours > 0 ? (total / hours).toFixed(1) : null,
      earned: hourlyRate != null ? (clockedMinutes / 60) * hourlyRate : null,
      byOutcome,
    }
  }, [knocks, clockedMinutes, hourlyRate])

  const points: MapPoint[] = useMemo(
    () =>
      knocks
        .filter((k) => k.latitude != null && k.longitude != null)
        .map((k) => {
          const meta = doorKnockOutcomeMeta(k.outcome)
          return {
            id: k.id,
            lat: k.latitude as number,
            lng: k.longitude as number,
            title: meta.label,
            subtitle: k.address ?? undefined,
            detail:
              new Date(k.knocked_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }) + (k.notes ? ` — ${k.notes}` : ''),
            color: meta.pinColor,
          }
        }),
    [knocks]
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Doors knocked" value={String(stats.total)} sub={`${stats.today} today`} />
        <Stat
          label="Contact rate"
          value={stats.contactRate !== null ? `${stats.contactRate}%` : '—'}
          sub="answered ÷ knocked"
        />
        <Stat label="Leads" value={String(stats.leads)} sub={`${stats.sales} sale${stats.sales === 1 ? '' : 's'}`} />
        <Stat
          label="Knocks / hour"
          value={stats.knocksPerHour ?? '—'}
          sub={`${formatMinutes(clockedMinutes)} on the clock`}
        />
      </div>

      {stats.earned !== null && (
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{formatCurrency(stats.earned)}</span> earned so far
          {hourlyRate != null ? ` (${formatMinutes(clockedMinutes)} × ${formatCurrency(hourlyRate)}/hr)` : ''}
        </p>
      )}

      {/* Outcome legend with counts */}
      <div className="flex flex-wrap gap-2">
        {DOOR_KNOCK_OUTCOMES.map((o) => (
          <span
            key={o.value}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.pinColor }} />
            {o.label}
            <span className="font-semibold">{stats.byOutcome.get(o.value) ?? 0}</span>
          </span>
        ))}
      </div>

      {points.length > 0 && (
        <div className="h-64 overflow-hidden rounded-lg border border-gray-200">
          <JobsMap points={points} />
        </div>
      )}

      {knocks.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Recent doors</p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {knocks.slice(0, 15).map((k) => {
              const meta = doorKnockOutcomeMeta(k.outcome)
              return (
                <li key={k.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: meta.pinColor }} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-gray-900">
                      {meta.label}
                      {k.address ? <span className="ml-1 font-normal text-gray-500">· {k.address}</span> : null}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {new Date(k.knocked_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {k.notes ? ` · ${k.notes}` : ''}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No doors logged yet.</p>
      )}
    </div>
  )
}
