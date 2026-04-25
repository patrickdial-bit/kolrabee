'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  clockIn as clockInLeader,
  clockOut as clockOutLeader,
  clockInCrewMember,
  clockOutCrewMember,
} from '@/app/[slug]/dashboard/time-clock-actions'
import { formatElapsed, formatMinutes } from '@/lib/time-tracking'

export type CrewMemberLite = {
  id: string
  first_name: string
  last_name: string
}

export type CrewOpenEntry = {
  id: string
  project_id: string
  clock_in: string
  crew_member_id: string | null   // null = the leader themselves
  otherProjectLabel?: string      // populated when on the clock at a different job
}

interface Props {
  slug: string
  projectId: string
  projectLabel: string
  leaderName: string
  members: CrewMemberLite[]
  openEntries: CrewOpenEntry[]
  jobTotalsByActor: Record<string, number>   // key 'leader' | crewMember.id → minutes (excluding running clock)
  compact?: boolean
}

const LEADER_KEY = 'leader'

type RowConflict = { actorKey: string; openProjectLabel: string }

function ActorRow({
  label,
  open,
  elsewhere,
  rowConflict,
  totalMinutes,
  busy,
  now,
  onIn,
  onOut,
  onCancelConflict,
}: {
  label: string
  open: CrewOpenEntry | undefined
  elsewhere: CrewOpenEntry | undefined
  rowConflict: RowConflict | null
  totalMinutes: number
  busy: boolean
  now: Date
  onIn: (force: boolean) => void
  onOut: () => void
  onCancelConflict: () => void
}) {
  const elapsed = open
    ? Math.max(0, now.getTime() - new Date(open.clock_in).getTime())
    : 0

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
        {open ? (
          <p className="font-mono text-xs text-emerald-700 tabular-nums">
            {formatElapsed(elapsed)} on the clock · {formatMinutes(totalMinutes)} total
          </p>
        ) : elsewhere ? (
          <p className="text-xs text-amber-700">
            On the clock at {elsewhere.otherProjectLabel || 'another job'} · {formatMinutes(totalMinutes)} total
          </p>
        ) : (
          <p className="text-xs text-gray-500">{formatMinutes(totalMinutes)} total</p>
        )}
      </div>

      {rowConflict ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-800 max-w-[140px] truncate">
            At {rowConflict.openProjectLabel}
          </span>
          <button
            onClick={() => onIn(true)}
            disabled={busy}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? '…' : 'Switch'}
          </button>
          <button
            onClick={onCancelConflict}
            className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      ) : open ? (
        <button
          onClick={onOut}
          disabled={busy}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? 'Clocking out…' : 'Clock Out'}
        </button>
      ) : (
        <button
          onClick={() => onIn(false)}
          disabled={busy}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? 'Clocking in…' : 'Clock In'}
        </button>
      )}
    </div>
  )
}

export default function CrewClockPanel({
  slug,
  projectId,
  projectLabel,
  leaderName,
  members,
  openEntries,
  jobTotalsByActor,
  compact = false,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingActor, setPendingActor] = useState<string | null>(null)
  const [conflict, setConflict] = useState<RowConflict | null>(null)
  const [expanded, setExpanded] = useState(!compact)
  const [now, setNow] = useState<Date>(new Date())

  // Tick every second when anyone is on the clock so elapsed times update.
  const hasOpen = openEntries.length > 0
  useEffect(() => {
    if (!hasOpen) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [hasOpen])

  // Map actorKey → open entry on THIS project (the live row), and any open
  // entry on a different project (so we can warn).
  const { openHere, openElsewhere } = useMemo(() => {
    const here = new Map<string, CrewOpenEntry>()
    const elsewhere = new Map<string, CrewOpenEntry>()
    for (const e of openEntries) {
      const key = e.crew_member_id ?? LEADER_KEY
      if (e.project_id === projectId) here.set(key, e)
      else elsewhere.set(key, e)
    }
    return { openHere: here, openElsewhere: elsewhere }
  }, [openEntries, projectId])

  // Cumulative job total to date: stored minutes + running open-here minutes for any actor.
  const totalMinutes = useMemo(() => {
    let total = 0
    for (const v of Object.values(jobTotalsByActor)) total += v
    for (const e of Array.from(openHere.values())) {
      total += Math.max(0, Math.floor((now.getTime() - new Date(e.clock_in).getTime()) / 60000))
    }
    return total
  }, [jobTotalsByActor, openHere, now])

  const onClockCount = openHere.size

  function actorMinutes(key: string): number {
    const stored = jobTotalsByActor[key] ?? 0
    const open = openHere.get(key)
    if (!open) return stored
    return stored + Math.max(0, Math.floor((now.getTime() - new Date(open.clock_in).getTime()) / 60000))
  }

  function handleClockInLeader(force = false) {
    setPendingActor(LEADER_KEY)
    startTransition(async () => {
      const result = await clockInLeader(slug, projectId, force)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else if ('conflict' in result && result.conflict) {
        setConflict({ actorKey: LEADER_KEY, openProjectLabel: result.openProjectLabel })
      } else {
        setConflict(null)
        toast.success('Clocked in.')
        router.refresh()
      }
      setPendingActor(null)
    })
  }

  function handleClockOutLeader() {
    const open = openHere.get(LEADER_KEY)
    if (!open) return
    setPendingActor(LEADER_KEY)
    startTransition(async () => {
      const result = await clockOutLeader(slug, open.id)
      if (result?.error) toast.error(result.error)
      else { toast.success('Clocked out.'); router.refresh() }
      setPendingActor(null)
    })
  }

  function handleClockInMember(member: CrewMemberLite, force = false) {
    setPendingActor(member.id)
    startTransition(async () => {
      const result = await clockInCrewMember(slug, projectId, member.id, force)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else if ('conflict' in result && result.conflict) {
        setConflict({ actorKey: member.id, openProjectLabel: result.openProjectLabel })
      } else {
        setConflict(null)
        toast.success(`${member.first_name} clocked in.`)
        router.refresh()
      }
      setPendingActor(null)
    })
  }

  function handleClockOutMember(member: CrewMemberLite) {
    const open = openHere.get(member.id)
    if (!open) return
    setPendingActor(member.id)
    startTransition(async () => {
      const result = await clockOutCrewMember(slug, open.id)
      if (result?.error) toast.error(result.error)
      else { toast.success(`${member.first_name} clocked out.`); router.refresh() }
      setPendingActor(null)
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Crew time</p>
          <p className="text-sm font-bold text-gray-900">
            {formatMinutes(totalMinutes)}
            {onClockCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                {onClockCount} on the clock
              </span>
            )}
          </p>
        </div>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 divide-y divide-gray-200 border-t border-gray-200">
          <ActorRow
            label={leaderName + ' (you)'}
            open={openHere.get(LEADER_KEY)}
            elsewhere={openElsewhere.get(LEADER_KEY)}
            rowConflict={conflict?.actorKey === LEADER_KEY ? conflict : null}
            totalMinutes={actorMinutes(LEADER_KEY)}
            busy={isPending && pendingActor === LEADER_KEY}
            now={now}
            onIn={handleClockInLeader}
            onOut={handleClockOutLeader}
            onCancelConflict={() => setConflict(null)}
          />
          {members.map((m) => (
            <ActorRow
              key={m.id}
              label={`${m.first_name} ${m.last_name}`}
              open={openHere.get(m.id)}
              elsewhere={openElsewhere.get(m.id)}
              rowConflict={conflict?.actorKey === m.id ? conflict : null}
              totalMinutes={actorMinutes(m.id)}
              busy={isPending && pendingActor === m.id}
              now={now}
              onIn={(force) => handleClockInMember(m, force)}
              onOut={() => handleClockOutMember(m)}
              onCancelConflict={() => setConflict(null)}
            />
          ))}
          {!compact && (
            <div className="pt-2 text-xs text-gray-600">
              <span className="font-semibold">Job total to date:</span> {formatMinutes(totalMinutes)}
              <span className="ml-1 text-gray-400">· {projectLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
