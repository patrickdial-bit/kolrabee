// Server-only geocoding via OpenStreetMap's Nominatim service.
//
// Free, no API key — consistent with the project's "no paid services" stance.
// Nominatim's usage policy asks for a descriptive User-Agent and at most ~1
// request/second, which is well within our scale (a handful of jobs per tenant).
// Every call is best-effort: a failure returns null and never blocks the caller.

import { createAdminClient } from '@/lib/supabase/admin'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'Kolrabee/1.0 (job-mapping; +https://kolrabee.com)'

export type GeoPoint = { lat: number; lng: number }

/**
 * Geocode a free-text address to a coordinate. Returns null on any failure
 * (network error, timeout, no result) so callers can degrade gracefully.
 */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const query = address?.trim()
  if (!query) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    // countrycodes=us biases results toward US addresses, which matters because
    // job addresses are often partial (e.g. "175 Loveman Ave" with no city).
    const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    const results = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!Array.isArray(results) || results.length === 0) return null
    const lat = parseFloat(results[0].lat)
    const lng = parseFloat(results[0].lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null
    return { lat, lng }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Geocode a project's address and persist the result (or just the attempt
 * timestamp on failure). Best-effort — swallows its own errors.
 */
export async function geocodeAndStoreProject(projectId: string, address: string): Promise<void> {
  try {
    const point = await geocodeAddress(address)
    const adminClient = createAdminClient()
    await adminClient
      .from('projects')
      .update({
        latitude: point?.lat ?? null,
        longitude: point?.lng ?? null,
        geocoded_at: new Date().toISOString(),
      })
      .eq('id', projectId)
  } catch {
    // Non-fatal: the map simply won't plot this job until geocoding succeeds.
  }
}

/**
 * Lazily backfill coordinates for projects that have never been geocoded.
 * Called when a map view loads so existing jobs appear without a manual batch
 * job. Rate-limited and capped per call to respect Nominatim's usage policy.
 */
export async function backfillProjectGeocodes(
  projects: Array<{ id: string; address: string; geocoded_at: string | null }>,
  max = 5,
): Promise<void> {
  const pending = projects.filter((p) => !p.geocoded_at && p.address?.trim()).slice(0, max)
  for (const p of pending) {
    // Sequential with a small delay to stay under ~1 req/sec.
    // eslint-disable-next-line no-await-in-loop
    await geocodeAndStoreProject(p.id, p.address)
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 1100))
  }
}
