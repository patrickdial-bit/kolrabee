'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DOOR_KNOCK_OUTCOMES,
  doorKnockOutcomeMeta,
  isDoorContact,
  type DoorKnock,
  type DoorKnockOutcome,
} from '@/lib/types'
import { logDoorKnock, deleteDoorKnock } from '@/app/[slug]/projects/[id]/door-knock-actions'

interface Props {
  slug: string
  projectId: string
  knocks: DoorKnock[] // most recent first
}

// Best-effort GPS capture at tap time — never blocks logging if the device
// denies or times out; the knock just goes in without a pin.
function captureLocation(timeoutMs = 6000): Promise<{ latitude: number | null; longitude: number | null }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ latitude: null, longitude: null })
      return
    }
    let settled = false
    const finish = (coords: { latitude: number | null; longitude: number | null }) => {
      if (settled) return
      settled = true
      resolve(coords)
    }
    const timer = setTimeout(() => finish({ latitude: null, longitude: null }), timeoutMs)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        finish({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      },
      () => {
        clearTimeout(timer)
        finish({ latitude: null, longitude: null })
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    )
  })
}

export default function DoorKnockPanel({ slug, projectId, knocks }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingOutcome, setPendingOutcome] = useState<DoorKnockOutcome | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [notes, setNotes] = useState('')
  const [address, setAddress] = useState('')

  const today = useMemo(() => {
    const todayKey = new Date().toDateString()
    const todays = knocks.filter((k) => new Date(k.knocked_at).toDateString() === todayKey)
    const contacts = todays.filter((k) => isDoorContact(k.outcome)).length
    const leads = todays.filter((k) => k.outcome === 'lead' || k.outcome === 'appointment').length
    const sales = todays.filter((k) => k.outcome === 'sale').length
    const byOutcome = new Map<DoorKnockOutcome, number>()
    for (const k of todays) byOutcome.set(k.outcome, (byOutcome.get(k.outcome) ?? 0) + 1)
    return { count: todays.length, contacts, leads, sales, byOutcome }
  }, [knocks])

  function handleLog(outcome: DoorKnockOutcome) {
    setPendingOutcome(outcome)
    startTransition(async () => {
      const location = await captureLocation()
      const result = await logDoorKnock(slug, projectId, {
        outcome,
        notes: notes || undefined,
        address: address || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
      })
      if (result?.error) {
        toast.error(result.error)
      } else {
        const meta = doorKnockOutcomeMeta(outcome)
        toast.success(`Logged: ${meta.label}${location.latitude ? ' (pinned)' : ''}`)
        setNotes('')
        setAddress('')
        setShowDetails(false)
        router.refresh()
      }
      setPendingOutcome(null)
    })
  }

  function handleUndo(knockId: string) {
    startTransition(async () => {
      const result = await deleteDoorKnock(slug, knockId)
      if (result?.error) toast.error(result.error)
      else {
        toast.success('Entry removed.')
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      {/* Today's tally */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-bold text-gray-900">
          {today.count} door{today.count === 1 ? '' : 's'} today
        </p>
        <p className="text-xs text-gray-600">
          {today.contacts} contact{today.contacts === 1 ? '' : 's'} · {today.leads} lead
          {today.leads === 1 ? '' : 's'} · {today.sales} sale{today.sales === 1 ? '' : 's'}
        </p>
      </div>

      {/* One-tap outcome buttons */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DOOR_KNOCK_OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => handleLog(o.value)}
            disabled={isPending}
            className={`rounded-md px-2 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${o.buttonClass}`}
          >
            {pendingOutcome === o.value ? 'Logging…' : o.label}
            {today.byOutcome.get(o.value) ? (
              <span className="ml-1 opacity-70">({today.byOutcome.get(o.value)})</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Optional note/address for the next knock */}
      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="mt-2 text-xs font-medium text-gray-600 hover:text-gray-800"
      >
        {showDetails ? 'Hide note' : '+ Add note / address to next log'}
      </button>
      {showDetails && (
        <div className="mt-2 space-y-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="House address (optional)"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400"
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note — e.g. call back after 5pm (optional)"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400"
          />
        </div>
      )}

      {/* Recent knocks with undo */}
      {knocks.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Recent</p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {knocks.slice(0, 8).map((k) => {
              const meta = doorKnockOutcomeMeta(k.outcome)
              return (
                <li key={k.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: meta.pinColor }}
                    />
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
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUndo(k.id)}
                    disabled={isPending}
                    className="flex-shrink-0 text-[11px] font-medium text-gray-400 hover:text-red-600 disabled:opacity-50"
                  >
                    Undo
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
