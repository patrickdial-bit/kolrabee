import { createAdminClient } from '@/lib/supabase/admin'

export const AD_ASSETS_BUCKET = 'ad-assets'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days (spec §3)

// Upload a binary asset and return a 7-day signed URL. Paths follow the
// conventions in spec §3 ({tenant}/seeds/..., {tenant}/runs/{run}/...).
export async function uploadAsset(
  path: string,
  body: Buffer | Uint8Array | ArrayBuffer,
  contentType: string
): Promise<{ path: string; signedUrl: string }> {
  const adminClient = createAdminClient()
  const { error } = await adminClient.storage
    .from(AD_ASSETS_BUCKET)
    .upload(path, body as any, { contentType, upsert: true })
  if (error) throw new Error(`Storage upload failed for ${path}: ${error.message}`)
  const signedUrl = await signAsset(path)
  return { path, signedUrl }
}

export async function signAsset(path: string): Promise<string> {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient.storage
    .from(AD_ASSETS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data) throw new Error(`Could not sign ${path}: ${error?.message}`)
  return data.signedUrl
}

// Download an asset (e.g. a seed image for image-to-image, or a generated PNG to
// bundle into the export ZIP). Accepts either a storage path or a signed URL.
export async function downloadAsset(pathOrUrl: string): Promise<Buffer | null> {
  try {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      const res = await fetch(pathOrUrl)
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    }
    const adminClient = createAdminClient()
    const { data, error } = await adminClient.storage.from(AD_ASSETS_BUCKET).download(pathOrUrl)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  } catch {
    return null
  }
}

// Storage path within ad-assets stored alongside signed URLs so we can re-sign or
// download later. We keep both the path and a fresh signed URL in the DB; signed
// URLs are re-minted on read where needed.
export const storagePaths = {
  seed: (tenantId: string, filename: string) => `${tenantId}/seeds/${filename}`,
  conceptImage: (tenantId: string, runId: string, conceptId: string) =>
    `${tenantId}/runs/${runId}/${conceptId}.png`,
  export: (tenantId: string, runId: string, timestamp: string) =>
    `${tenantId}/runs/${runId}/exports/${timestamp}.zip`,
}
