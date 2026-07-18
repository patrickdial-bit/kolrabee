'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  clockIn as clockInLeader,
  clockOut as clockOutLeader,
  clockInCrewMember,
  clockOutCrewMember,
  clockOutCrewOnProject,
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
  estimatedLaborHours?: number | null        // wind-down clock: remaining time vs this estimate
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
  estimatedLaborHours = null,
  compact = false,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingActor, setPendingActor] = useState<string | null>(null)
  const [conflict, setConflict] = useState<RowConflict | null>(null)
  const [expanded, setExpanded] = useState(!compact)
  const [now, setNow] = useState<Date>(new Date())
  // Forgotten-shift recovery: when a clock-out is rejected as stale, ask for
  // the actual end time instead of stamping "now" days later.
  const [staleFix, setStaleFix] = useState<{ entryId: string; isCrew: boolean; clockIn: string; label: string } | null>(null)
  const [staleValue, setStaleValue] = useState('')

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
  const crewOpenHereCount = Array.from(openHere.keys()).filter((k) => k !== LEADER_KEY).length
  const leaderOnClockHere = openHere.has(LEADER_KEY)

  // Wind-down clock: time remaining on the job's labor estimate, at second
  // granularity so it ticks like a real clock while anyone is on the clock.
  const estimatedMinutes =
    estimatedLaborHours !== null && estimatedLaborHours > 0
      ? Math.round(estimatedLaborHours * 60)
      : null
  const remainingMs = useMemo(() => {
    if (estimatedMinutes === null) return null
    let workedMs = 0
    for (const v of Object.values(jobTotalsByActor)) workedMs += v * 60000
    for (const e of Array.from(openHere.values())) {
      workedMs += Math.max(0, now.getTime() - new Date(e.clock_in).getTime())
    }
    return estimatedMinutes * 60000 - workedMs
  }, [estimatedMinutes, jobTotalsByActor, openHere, now])
  const estimatePct = estimatedMinutes ? Math.min(100, (totalMinutes / estimatedMinutes) * 100) : 0

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

  function beginStaleFix(entryId: string, isCrew: boolean, clockIn: string, label: string) {
    setStaleFix({ entryId, isCrew, clockIn, label })
    setStaleValue(format(new Date(clockIn), "yyyy-MM-dd'T'HH:mm"))
  }

  function saveStaleFix() {
    if (!staleFix || !staleValue) return
    const iso = new Date(staleValue).toISOString()
    if (new Date(iso) <= new Date(staleFix.clockIn)) {
      toast.error('Clock-out time must be after clock-in time.')
      return
    }
    startTransition(async () => {
      const result = staleFix.isCrew
        ? await clockOutCrewMember(slug, staleFix.entryId, iso)
        : await clockOutLeader(slug, staleFix.entryId, iso)
      if (result?.error) toast.error(result.error)
      else {
        toast.success('Entry corrected.')
        setStaleFix(null)
        router.refresh()
      }
    })
  }

  function handleSweepCrew() {
    setPendingActor('sweep')
    startTransition(async () => {
      const result = await clockOutCrewOnProject(slug, projectId)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else if ('closed' in result && result.closed !== undefined) {
        if (result.closed > 0) toast.success(`${result.closed} crew member${result.closed === 1 ? '' : 's'} clocked out.`)
        if ((result.staleSkipped ?? 0) > 0) {
          toast.warning(`${result.staleSkipped} entr${result.staleSkipped === 1 ? 'y' : 'ies'} open more than 12 hours — enter the actual end time for those.`)
        }
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
      if (result?.error) {
        if ('stale' in result && result.stale) {
          beginStaleFix(open.id, false, open.clock_in, leaderName + ' (you)')
        } else {
          toast.error(result.error)
        }
      }
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
      if (result?.error) {
        if ('stale' in result && result.stale) {
          beginStaleFix(open.id, true, open.clock_in, `${member.first_name} ${member.last_name}`)
        } else {
          toast.error(result.error)
        }
      }
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
          {remainingMs !== null && estimatedMinutes !== null && (
            <div className="mt-1.5">
              {/* Digital wind-down clock: LED-style readout of time left on the estimate */}
              <div className="inline-flex items-baseline gap-2 rounded-md bg-gray-900 px-2.5 py-1 shadow-inner">
                <span
                  className={`font-mono text-base font-bold tabular-nums tracking-[0.15em] ${
                    remainingMs < 0
                      ? 'text-red-400 [text-shadow:0_0_6px_rgba(248,113,113,0.6)]'
                      : 'text-emerald-400 [text-shadow:0_0_6px_rgba(52,211,153,0.5)]'
                  }`}
                >
                  {remainingMs < 0 ? '-' : ''}
                  {formatElapsed(Math.abs(remainingMs))}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {remainingMs < 0 ? 'over est.' : `left of ${formatMinutes(estimatedMinutes)}`}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full ${
                    estimatePct >= 100 ? 'bg-red-500' : estimatePct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${estimatePct}%` }}
                />
              </div>
            </div>
          )}
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

      {/* Sweep nudge: the lead is off the clock but crew are still running */}
      {!leaderOnClockHere && crewOpenHereCount > 0 && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5">
          <p className="text-xs text-amber-800">
            {crewOpenHereCount} crew member{crewOpenHereCount === 1 ? ' is' : 's are'} still on the clock.
          </p>
          <button
            onClick={handleSweepCrew}
            disabled={isPending}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isPending && pendingActor === 'sweep' ? 'Clocking out…' : 'Clock out crew'}
          </button>
        </div>
      )}

      {/* Forgotten-shift fix: stale entries need the real end time, not "now" */}
      {staleFix && (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2.5">
          <p className="text-xs text-amber-800">
            <strong>{staleFix.label}</strong> has been on the clock since{' '}
            {format(new Date(staleFix.clockIn), 'MMM d, h:mm a')}. Enter the actual end time:
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={staleValue}
              onChange={(e) => setStaleValue(e.target.value)}
              className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs"
            />
            <button
              onClick={saveStaleFix}
              disabled={isPending}
              className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setStaleFix(null)}
              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
