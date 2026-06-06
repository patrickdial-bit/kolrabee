'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActingContext } from '@/lib/helpers'
import type { GalleryProject, PhotoListItem, Tag, TagRef } from '@/lib/types'

const BUCKET = 'jobsite-photos'
const THUMB_TTL = 60 * 60 // 1 hour — gallery thumbnails
const RECENT_STRIP = 4 // recent-photo thumbnails per project row
const MAX_TAG_LEN = 32

// Resolve the acting tenant from the auth session (impersonation-aware via
// resolveActingContext). Tenant scoping is the security boundary: every query
// below is filtered by the resolved tenantId (the service-role client bypasses
// RLS, so the code-level tenant filter is what enforces isolation — RLS is
// defense-in-depth on top).
async function resolveSessionUser(): Promise<{ tenantId: string } | null> {
  const ctx = await resolveActingContext()
  if (!ctx) return null
  return { tenantId: ctx.tenantId }
}

function normalizeTagName(raw: string): string {
  return raw.trim().toLowerCase().slice(0, MAX_TAG_LEN)
}

// ---------------------------------------------------------------------------
// Tags — canonical, tenant-scoped vocabulary.
// ---------------------------------------------------------------------------

export async function listTags(): Promise<Tag[]> {
  const session = await resolveSessionUser()
  if (!session) return []
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('tags')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('name', { ascending: true })
  return (data ?? []) as Tag[]
}

// Create (or return the existing) canonical tag, case-insensitive per tenant.
export async function createTag(
  name: string,
  color?: string | null,
): Promise<{ tag?: Tag; error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const clean = normalizeTagName(name)
  if (!clean) return { error: 'Tag name is required.' }

  const adminClient = createAdminClient()
  // Upsert-by-name: insert, ignore the unique (tenant_id, lower(name)) conflict,
  // then read back the canonical row either way.
  await adminClient
    .from('tags')
    .insert({ tenant_id: session.tenantId, name: clean, color: color ?? null })
    .select()
    .single()

  const { data: tag } = await adminClient
    .from('tags')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .ilike('name', clean)
    .maybeSingle()

  if (!tag) return { error: 'Could not create tag.' }
  return { tag: tag as Tag }
}

export async function updateTag(
  tagId: string,
  patch: { name?: string; color?: string | null },
): Promise<{ success?: boolean; error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    const clean = normalizeTagName(patch.name)
    if (!clean) return { error: 'Tag name is required.' }
    update.name = clean
  }
  if (patch.color !== undefined) update.color = patch.color
  if (Object.keys(update).length === 0) return { success: true }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('tags')
    .update(update)
    .eq('id', tagId)
    .eq('tenant_id', session.tenantId)
  if (error) return { error: 'Could not update tag (name may already exist).' }
  return { success: true }
}

export async function deleteTag(tagId: string): Promise<{ success?: boolean; error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('tags')
    .delete()
    .eq('id', tagId)
    .eq('tenant_id', session.tenantId)
  if (error) return { error: 'Could not delete tag.' }
  return { success: true }
}

// Tags-with-counts for the Tags management page.
export async function listTagsWithCounts(): Promise<(Tag & { photo_count: number; project_count: number })[]> {
  const session = await resolveSessionUser()
  if (!session) return []
  const adminClient = createAdminClient()
  const { data: tags } = await adminClient
    .from('tags')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('name', { ascending: true })
  const tagList = (tags ?? []) as Tag[]
  if (tagList.length === 0) return []

  const ids = tagList.map((t) => t.id)
  const [{ data: pt }, { data: prt }] = await Promise.all([
    adminClient.from('photo_tags').select('tag_id').in('tag_id', ids),
    adminClient.from('project_tags').select('tag_id').in('tag_id', ids),
  ])
  const photoCounts = new Map<string, number>()
  for (const row of pt ?? []) photoCounts.set((row as any).tag_id, (photoCounts.get((row as any).tag_id) ?? 0) + 1)
  const projCounts = new Map<string, number>()
  for (const row of prt ?? []) projCounts.set((row as any).tag_id, (projCounts.get((row as any).tag_id) ?? 0) + 1)

  return tagList.map((t) => ({
    ...t,
    photo_count: photoCounts.get(t.id) ?? 0,
    project_count: projCounts.get(t.id) ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Attach / detach — tenant ownership is checked via the parent row.
// ---------------------------------------------------------------------------

async function assertTagInTenant(tagId: string, tenantId: string): Promise<boolean> {
  const adminClient = createAdminClient()
  const { data } = await adminClient.from('tags').select('id').eq('id', tagId).eq('tenant_id', tenantId).maybeSingle()
  return !!data
}

export async function attachProjectTag(projectId: string, tagId: string): Promise<{ error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const adminClient = createAdminClient()
  const { data: proj } = await adminClient
    .from('projects').select('id').eq('id', projectId).eq('tenant_id', session.tenantId).maybeSingle()
  if (!proj || !(await assertTagInTenant(tagId, session.tenantId))) return { error: 'Not found.' }
  const { error } = await adminClient.from('project_tags').insert({ project_id: projectId, tag_id: tagId })
  if (error && !error.message.includes('duplicate')) return { error: 'Could not add tag.' }
  return {}
}

export async function detachProjectTag(projectId: string, tagId: string): Promise<{ error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const adminClient = createAdminClient()
  const { data: proj } = await adminClient
    .from('projects').select('id').eq('id', projectId).eq('tenant_id', session.tenantId).maybeSingle()
  if (!proj) return { error: 'Not found.' }
  await adminClient.from('project_tags').delete().eq('project_id', projectId).eq('tag_id', tagId)
  return {}
}

export async function attachPhotoTag(photoId: string, tagId: string): Promise<{ error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const adminClient = createAdminClient()
  const { data: photo } = await adminClient
    .from('photos').select('id').eq('id', photoId).eq('tenant_id', session.tenantId).maybeSingle()
  if (!photo || !(await assertTagInTenant(tagId, session.tenantId))) return { error: 'Not found.' }
  const { error } = await adminClient.from('photo_tags').insert({ photo_id: photoId, tag_id: tagId })
  if (error && !error.message.includes('duplicate')) return { error: 'Could not add tag.' }
  return {}
}

export async function detachPhotoTag(photoId: string, tagId: string): Promise<{ error?: string }> {
  const session = await resolveSessionUser()
  if (!session) return { error: 'Not authenticated.' }
  const adminClient = createAdminClient()
  const { data: photo } = await adminClient
    .from('photos').select('id').eq('id', photoId).eq('tenant_id', session.tenantId).maybeSingle()
  if (!photo) return { error: 'Not found.' }
  await adminClient.from('photo_tags').delete().eq('photo_id', photoId).eq('tag_id', tagId)
  return {}
}

// ---------------------------------------------------------------------------
// Galleries — projects with photo counts, tag chips, and a recent-photo strip.
// Tag filter = OR (match ANY selected tag). Sorted by recent photo activity.
// ---------------------------------------------------------------------------

export type GalleryFilters = { search?: string | null; tagIds?: string[] | null }

export async function getGalleries(filters: GalleryFilters = {}): Promise<GalleryProject[]> {
  const session = await resolveSessionUser()
  if (!session) return []
  const { tenantId } = session
  const adminClient = createAdminClient()

  // Candidate projects (search on name + address).
  let projectQuery = adminClient
    .from('projects')
    .select('id, customer_name, address, created_at')
    .eq('tenant_id', tenantId)
  const search = filters.search?.trim()
  if (search) {
    projectQuery = projectQuery.or(`customer_name.ilike.%${search}%,address.ilike.%${search}%`)
  }
  const { data: projectRows } = await projectQuery
  let projects = (projectRows ?? []) as { id: string; customer_name: string; address: string; created_at: string }[]
  if (projects.length === 0) return []

  // OR tag filter: keep projects having ANY selected tag.
  const tagIds = (filters.tagIds ?? []).filter(Boolean)
  if (tagIds.length > 0) {
    const { data: matches } = await adminClient
      .from('project_tags')
      .select('project_id')
      .in('tag_id', tagIds)
    const allowed = new Set((matches ?? []).map((m: any) => m.project_id))
    projects = projects.filter((p) => allowed.has(p.id))
    if (projects.length === 0) return []
  }

  const projectIds = projects.map((p) => p.id)

  // Photos for these projects (for count, last activity, recent strip).
  const { data: photoRows } = await adminClient
    .from('photos')
    .select('id, project_id, thumb_path, taken_at, created_at')
    .eq('tenant_id', tenantId)
    .in('project_id', projectIds)
  const photos = (photoRows ?? []) as {
    id: string; project_id: string; thumb_path: string; taken_at: string | null; created_at: string
  }[]

  const byProject = new Map<string, typeof photos>()
  for (const ph of photos) {
    const list = byProject.get(ph.project_id) ?? []
    list.push(ph)
    byProject.set(ph.project_id, list)
  }
  const photoTime = (p: { taken_at: string | null; created_at: string }) => p.taken_at ?? p.created_at

  // Recent thumbnails to sign (RECENT_STRIP newest per project).
  const thumbsToSign: string[] = []
  const recentByProject = new Map<string, string[]>()
  for (const pid of projectIds) {
    const list = (byProject.get(pid) ?? []).slice().sort((a, b) => photoTime(b).localeCompare(photoTime(a)))
    const recent = list.slice(0, RECENT_STRIP).map((p) => p.thumb_path)
    recentByProject.set(pid, recent)
    thumbsToSign.push(...recent)
  }
  const urlByPath = new Map<string, string>()
  if (thumbsToSign.length > 0) {
    const { data: signed } = await adminClient.storage.from(BUCKET).createSignedUrls(thumbsToSign, THUMB_TTL)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  }

  // Project tags.
  const { data: ptRows } = await adminClient
    .from('project_tags')
    .select('project_id, tags(id, name, color)')
    .in('project_id', projectIds)
  const tagsByProject = new Map<string, TagRef[]>()
  for (const row of (ptRows ?? []) as any[]) {
    const tag = row.tags
    if (!tag) continue
    const list = tagsByProject.get(row.project_id) ?? []
    list.push({ id: tag.id, name: tag.name, color: tag.color })
    tagsByProject.set(row.project_id, list)
  }

  const result: GalleryProject[] = projects.map((p) => {
    const list = byProject.get(p.id) ?? []
    const lastPhoto = list.reduce<string | null>((acc, ph) => {
      const t = photoTime(ph)
      return acc === null || t > acc ? t : acc
    }, null)
    return {
      id: p.id,
      customer_name: p.customer_name,
      address: p.address,
      photo_count: list.length,
      tags: (tagsByProject.get(p.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      recent_thumb_urls: (recentByProject.get(p.id) ?? [])
        .map((path) => urlByPath.get(path))
        .filter((u): u is string => !!u),
      last_activity: lastPhoto ?? p.created_at,
    }
  })

  // Recent photo activity first (projects with no photos fall back to created_at).
  result.sort((a, b) => b.last_activity.localeCompare(a.last_activity))
  return result
}

// ---------------------------------------------------------------------------
// Photos — filtered, signed-thumbnail list for the All Photos grid / lens.
// Grouped by date client-side. Tag filter = OR.
// ---------------------------------------------------------------------------

export type PhotoFilters = {
  projectId?: string | null
  userId?: string | null
  start?: string | null // ISO date (inclusive)
  end?: string | null // ISO date (inclusive)
  tagIds?: string[] | null
}

export async function getPhotos(filters: PhotoFilters = {}): Promise<PhotoListItem[]> {
  const session = await resolveSessionUser()
  if (!session) return []
  const { tenantId } = session
  const adminClient = createAdminClient()

  let query = adminClient
    .from('photos')
    .select('*')
    .eq('tenant_id', tenantId)
  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.userId) query = query.eq('uploaded_by', filters.userId)
  // taken_at can be null; coalesce to created_at for range filtering happens below in JS.

  const { data: rows } = await query.order('created_at', { ascending: false })
  let photos = (rows ?? []) as any[]
  if (photos.length === 0) return []

  const effTime = (p: any) => (p.taken_at ?? p.created_at) as string
  if (filters.start) photos = photos.filter((p) => effTime(p) >= filters.start!)
  if (filters.end) {
    // end is inclusive for the whole day
    const endBound = filters.end!.length <= 10 ? filters.end! + 'T23:59:59.999Z' : filters.end!
    photos = photos.filter((p) => effTime(p) <= endBound)
  }

  // OR tag filter.
  const tagIds = (filters.tagIds ?? []).filter(Boolean)
  if (tagIds.length > 0) {
    const { data: matches } = await adminClient
      .from('photo_tags')
      .select('photo_id')
      .in('tag_id', tagIds)
      .in('photo_id', photos.map((p) => p.id))
    const allowed = new Set((matches ?? []).map((m: any) => m.photo_id))
    photos = photos.filter((p) => allowed.has(p.id))
  }
  if (photos.length === 0) return []

  // Sort by effective time desc (taken_at preferred).
  photos.sort((a, b) => effTime(b).localeCompare(effTime(a)))

  // Sign thumbnails (one batch).
  const thumbPaths = photos.map((p) => p.thumb_path)
  const { data: signed } = await adminClient.storage.from(BUCKET).createSignedUrls(thumbPaths, THUMB_TTL)
  const urlByPath = new Map<string, string>()
  for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)

  // Uploader names.
  const uploaderIds = Array.from(new Set(photos.map((p) => p.uploaded_by)))
  const { data: users } = await adminClient.from('users').select('id, first_name, last_name').in('id', uploaderIds)
  const nameById = new Map<string, string>()
  for (const u of users ?? []) nameById.set((u as any).id, `${(u as any).first_name} ${(u as any).last_name}`)

  // Project names.
  const projIds = Array.from(new Set(photos.map((p) => p.project_id)))
  const { data: projs } = await adminClient.from('projects').select('id, customer_name').in('id', projIds)
  const projNameById = new Map<string, string>()
  for (const pr of projs ?? []) projNameById.set((pr as any).id, (pr as any).customer_name)

  // Photo tags.
  const { data: ptRows } = await adminClient
    .from('photo_tags')
    .select('photo_id, tags(id, name, color)')
    .in('photo_id', photos.map((p) => p.id))
  const tagsByPhoto = new Map<string, TagRef[]>()
  for (const row of (ptRows ?? []) as any[]) {
    const tag = row.tags
    if (!tag) continue
    const list = tagsByPhoto.get(row.photo_id) ?? []
    list.push({ id: tag.id, name: tag.name, color: tag.color })
    tagsByPhoto.set(row.photo_id, list)
  }

  return photos.map((p) => ({
    ...(p as any),
    thumb_url: urlByPath.get(p.thumb_path) ?? null,
    uploader_name: nameById.get(p.uploaded_by) ?? 'Unknown',
    project_name: projNameById.get(p.project_id) ?? 'Unknown project',
    tags: (tagsByPhoto.get(p.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  })) as PhotoListItem[]
}

// Distinct uploaders for the Photos filter bar (Users dropdown).
export async function listPhotoUploaders(): Promise<{ id: string; name: string }[]> {
  const session = await resolveSessionUser()
  if (!session) return []
  const adminClient = createAdminClient()
  const { data: photoRows } = await adminClient
    .from('photos').select('uploaded_by').eq('tenant_id', session.tenantId)
  const ids = Array.from(new Set((photoRows ?? []).map((p: any) => p.uploaded_by)))
  if (ids.length === 0) return []
  const { data: users } = await adminClient.from('users').select('id, first_name, last_name').in('id', ids)
  return (users ?? []).map((u: any) => ({ id: u.id, name: `${u.first_name} ${u.last_name}` }))
}

// Projects list for the Photos filter bar (Projects dropdown).
export async function listTenantProjects(): Promise<{ id: string; customer_name: string }[]> {
  const session = await resolveSessionUser()
  if (!session) return []
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('projects')
    .select('id, customer_name')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false })
  return (data ?? []) as { id: string; customer_name: string }[]
}
