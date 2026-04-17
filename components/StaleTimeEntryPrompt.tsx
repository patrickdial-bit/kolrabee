'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { resolveStaleEntry } from '@/app/[slug]/dashboard/time-clock-actions'
import { format } from 'date-fns'

interface Props {
  slug: string
  entry: { id: string; clock_in: string; projectLabel: string }
}

export default function StaleTimeEntryPrompt({ slug, entry }: Props) {
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
      const result = await resolveStaleEntry(slug, entry.id, iso)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Entry updated.')
      router.refresh()
    })
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-900">Did you forget to clock out?</h3>
      <p className="mt-1 text-sm text-amber-800">
        You&apos;ve been clocked in to <strong>{entry.projectLabel}</strong> since{' '}
        {format(clockIn, 'MMM d, h:mm a')}. What time did you actually stop?
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
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
