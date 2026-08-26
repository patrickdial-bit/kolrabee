'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActingContext } from '@/lib/helpers'
import type { Photo, PhotoWithUrl } from '@/lib/types'

const BUCKET = 'jobsite-photos'
const THUMB_TTL = 60 * 60 // 1 hour — gallery thumbnails
const FULL_TTL = 60 * 5 // 5 minutes — full-size, only opened in the lightbox
const MAX_TAGS = 12

// Resolve the acting user + tenant from the auth session, independent of the
// admin/sub route helpers (which redirect). Impersonation-aware: a super admin
// "Viewing as" a tenant acts as that tenant's admin. Works for an admin viewing
// a project and a crew member (subcontractor) viewing their assigned job.
async function resolveSessionUser(): Promise<
  { appUser: { id: string; role: 'admin' | 'subcontractor' | 'estimator'; first_name: string; last_name: string }; tenantId: string } | null
> {
  const ctx = await resolveActingContext()
  if (!ctx) return null
  // Estimators have no photo access — their surface is quotes only.
  if (ctx.user.role === 'estimator') return null
  return { appUser: ctx.user, tenantId: ctx.tenantId }
}

// Confirm a project exists within the caller's tenant. Tenant scoping is the
// security boundary; route-level checks already gate which projects a sub can
// reach. Returns the project's tenant_id (== caller tenant) or null.
async function assertProjectInTenant(projectId: string, tenantId: string): Promise<boolean> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return !!data
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const cleaned = tags
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 32)
  return Array.from(new Set(cleaned)).slice(0, MAX_TAGS)
}

// Keep the normalized photo_tags in sync with the jsonb tag list (Phase 2).
// The jsonb column stays as the capture-time write, but photo_tags is the
// source of truth for filtering — so every tag edit reconciles both. Canonical
// tags are upserted into the tenant's `tags` vocabulary as needed.
async function syncPhotoTags(
  adminClient: ReturnType<typeof createAdminClient>,
  photoId: string,
  tenantId: string,
  names: string[],
): Promise<void> {
  const { data: existing } = await adminClient
    .from('tags')
    .select('id, name')
    .eq('tenant_id', tenantId)
  const idByName = new Map<string, string>()
  for (const t of existing ?? []) idByName.set((t as any).name.toLowerCase(), (t as any).id)

  const missing = names.filter((n) => !idByName.has(n))
  if (missing.length > 0) {
    const { data: inserted } = await adminClient
      .from('tags')
      .insert(missing.map((n) => ({ tenant_id: tenantId, name: n })))
      .select('id, name')
    for (const t of inserted ?? []) idByName.set((t as any).name.toLowerCase(), (t as any).id)
  }

  const desiredIds = names.map((n) => idByName.get(n)).filter((x): x is string => !!x)
  const desired = new Set(desiredIds)

  const { data: current } = await adminClient.from('photo_tags').select('tag_id').eq('photo_id', photoId)
  const currentIds = new Set<string>((current ?? []).map((r: any) => r.tag_id))

  const toAdd = desiredIds.filter((id) => !currentIds.has(id))
  const toRemove = Array.from(currentIds).filter((id) => !desired.has(id))

  if (toAdd.length > 0) {
    await adminClient.from('photo_tags').insert(toAdd.map((tag_id) => ({ photo_id: photoId, tag_id })))
  }
  if (toRemove.length > 0) {
    await adminClient.from('photo_tags').delete().eq('photo_id', photoId).in('tag_id', toRemove)
  }
}

export type RecordPhotoInput = {
  projectId: string
  photoId: string
  storagePath: string
  thumbPath: string
  takenAt: string | null
  lat: number | null
  lng: number | null
  width: number | null
  height: number | null
  bytes: number | null
}

// Insert the photos row after the client has uploaded both objects to storage.
// The DB write goes through the service-role client (matching this codebase's
// mutation pattern) after an explicit tenant check.
export async function recordPhoto(
  input: RecordPhotoInput,
): Promise<{ photo?: PhotoWithUrl; error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const { appUser, tenantId } = session

  if (!(await assertProjectInTenant(input.projectId, tenantId))) {
    return { error: 'Project not found.' }
  }

  // The storage key must live under this tenant's folder — defense in depth
  // against a tampered client sending another tenant's path.
  const expectedPrefix = `${tenantId}/${input.projectId}/`
  if (!input.storagePath.startsWith(expectedPrefix) || !input.thumbPath.startsWith(expectedPrefix)) {
    return { error: 'Invalid storage path.' }
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('photos')
    .insert({
      id: input.photoId,
      tenant_id: tenantId,
      project_id: input.projectId,
      uploaded_by: appUser.id,
      storage_path: input.storagePath,
      thumb_path: input.thumbPath,
      taken_at: input.takenAt,
      lat: input.lat,
      lng: input.lng,
      width: input.width,
      height: input.height,
      bytes: input.bytes,
    })
    .select()
    .single()

  if (error || !data) {
    // Best-effort cleanup so we don't leave orphaned objects in storage.
    await adminClient.storage.from(BUCKET).remove([input.storagePath, input.thumbPath])
    return { error: 'Failed to save photo.' }
  }

  const photo = data as Photo
  const { data: signed } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(photo.thumb_path, THUMB_TTL)

  return {
    photo: {
      ...photo,
      thumb_url: signed?.signedUrl ?? null,
      uploader_name: `${appUser.first_name} ${appUser.last_name}`,
    },
  }
}

// Load a project's photos with short-TTL signed thumbnail URLs and uploader
// names, newest first. One batched createSignedUrls call for the whole page.
export async function getProjectPhotos(projectId: string): Promise<PhotoWithUrl[]> {
  const session = await resolveSessionUser()
  if (!session) return []
  const { tenantId } = session
  if (!(await assertProjectInTenant(projectId, tenantId))) return []

  const adminClient = createAdminClient()
  const { data: rows } = await adminClient
    .from('photos')
    .select('*')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  const photos = (rows ?? []) as Photo[]
  if (photos.length === 0) return []

  const thumbPaths = photos.map((p) => p.thumb_path)
  const { data: signedList } = await adminClient.storage.from(BUCKET).createSignedUrls(thumbPaths, THUMB_TTL)
  const urlByPath = new Map<string, string>()
  for (const s of signedList ?? []) {
    if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  }

  const uploaderIds = Array.from(new Set(photos.map((p) => p.uploaded_by)))
  const { data: users } = await adminClient
    .from('users')
    .select('id, first_name, last_name')
    .in('id', uploaderIds)
  const nameById = new Map<string, string>()
  for (const u of users ?? []) {
    nameById.set((u as any).id, `${(u as any).first_name} ${(u as any).last_name}`)
  }

  return photos.map((p) => ({
    ...p,
    thumb_url: urlByPath.get(p.thumb_path) ?? null,
    uploader_name: nameById.get(p.uploaded_by) ?? 'Unknown',
  }))
}

// On-demand signed URL for the full-size image (opened in the lightbox only, to
// keep egress down — thumbs everywhere, full-size only when tapped).
export async function getPhotoFullUrl(photoId: string): Promise<{ url?: string; error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const { tenantId } = session

  const adminClient = createAdminClient()
  const { data: photo } = await adminClient
    .from('photos')
    .select('storage_path')
    .eq('id', photoId)
    .eq('tenant_id', tenantId)
    .single()
  if (!photo) return { error: 'Photo not found.' }

  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(photo.storage_path, FULL_TTL)
  if (error || !data?.signedUrl) return { error: 'Could not load photo.' }
  return { url: data.signedUrl }
}

// Edit caption / tags. Allowed for the uploader or any tenant admin.
export async function updatePhotoMeta(
  photoId: string,
  meta: { caption?: string | null; tags?: string[] },
): Promise<{ success?: boolean; error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const { appUser, tenantId } = session

  const adminClient = createAdminClient()
  const { data: photo } = await adminClient
    .from('photos')
    .select('uploaded_by')
    .eq('id', photoId)
    .eq('tenant_id', tenantId)
    .single()
  if (!photo) return { error: 'Photo not found.' }

  if (photo.uploaded_by !== appUser.id && appUser.role !== 'admin') {
    return { error: 'You can only edit your own photos.' }
  }

  const update: Record<string, unknown> = {}
  let cleanedTags: string[] | undefined
  if (meta.caption !== undefined) {
    const trimmed = meta.caption?.trim() ?? ''
    update.caption = trimmed.length > 0 ? trimmed.slice(0, 500) : null
  }
  if (meta.tags !== undefined) {
    cleanedTags = sanitizeTags(meta.tags)
    update.tags = cleanedTags
  }
  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await adminClient
    .from('photos')
    .update(update)
    .eq('id', photoId)
    .eq('tenant_id', tenantId)
  if (error) return { error: 'Failed to save changes.' }

  // Reconcile the normalized photo_tags with the jsonb tags just written.
  if (cleanedTags !== undefined) {
    await syncPhotoTags(adminClient, photoId, tenantId, cleanedTags)
  }
  return { success: true }
}

// Delete a photo (DB row + both storage objects). Admins only — crews must not
// be able to nuke job evidence.
export async function deletePhoto(photoId: string): Promise<{ success?: boolean; error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const { appUser, tenantId } = session

  if (appUser.role !== 'admin') {
    return { error: 'Only an admin can delete photos.' }
  }

  const adminClient = createAdminClient()
  const { data: photo } = await adminClient
    .from('photos')
    .select('storage_path, thumb_path')
    .eq('id', photoId)
    .eq('tenant_id', tenantId)
    .single()
  if (!photo) return { error: 'Photo not found.' }

  await adminClient.storage.from(BUCKET).remove([photo.storage_path, photo.thumb_path])

  const { error } = await adminClient
    .from('photos')
    .delete()
    .eq('id', photoId)
    .eq('tenant_id', tenantId)
  if (error) return { error: 'Failed to delete photo.' }
  return { success: true }
}
