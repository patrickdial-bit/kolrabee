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
