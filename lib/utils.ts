// Client-safe utility functions (no server imports)

import { parseAddress } from '@/lib/address'

/** Shown when a job's address has no city we can identify. */
export const CITY_UNKNOWN = 'Location shared after you accept'

/**
 * Can we name the city for this address without guessing?
 *
 * Jobs are often entered as a bare street ("175 Loveman Ave") — lib/geocode.ts
 * says as much. Those have no city to show, and the admin should complete them.
 */
export function hasResolvableCity(address: string | null | undefined): boolean {
  return parseAddress(address).city.trim().length > 0
}

/**
 * The city to show a subcontractor who has NOT yet accepted the job.
 *
 * SPEC.md: a sub sees the city only until they accept, so they can't go
 * straight to the customer. This fails CLOSED — if the stored address has no
 * city we can identify, it returns the company's service area, or a neutral
 * placeholder, rather than falling back to the raw address. The old version
 * split on commas and returned the whole string when there was no comma, which
 * leaked the full street address for every bare-street job.
 *
 * Pass `serviceArea` (tenants.service_area, e.g. "Columbus, OH") so the sub
 * still gets a rough location instead of nothing.
 */
export function extractCity(address: string, serviceArea?: string | null): string {
  const city = parseAddress(address).city.trim()
  if (city) return city
  const area = serviceArea?.trim()
  return area || CITY_UNKNOWN
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Parse a date string as a LOCAL date, avoiding the UTC-midnight timezone bug.
 * - "YYYY-MM-DD" (Postgres DATE column) is parsed as local midnight so it
 *   doesn't roll back a day in negative-offset timezones.
 * - Full ISO timestamps with time/zone info are parsed normally.
 */
function parseLocalDate(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(date: string | null): string {
  if (!date) return '—'
  const d = parseLocalDate(date)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | null, time: string | null): string {
  if (!date) return '—'
  const d = parseLocalDate(date)
  if (!d) return '—'
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (!time) return dateStr
  const parts = time.split(':').map(Number)
  const h = parts[0]
  const m = parts[1]
  if (isNaN(h) || isNaN(m)) return dateStr
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  const mStr = m.toString().padStart(2, '0')
  return `${dateStr} ${h12}:${mStr} ${ampm}`
}

export function formatInsuranceDate(date: string | null): { text: string; isExpired: boolean } {
  if (!date) return { text: '—', isExpired: true }
  const d = parseLocalDate(date)
  if (!d) return { text: '—', isExpired: true }
  const now = new Date()
  const isExpired = d < now
  return {
    text: d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    isExpired,
  }
}
