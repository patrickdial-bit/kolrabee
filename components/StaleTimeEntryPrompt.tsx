'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { resolveStaleEntry, resolveStaleCrewEntry } from '@/app/[slug]/dashboard/time-clock-actions'
import { format } from 'date-fns'

export type StaleEntry = {
  id: string
  clock_in: string
  projectLabel: string
  actorName: string // 'You' for the leader, otherwise the crew member's name
  isCrew: boolean
}

function StaleEntryRow({ slug, entry }: { slug: string; entry: StaleEntry }) {
  const clockIn = new Date(entry.clock_in)
  const [dateValue, setDateValue] = useState(format(clockIn, 'yyyy-MM-dd'))
  const [timeValue, setTimeValue] = useState(format(clockIn, 'HH:mm'))
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    const iso = new Date(`${dateValue}T${timeValue}`).toISOString()
    if (new Date(iso) <= clockIn) {
      toast.error('Clock-out time must be after clock-in time.')
      return
    }
    startTransition(async () => {
      const result = entry.isCrew
        ? await resolveStaleCrewEntry(slug, entry.id, iso)
        : await resolveStaleEntry(slug, entry.id, iso)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Entry updated.')
      router.refresh()
    })
  }

  return (
    <div className="mt-3 border-t border-amber-200 pt-3 first:mt-0 first:border-t-0 first:pt-0">
      <p className="text-sm text-amber-800">
        <strong>{entry.actorName}</strong> {entry.actorName === 'You' ? 'have' : 'has'} been clocked in
        to <strong>{entry.projectLabel}</strong> since {format(clockIn, 'MMM d, h:mm a')}. What time did
        {entry.actorName === 'You' ? ' you' : ` ${entry.actorName}`} actually stop?
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          className="rounded-md border border-amber-300 bg-white px-2 py-1 text-sm"
        />
        <input
          type="time"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          className="rounded-md border border-amber-300 bg-white px-2 py-1 text-sm"
        />
        <button
          onClick={submit}
          disabled={isPending}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save clock-out'}
        </button>
      </div>
    </div>
  )
}

export default function StaleTimeEntryPrompt({ slug, entries }: { slug: string; entries: StaleEntry[] }) {
  if (entries.length === 0) return null
  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-900">
        {entries.length === 1 ? 'Did someone forget to clock out?' : 'Did your crew forget to clock out?'}
      </h3>
      {entries.map((entry) => (
        <StaleEntryRow key={entry.id} slug={slug} entry={entry} />
      ))}
    </div>
  )
}
