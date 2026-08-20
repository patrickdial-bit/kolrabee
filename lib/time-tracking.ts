import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addWeeks,
  addMonths,
  addDays,
  subDays,
  parseISO,
  formatISO,
  format,
} from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export type TimeEntry = {
  id: string
  tenant_id: string
  subcontractor_id: string
  crew_member_id: string | null
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

// =============================================================================
// Reporting date ranges
// =============================================================================

export type RangePreset =
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'this_year'
  | 'all'
  | 'custom'

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'this_year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range…' },
]

export type ResolvedRange = {
  preset: RangePreset
  /** yyyy-MM-dd, inclusive, in the report timezone. null = unbounded. */
  fromDay: string | null
  /** yyyy-MM-dd, inclusive, in the report timezone. null = unbounded. */
  toDay: string | null
  /** UTC ISO, inclusive lower bound. null = unbounded. */
  startUtc: string | null
  /** UTC ISO, exclusive upper bound. null = unbounded. */
  endUtc: string | null
  label: string
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isDayString(value: unknown): value is string {
  return typeof value === 'string' && DAY_PATTERN.test(value)
}

function dayOf(zoned: Date): string {
  return format(zoned, 'yyyy-MM-dd')
}

function nextDay(day: string): string {
  return format(addDays(parseISO(`${day}T00:00:00`), 1), 'yyyy-MM-dd')
}

function labelDay(day: string, withYear: boolean): string {
  return format(parseISO(`${day}T00:00:00`), withYear ? 'MMM d, yyyy' : 'MMM d')
}

function rangeLabel(fromDay: string | null, toDay: string | null): string {
  if (!fromDay && !toDay) return 'All time'
  if (fromDay && !toDay) return `Since ${labelDay(fromDay, true)}`
  if (!fromDay && toDay) return `Through ${labelDay(toDay, true)}`
  if (fromDay === toDay) return labelDay(fromDay as string, true)
  const sameYear = (fromDay as string).slice(0, 4) === (toDay as string).slice(0, 4)
  return `${labelDay(fromDay as string, !sameYear)} – ${labelDay(toDay as string, true)}`
}

/**
 * Resolve a preset (or an explicit from/to pair) into UTC query bounds.
 * Day boundaries are interpreted in `timezone` so a "day" means a work day
 * for the company, not for whoever happens to be viewing the report.
 */
export function resolveRange(
  presetRaw: string | null | undefined,
  opts: { from?: string | null; to?: string | null; timezone: string; now?: Date }
): ResolvedRange {
  const { timezone } = opts
  const now = opts.now ?? new Date()
  const zoned = toZonedTime(now, timezone)

  const preset: RangePreset = RANGE_PRESETS.some((p) => p.value === presetRaw)
    ? (presetRaw as RangePreset)
    : 'this_week'

  let fromDay: string | null = null
  let toDay: string | null = null

  switch (preset) {
    case 'this_week':
      fromDay = dayOf(startOfWeek(zoned, { weekStartsOn: 1 }))
      toDay = dayOf(endOfWeek(zoned, { weekStartsOn: 1 }))
      break
    case 'last_week': {
      const ref = addWeeks(zoned, -1)
      fromDay = dayOf(startOfWeek(ref, { weekStartsOn: 1 }))
      toDay = dayOf(endOfWeek(ref, { weekStartsOn: 1 }))
      break
    }
    case 'this_month':
      fromDay = dayOf(startOfMonth(zoned))
      toDay = dayOf(endOfMonth(zoned))
      break
    case 'last_month': {
      const ref = addMonths(zoned, -1)
      fromDay = dayOf(startOfMonth(ref))
      toDay = dayOf(endOfMonth(ref))
      break
    }
    case 'last_7':
      fromDay = dayOf(subDays(zoned, 6))
      toDay = dayOf(zoned)
      break
    case 'last_30':
      fromDay = dayOf(subDays(zoned, 29))
      toDay = dayOf(zoned)
      break
    case 'last_90':
      fromDay = dayOf(subDays(zoned, 89))
      toDay = dayOf(zoned)
      break
    case 'this_year':
      fromDay = dayOf(startOfYear(zoned))
      toDay = dayOf(endOfYear(zoned))
      break
    case 'all':
      break
    case 'custom': {
      fromDay = isDayString(opts.from) ? opts.from : null
      toDay = isDayString(opts.to) ? opts.to : null
      if (fromDay && toDay && fromDay > toDay) {
        const swap = fromDay
        fromDay = toDay
        toDay = swap
      }
      break
    }
  }

  return {
    preset,
    fromDay,
    toDay,
    startUtc: fromDay ? fromZonedTime(`${fromDay}T00:00:00`, timezone).toISOString() : null,
    endUtc: toDay ? fromZonedTime(`${nextDay(toDay)}T00:00:00`, timezone).toISOString() : null,
    label: rangeLabel(fromDay, toDay),
  }
}
