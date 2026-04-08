// Client-safe utility functions (no server imports)

export function extractCity(address: string): string {
  const parts = address.split(',').map(p => p.trim())
  if (parts.length >= 2) {
    return parts[1].replace(/\s+\w{2}\s+\d{5}(-\d{4})?$/, '').trim()
  }
  return address
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
