'use client'

import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageCompression'
import { readExifTakenAt } from '@/lib/exif'
import { recordPhoto } from '@/lib/photo-actions'
import type { PhotoWithUrl } from '@/lib/types'

const BUCKET = 'jobsite-photos'

export type UploadJobPhotoArgs = {
  file: File
  tenantId: string
  projectId: string
  // GPS is requested once per batch and reused; null when denied/unavailable.
  lat: number | null
  lng: number | null
}

// Compress a single capture (full-size + thumbnail), upload both objects to the
// private jobsite-photos bucket, then record the DB row. Returns the gallery-
// ready photo. Throws on failure so the caller can mark the optimistic tile.
export async function uploadJobPhoto({
  file,
  tenantId,
  projectId,
  lat,
  lng,
}: UploadJobPhotoArgs): Promise<PhotoWithUrl> {
  const supabase = createClient()
  const photoId = crypto.randomUUID()

  // taken_at: prefer EXIF DateTimeOriginal, then the file's own timestamp, then
  // the client clock at capture.
  const exifTakenAt = await readExifTakenAt(file)
  const takenAt =
    exifTakenAt ??
    (file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString())

  const [full, thumb] = await Promise.all([
    compressImage(file, { maxSizeMB: 0.5, maxWidthOrHeight: 2000 }),
    compressImage(file, { maxSizeMB: 0.05, maxWidthOrHeight: 400 }),
  ])

  // Key convention: {tenant_id}/{project_id}/{photo_id}.jpg — first segment is
  // the tenant, which storage RLS enforces.
  const base = `${tenantId}/${projectId}/${photoId}`
  const storagePath = `${base}.jpg`
  const thumbPath = `${base}_thumb.jpg`

  const [u1, u2] = await Promise.all([
    supabase.storage.from(BUCKET).upload(storagePath, full.blob, { contentType: 'image/jpeg' }),
    supabase.storage.from(BUCKET).upload(thumbPath, thumb.blob, { contentType: 'image/jpeg' }),
  ])
  if (u1.error || u2.error) {
    // Clean up whichever object did land so we don't leak orphans.
    await supabase.storage.from(BUCKET).remove([storagePath, thumbPath])
    throw u1.error ?? u2.error
  }

  const { photo, error } = await recordPhoto({
    projectId,
    photoId,
    storagePath,
    thumbPath,
    takenAt,
    lat,
    lng,
    width: full.width,
    height: full.height,
    bytes: full.blob.size,
  })

  if (error || !photo) {
    await supabase.storage.from(BUCKET).remove([storagePath, thumbPath])
    throw new Error(error ?? 'Failed to record photo')
  }

  return photo
}

// Request the device GPS once, fail soft (returns nulls) when denied or
// unavailable so capture is never blocked on a permission prompt.
export function getCurrentPosition(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ lat: null, lng: null })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  })
}
