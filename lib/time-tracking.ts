import { startOfWeek, endOfWeek, addWeeks, formatISO, format } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export type TimeEntry = {
  id: string
  tenant_id: string
  subcontractor_id: string
  project_id: string
  clock_in: string
  clock_out: string | null
  duration_minutes: number | null
  notes: string | null
  edited_by_admin_id: string | null
  edited_at: string | null
  created_at: string
  updated_at: string
}

export type SubcontractorSettings = {
  id: string
  tenant_id: string
  subcontractor_id: string
  time_clock_enabled: boolean
  created_at: string
  updated_at: string
}

// 12 hours in milliseconds — threshold for "forgot to clock out" recovery prompt.
export const FORGOT_CLOCK_OUT_MS = 12 * 60 * 60 * 1000

// Week range (Monday 00:00 → Sunday 23:59) in a given IANA timezone.
// Returns UTC ISO bounds suitable for DB queries.
export function weekRange(reference: Date, timezone: string, weekOffset = 0): { startUtc: string; endUtc: string } {
  const zoned = toZonedTime(reference, timezone)
  const targetZoned = addWeeks(zoned, weekOffset)
  const startZoned = startOfWeek(targetZoned, { weekStartsOn: 1 })
  const endZoned = endOfWeek(targetZoned, { weekStartsOn: 1 })
  const startUtc = fromZonedTime(startZoned, timezone)
  const endUtc = fromZonedTime(endZoned, timezone)
  return { startUtc: formatISO(startUtc), endUtc: formatISO(endUtc) }
}

export function formatWeekLabel(startUtc: string, timezone: string): string {
  const start = toZonedTime(new Date(startUtc), timezone)
  return `Week of ${format(start, 'MMM d, yyyy')}`
}

// Format minutes as "Xh Ym".
export function formatMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0h 0m'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  return `${hours}h ${minutes}m`
}

// Format elapsed milliseconds as "HH:MM:SS" for the live clock.
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Sum minutes for a set of entries. Open entries contribute minutes up to "now".
export function sumDurationMinutes(entries: Pick<TimeEntry, 'clock_in' | 'clock_out' | 'duration_minutes'>[], now: Date = new Date()): number {
  let total = 0
  for (const e of entries) {
    if (e.duration_minutes !== null && e.duration_minutes !== undefined) {
      total += e.duration_minutes
    } else if (e.clock_out === null) {
      total += Math.max(0, Math.floor((now.getTime() - new Date(e.clock_in).getTime()) / 60000))
    }
  }
  return total
}

export function isOpenEntryStale(entry: { clock_in: string; clock_out: string | null }, now: Date = new Date()): boolean {
  if (entry.clock_out !== null) return false
  return now.getTime() - new Date(entry.clock_in).getTime() > FORGOT_CLOCK_OUT_MS
}
