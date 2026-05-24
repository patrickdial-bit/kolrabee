import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAdsTenant, AdsAccessError } from '@/lib/ads/access'
import { uploadAsset, downloadAsset, storagePaths } from '@/lib/ads/storage'
import type { AdSeedImageSource } from '@/lib/types'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// Ingest a seed image into Storage. Two modes:
//  - multipart/form-data with `file`           -> source: 'uploaded' (spec Path B)
//  - application/json { source_url }            -> source: 'scraped'  (spec Path A select)
// Returns the seed descriptor; the client appends it to the brand kit and PUTs.
export async function POST(req: NextRequest) {
  try {
    const { tenant } = await requireAdsTenant({ adminOnly: true })
    const contentType = req.headers.get('content-type') || ''

    let bytes: Buffer
    let mime: string
    let source: AdSeedImageSource['source']
    let originalUrl: string | undefined

    if (contentType.includes('application/json')) {
      const body = await req.json()
      const srcUrl: string | undefined = body.source_url
      if (!srcUrl) return NextResponse.json({ error: 'source_url is required.' }, { status: 400 })
      const downloaded = await downloadAsset(srcUrl)
      if (!downloaded) return NextResponse.json({ error: 'Could not download that image.' }, { status: 400 })
      bytes = downloaded
      mime = guessMimeFromUrl(srcUrl)
      source = 'scraped'
      originalUrl = srcUrl
    } else {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
      }
      if (!(file.type in EXT_BY_TYPE)) {
        return NextResponse.json({ error: 'Unsupported file type. Use PNG, JPG, WEBP, or GIF.' }, { status: 400 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      if (buf.length > MAX_BYTES) {
        return NextResponse.json({ error: 'File too large (max 10 MB).' }, { status: 400 })
      }
      bytes = buf
      mime = file.type
      source = 'uploaded'
    }

    const ext = EXT_BY_TYPE[mime] || 'png'
    const filename = `${randomUUID()}.${ext}`
    const path = storagePaths.seed(tenant.id, filename)
    const { signedUrl } = await uploadAsset(path, bytes, mime)

    const seed: AdSeedImageSource = {
      url: signedUrl,
      source,
      original_url: originalUrl,
      uploaded_at: new Date().toISOString(),
    }
    return NextResponse.json({ seed })
  } catch (err) {
    if (err instanceof AdsAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function guessMimeFromUrl(url: string): string {
  const m = /\.(png|jpe?g|webp|gif)(\?|#|$)/i.exec(url)
  const ext = (m?.[1] || 'png').toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/png'
}
