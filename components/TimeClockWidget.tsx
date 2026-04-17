'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { clockIn as clockInAction, clockOut as clockOutAction } from '@/app/[slug]/dashboard/time-clock-actions'
import { formatElapsed } from '@/lib/time-tracking'

type OpenEntry = { id: string; clock_in: string; project_id: string } | null

interface Props {
  slug: string
  projectId: string
  projectLabel: string
  openEntry: OpenEntry
  otherOpenEntry: OpenEntry & { projectLabel?: string } | null
}

export default function TimeClockWidget({ slug, projectId, projectLabel, openEntry, otherOpenEntry }: Props) {
  const [isPending, startTransition] = useTransition()
  const [pendingConflict, setPendingConflict] = useState<{ label: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const router = useRouter()

  const clockedInHere = openEntry?.project_id === projectId

  useEffect(() => {
    if (!clockedInHere || !openEntry) return
    const start = new Date(openEntry.clock_in).getTime()
    const tick = () => setElapsed(Date.now() - start)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [clockedInHere, openEntry])

  function doClockIn(force: boolean) {
    startTransition(async () => {
      const result = await clockInAction(slug, projectId, force)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if ('conflict' in result && result.conflict) {
        setPendingConflict({ label: result.openProjectLabel })
        return
      }
      setPendingConflict(null)
      toast.success('Clocked in.')
      router.refresh()
    })
  }

  function doClockOut() {
    if (!openEntry) return
    startTransition(async () => {
      const result = await clockOutAction(slug, openEntry.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Clocked out.')
      router.refresh()
    })
  }

  if (clockedInHere && openEntry) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase tracking-wide">On the clock</div>
          <div className="font-mono text-lg font-semibold text-gray-900 tabular-nums">{formatElapsed(elapsed)}</div>
        </div>
        <button
          onClick={doClockOut}
          disabled={isPending}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Clocking out…' : 'Clock Out'}
        </button>
      </div>
    )
  }

  if (pendingConflict) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        <p className="text-amber-800 mb-2">
          You&apos;re still clocked in to <strong>{pendingConflict.label}</strong>. Clock out of that and clock in here?
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => doClockIn(true)}
            disabled={isPending}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isPending ? 'Switching…' : 'Switch to this job'}
          </button>
          <button
            onClick={() => setPendingConflict(null)}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Not clocked in here, but maybe clocked into a different job.
  const disabled = isPending
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => doClockIn(false)}
        disabled={disabled}
        aria-label={`Clock in to ${projectLabel}`}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Clocking in…' : 'Clock In'}
      </button>
      {otherOpenEntry && (
        <span className="text-xs text-gray-500">
          Still on the clock at {otherOpenEntry.projectLabel || 'another job'}
        </span>
      )}
    </div>
  )
}
