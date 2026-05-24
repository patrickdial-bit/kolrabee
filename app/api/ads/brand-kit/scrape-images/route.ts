import { NextRequest, NextResponse } from 'next/server'
import { requireAdsTenant, AdsAccessError } from '@/lib/ads/access'
import { normalizeUrl } from '@/lib/helpers'

const MAX_CANDIDATES = 24

// Discover candidate seed images on the brand website (spec §6 Path A). Returns a
// list of external image URLs for the user to choose from; selected images are
// then ingested into Storage via POST /api/ads/brand-kit/upload-image { source_url }.
export async function POST(req: NextRequest) {
  try {
    await requireAdsTenant({ adminOnly: true })
    const body = await req.json().catch(() => ({}))
    const target = normalizeUrl(body.website_url)
    if (!target) {
      return NextResponse.json({ error: 'A website URL is required.' }, { status: 400 })
    }

    let html: string
    try {
      const res = await fetch(target, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KolrabeeAdsAgent/1.0)' },
        redirect: 'follow',
      })
      if (!res.ok) {
        return NextResponse.json({ error: `Could not load site (HTTP ${res.status}).`, candidates: [] }, { status: 200 })
      }
      html = await res.text()
    } catch {
      return NextResponse.json({ error: 'Could not reach that website.', candidates: [] }, { status: 200 })
    }

    const candidates = extractImageUrls(html, target).slice(0, MAX_CANDIDATES)
    return NextResponse.json({ candidates })
  } catch (err) {
    if (err instanceof AdsAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const found = new Set<string>()
  const add = (raw: string | undefined) => {
    if (!raw) return
    const cleaned = raw.trim().split(/\s+/)[0] // drop srcset descriptors
    if (!cleaned || cleaned.startsWith('data:')) return
    try {
      const abs = new URL(cleaned, baseUrl).toString()
      if (/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(abs)) found.add(abs)
    } catch {
      /* ignore */
    }
  }

  // <img src>, <img data-src>, <img srcset>
  for (const m of Array.from(html.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi))) add(m[1])
  for (const m of Array.from(html.matchAll(/<img\b[^>]*?\bdata-src=["']([^"']+)["']/gi))) add(m[1])
  for (const m of Array.from(html.matchAll(/\bsrcset=["']([^"']+)["']/gi))) {
    for (const part of m[1].split(',')) add(part)
  }
  // Open Graph / Twitter card images
  for (const m of Array.from(
    html.matchAll(/<meta\b[^>]*?(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*?content=["']([^"']+)["']/gi)
  )) {
    add(m[1])
  }

  return Array.from(found)
}
