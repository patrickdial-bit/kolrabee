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

export function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | null, time: string | null): string {
  if (!date) return '—'
  const d = new Date(date)
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (!time) return dateStr
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  const mStr = m.toString().padStart(2, '0')
  return `${dateStr} ${h12}:${mStr} ${ampm}`
}

export function formatInsuranceDate(date: string | null): { text: string; isExpired: boolean } {
  if (!date) return { text: '—', isExpired: true }
  const d = new Date(date)
  const now = new Date()
  const isExpired = d < now
  return {
    text: d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    isExpired,
  }
}
