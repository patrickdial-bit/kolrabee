'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActingContext } from '@/lib/helpers'
import {
  ccFormatAddress,
  ccGetCurrentUser,
  ccListPhotos,
  ccListPhotosByTag,
  ccListProjects,
  ccListTags,
  ccPickUri,
} from '@/lib/companycam/client'

const BUCKET = 'jobsite-photos'
const PROJECTS_PER_PAGE = 50
const PHOTOS_PER_CHUNK = 6 // bounded so one processChunk call stays well under serverless timeout

type Session = {
  appUser: { id: string; role: 'admin' | 'subcontractor' | 'estimator'; first_name: string; last_name: string }
  tenantId: string
}

// CompanyCam import is an admin-only, tenant-scoped operation. Impersonation-
// aware: a super admin "Viewing as" a tenant acts as that tenant's admin (the
// imported projects/photos are owned by that admin user).
async function resolveAdmin(): Promise<Session | null> {
  const ctx = await resolveActingContext()
  if (!ctx || ctx.user.role !== 'admin') return null
  return { appUser: ctx.user, tenantId: ctx.tenantId }
}

export type ImportJob = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  phase: 'projects' | 'photos' | 'tag_vocab' | 'tag_links' | 'done'
  projects_done: number
  photos_done: number
  photos_failed: number
  tags_done: number
  error: string | null
}

const TAGS_PER_PAGE = 100
const TAG_PHOTOS_PER_CHUNK = 50

export type ImportState = {
  connected: boolean
  connectedAt: string | null
  lastImportAt: string | null
  job: ImportJob | null
}

// ---- Connection ----------------------------------------------------------

export async function saveConnection(token: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await resolveAdmin()
  if (!session) return { error: 'Admins only.' }
  const clean = token.trim()
  if (!clean) return { error: 'Paste your CompanyCam API token.' }

  // Validate the token against CompanyCam before storing it.
  try {
    await ccGetCurrentUser(clean)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not verify token with CompanyCam.' }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('companycam_connections').upsert(
    {
      tenant_id: session.tenantId,
      api_token: clean,
      connected_by: session.appUser.id,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' },
  )
  if (error) return { error: 'Failed to save connection.' }
  return { ok: true }
}

export async function disconnect(): Promise<{ ok?: boolean; error?: string }> {
  const session = await resolveAdmin()
  if (!session) return { error: 'Admins only.' }
  const adminClient = createAdminClient()
  await adminClient.from('companycam_connections').delete().eq('tenant_id', session.tenantId)
  return { ok: true }
}

export async function getImportState(): Promise<ImportState> {
  const session = await resolveAdmin()
  if (!session) return { connected: false, connectedAt: null, lastImportAt: null, job: null }
  const adminClient = createAdminClient()
  const { data: conn } = await adminClient
    .from('companycam_connections')
    .select('connected_at, last_import_at')
    .eq('tenant_id', session.tenantId)
    .maybeSingle()
  const { data: job } = await adminClient
    .from('companycam_import_jobs')
    .select('id, status, phase, projects_done, photos_done, photos_failed, tags_done, error')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return {
    connected: !!conn,
    connectedAt: conn?.connected_at ?? null,
    lastImportAt: conn?.last_import_at ?? null,
    job: (job as ImportJob) ?? null,
  }
}

// ---- Import driver -------------------------------------------------------

export async function startImport(): Promise<{ job?: ImportJob; error?: string }> {
  const session = await resolveAdmin()
  if (!session) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { data: conn } = await adminClient
    .from('companycam_connections')
    .select('tenant_id')
    .eq('tenant_id', session.tenantId)
    .maybeSingle()
  if (!conn) return { error: 'Connect your CompanyCam account first.' }

  // Clear any prior non-active job state by inserting a fresh job. The partial
  // unique index guarantees at most one pending/running job per tenant.
  const { data: job, error } = await adminClient
    .from('companycam_import_jobs')
    .insert({
      tenant_id: session.tenantId,
      created_by: session.appUser.id,
      status: 'running',
      phase: 'projects',
      page: 1,
    })
    .select('id, status, phase, projects_done, photos_done, photos_failed, tags_done, error')
    .single()
  if (error || !job) return { error: 'An import is already running.' }
  return { job: job as ImportJob }
}

async function downloadBytes(url: string): Promise<Uint8Array> {
  // Abort a hung CDN URL instead of letting it stall the whole chunk until the
  // serverless function times out.
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
    if (!res.ok) throw new Error(`download ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  } finally {
    clearTimeout(t)
  }
}

// Processes one bounded unit of work and returns the updated job snapshot. The
// client calls this in a loop until `done` is true.
export async function processChunk(): Promise<{ job?: ImportJob; done?: boolean; error?: string }> {
  const session = await resolveAdmin()
  if (!session) return { error: 'Admins only.' }
  const adminClient = createAdminClient()
  const { tenantId, appUser } = session

  const { data: conn } = await adminClient
    .from('companycam_connections')
    .select('api_token')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const token = conn?.api_token
  if (!token) return { error: 'Not connected.' }

  const { data: jobRow } = await adminClient
    .from('companycam_import_jobs')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!jobRow) return { error: 'No active import.' }

  const job = jobRow as any
  const snapshot = (extra: Partial<ImportJob> = {}): ImportJob => ({
    id: job.id,
    status: job.status,
    phase: job.phase,
    projects_done: job.projects_done,
    photos_done: job.photos_done,
    photos_failed: job.photos_failed,
    tags_done: job.tags_done ?? 0,
    error: job.error,
    ...extra,
  })

  async function save(patch: Record<string, unknown>) {
    Object.assign(job, patch)
    await adminClient
      .from('companycam_import_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', job.id)
  }

  try {
    // -------- Phase 1: projects --------
    if (job.phase === 'projects') {
      const projects = await ccListProjects(token, job.page, PROJECTS_PER_PAGE)
      if (projects.length > 0) {
        const ccIds = projects.map((p) => String(p.id))
        const { data: existingRows } = await adminClient
          .from('projects')
          .select('companycam_id')
          .eq('tenant_id', tenantId)
          .in('companycam_id', ccIds)
        const existing = new Set((existingRows ?? []).map((r: any) => r.companycam_id))

        const toInsert = projects
          .filter((p) => !existing.has(String(p.id)))
          .map((p) => {
            const address = ccFormatAddress(p.address)
            const name = (p.name ?? '').trim()
            return {
              tenant_id: tenantId,
              created_by: appUser.id,
              customer_name: name || address || 'CompanyCam project',
              address: address || name || 'Imported from CompanyCam',
              payout_amount: 0,
              status: 'imported',
              source: 'companycam',
              companycam_id: String(p.id),
            }
          })
        if (toInsert.length > 0) {
          await adminClient.from('projects').insert(toInsert)
        }
      }

      const projectsDone = job.projects_done + projects.length
      if (projects.length < PROJECTS_PER_PAGE) {
        await save({ projects_done: projectsDone, phase: 'photos', page: 1 })
      } else {
        await save({ projects_done: projectsDone, page: job.page + 1 })
      }
      return { job: snapshot(), done: false }
    }

    // -------- Phase 2: photos --------
    if (job.phase === 'photos') {
      const photos = await ccListPhotos(token, job.page, PHOTOS_PER_CHUNK)

      if (photos.length > 0) {
        // Map CompanyCam project ids → Kolrabee project ids (imported in phase 1).
        const ccProjectIds = Array.from(new Set(photos.map((p) => String(p.project_id))))
        const { data: projRows } = await adminClient
          .from('projects')
          .select('id, companycam_id')
          .eq('tenant_id', tenantId)
          .in('companycam_id', ccProjectIds)
        const kProjectByCc = new Map<string, string>()
        for (const r of projRows ?? []) kProjectByCc.set((r as any).companycam_id, (r as any).id)

        // Skip photos already imported (idempotent re-runs).
        const ccPhotoIds = photos.map((p) => String(p.id))
        const { data: existingPhotos } = await adminClient
          .from('photos')
          .select('companycam_id')
          .eq('tenant_id', tenantId)
          .in('companycam_id', ccPhotoIds)
        const importedAlready = new Set((existingPhotos ?? []).map((r: any) => r.companycam_id))

        let done = 0
        let failed = 0
        for (const photo of photos) {
          if (importedAlready.has(String(photo.id))) continue
          const kProjectId = kProjectByCc.get(String(photo.project_id))
          const originalUri = ccPickUri(photo.uris, 'original')
          if (!kProjectId || !originalUri) {
            failed++
            continue
          }
          try {
            const thumbUri = ccPickUri(photo.uris, 'thumbnail') ?? originalUri
            const newId = crypto.randomUUID()
            const base = `${tenantId}/${kProjectId}/${newId}`
            const storagePath = `${base}.jpg`
            const thumbPath = `${base}_thumb.jpg`

            const [fullBytes, thumbBytes] = await Promise.all([
              downloadBytes(originalUri),
              downloadBytes(thumbUri),
            ])
            const up1 = await adminClient.storage
              .from(BUCKET)
              .upload(storagePath, fullBytes, { contentType: 'image/jpeg', upsert: true })
            const up2 = await adminClient.storage
              .from(BUCKET)
              .upload(thumbPath, thumbBytes, { contentType: 'image/jpeg', upsert: true })
            if (up1.error || up2.error) throw up1.error ?? up2.error

            const takenAt = photo.captured_at ? new Date(photo.captured_at * 1000).toISOString() : null
            const { error: insErr } = await adminClient.from('photos').insert({
              id: newId,
              tenant_id: tenantId,
              project_id: kProjectId,
              uploaded_by: appUser.id,
              storage_path: storagePath,
              thumb_path: thumbPath,
              taken_at: takenAt,
              lat: photo.coordinates?.lat ?? null,
              lng: photo.coordinates?.lon ?? null,
              source: 'companycam',
              companycam_id: String(photo.id),
            })
            if (insErr) {
              // Roll back the just-uploaded objects to avoid orphans.
              await adminClient.storage.from(BUCKET).remove([storagePath, thumbPath])
              throw insErr
            }
            done++
          } catch {
            failed++
          }
        }

        const photosDone = job.photos_done + done
        const photosFailed = job.photos_failed + failed
        if (photos.length < PHOTOS_PER_CHUNK) {
          // Photos finished → move on to importing tags.
          await save({ photos_done: photosDone, photos_failed: photosFailed, phase: 'tag_vocab', page: 1 })
          return { job: snapshot(), done: false }
        }
        await save({ photos_done: photosDone, photos_failed: photosFailed, page: job.page + 1 })
        return { job: snapshot(), done: false }
      }

      // No photos on this page → move on to tags.
      await save({ phase: 'tag_vocab', page: 1 })
      return { job: snapshot(), done: false }
    }

    // -------- Phase 3a: tag vocabulary --------
    // Seed CompanyCam tag names into the tenant's canonical `tags` vocabulary
    // (lowercased to match Kolrabee's case-insensitive tags).
    if (job.phase === 'tag_vocab') {
      const tags = await ccListTags(token, job.page, TAGS_PER_PAGE)
      if (tags.length > 0) {
        const names = Array.from(
          new Set(
            tags
              .map((t) => (t.display_value ?? t.value ?? '').trim().toLowerCase())
              .filter((n) => n.length > 0 && n.length <= 32),
          ),
        )
        const { data: existing } = await adminClient
          .from('tags')
          .select('name')
          .eq('tenant_id', tenantId)
          .in('name', names)
        const have = new Set((existing ?? []).map((r: any) => r.name))
        for (const name of names) {
          if (have.has(name)) continue
          // Insert individually so a rare unique-collision can't abort the chunk.
          await adminClient.from('tags').insert({ tenant_id: tenantId, name }).then(
            () => {},
            () => {},
          )
        }
      }
      if (tags.length < TAGS_PER_PAGE) {
        await save({ phase: 'tag_links', page: 1, tag_index: 0 })
      } else {
        await save({ page: job.page + 1 })
      }
      return { job: snapshot(), done: false }
    }

    // -------- Phase 3b: tag links --------
    // For each CompanyCam tag, list its photos and link the imported Kolrabee
    // photos to the matching Kolrabee tag. Far fewer calls than per-photo.
    if (job.phase === 'tag_links') {
      const tagPage = Math.floor(job.tag_index / TAGS_PER_PAGE) + 1
      const ccTags = await ccListTags(token, tagPage, TAGS_PER_PAGE)
      const local = job.tag_index % TAGS_PER_PAGE

      if (local >= ccTags.length) {
        // Past the last tag → import complete.
        await save({ phase: 'done', status: 'completed' })
        await adminClient
          .from('companycam_connections')
          .update({ last_import_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
        return { job: snapshot(), done: true }
      }

      const ccTag = ccTags[local]
      const name = (ccTag.display_value ?? ccTag.value ?? '').trim().toLowerCase()
      let linked = 0
      if (name) {
        const { data: kTag } = await adminClient
          .from('tags')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', name)
          .maybeSingle()
        const ccPhotos = await ccListPhotosByTag(token, ccTag.id, job.page, TAG_PHOTOS_PER_CHUNK)
        if (kTag && ccPhotos.length > 0) {
          const ccPhotoIds = ccPhotos.map((p) => String(p.id))
          const { data: kPhotos } = await adminClient
            .from('photos')
            .select('id, companycam_id')
            .eq('tenant_id', tenantId)
            .in('companycam_id', ccPhotoIds)
          const links = (kPhotos ?? []).map((kp: any) => ({ photo_id: kp.id, tag_id: (kTag as any).id }))
          if (links.length > 0) {
            await adminClient.from('photo_tags').upsert(links, { onConflict: 'photo_id,tag_id', ignoreDuplicates: true })
            linked = links.length
          }
        }
        if (ccPhotos.length < TAG_PHOTOS_PER_CHUNK) {
          await save({ tag_index: job.tag_index + 1, page: 1, tags_done: job.tags_done + linked })
        } else {
          await save({ page: job.page + 1, tags_done: job.tags_done + linked })
        }
      } else {
        // Unnamed tag — skip to the next.
        await save({ tag_index: job.tag_index + 1, page: 1 })
      }
      return { job: snapshot(), done: false }
    }

    // Already done.
    return { job: snapshot(), done: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed.'
    await save({ status: 'failed', error: msg })
    return { job: snapshot(), done: true, error: msg }
  }
}
