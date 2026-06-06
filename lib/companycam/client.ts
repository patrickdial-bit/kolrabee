// Thin CompanyCam API v2 client. Bearer-token auth, page-based pagination, and
// 429 backoff honoring Retry-After. Used server-side only (token never reaches
// the browser). https://docs.companycam.com/

const BASE = 'https://api.companycam.com/v2'

export type CCAddress = {
  street_address_1?: string | null
  street_address_2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

export type CCProject = {
  id: number | string
  name?: string | null
  address?: CCAddress | null
  status?: string | null
  coordinates?: { lat: number; lon: number } | null
  created_at?: number | null
  photo_count?: number | null
}

export type CCUri = { type: string; uri?: string; url?: string }

export type CCPhoto = {
  id: number | string
  project_id: number | string
  creator_id?: string | null
  creator_name?: string | null
  captured_at?: number | null
  created_at?: number | null
  coordinates?: { lat: number; lon: number } | null
  uris?: CCUri[] | null
  photo_url?: string | null
}

export type CCUser = {
  id: number | string
  company_id?: number | string
  email_address?: string | null
  first_name?: string | null
  last_name?: string | null
}

export type CCTag = {
  id: number | string
  display_value?: string | null
  value?: string | null
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function ccGet<T>(token: string, path: string, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  // Up to 5 attempts, backing off on 429 per Retry-After.
  let lastErr: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    let res: Response
    try {
      res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      })
    } catch (e) {
      lastErr = e
      await sleep(1000 * (attempt + 1))
      continue
    }
    if (res.status === 429) {
      const ra = parseInt(res.headers.get('Retry-After') ?? '5', 10)
      await sleep((Number.isNaN(ra) ? 5 : ra) * 1000)
      continue
    }
    if (res.status === 401) throw new Error('CompanyCam token is invalid or expired.')
    if (!res.ok) throw new Error(`CompanyCam ${path} returned ${res.status}`)
    return (await res.json()) as T
  }
  throw new Error(`CompanyCam ${path} failed after retries${lastErr ? `: ${String(lastErr)}` : ''}`)
}

export function ccGetCurrentUser(token: string): Promise<CCUser> {
  return ccGet<CCUser>(token, '/users/current')
}

export function ccListProjects(token: string, page: number, perPage = 50): Promise<CCProject[]> {
  return ccGet<CCProject[]>(token, '/projects', { page, per_page: perPage })
}

export function ccListPhotos(token: string, page: number, perPage = 15): Promise<CCPhoto[]> {
  return ccGet<CCPhoto[]>(token, '/photos', { page, per_page: perPage })
}

export function ccListTags(token: string, page: number, perPage = 100): Promise<CCTag[]> {
  return ccGet<CCTag[]>(token, '/tags', { page, per_page: perPage })
}

// Photos carrying a given tag (used to build photo↔tag links without a
// per-photo API call). tag_ids is an array param in CompanyCam.
export function ccListPhotosByTag(token: string, tagId: string | number, page: number, perPage = 50): Promise<CCPhoto[]> {
  return ccGet<CCPhoto[]>(token, '/photos', { 'tag_ids[]': tagId, page, per_page: perPage })
}

// Build a single-line address string from CompanyCam's address object.
export function ccFormatAddress(a?: CCAddress | null): string {
  if (!a) return ''
  return [a.street_address_1, a.street_address_2, a.city, a.state, a.postal_code]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

// Pick a downloadable URL from the uris[] array, preferring the requested type.
export function ccPickUri(uris: CCUri[] | null | undefined, prefer: 'original' | 'thumbnail'): string | null {
  if (!uris || uris.length === 0) return null
  const byType = (t: string) => uris.find((u) => u.type === t)
  const order = prefer === 'original' ? ['original', 'web', 'thumbnail'] : ['thumbnail', 'web', 'original']
  for (const t of order) {
    const u = byType(t)
    if (u?.uri) return u.uri
    if (u?.url) return u.url
  }
  const first = uris[0]
  return first?.uri ?? first?.url ?? null
}
