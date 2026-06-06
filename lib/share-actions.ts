'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActingContext } from '@/lib/helpers'

const BUCKET = 'jobsite-photos'
const SHARE_TTL = 60 * 60 * 6 // 6h signed URLs for share/download sessions
const SHARE_DAYS = 90

function newToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
}

function fileName(p: { id: string; taken_at: string | null; created_at: string }): string {
  const iso = p.taken_at ?? p.created_at
  const date = (iso ?? '').slice(0, 10) || 'photo'
  return `${date}-${p.id.slice(0, 8)}.jpg`
}

// ---- Admin: create / revoke share links ----------------------------------

export type ShareResult = { token?: string; expiresAt?: string; error?: string }

async function createShare(
  scope: 'project' | 'photo',
  targetId: string,
): Promise<ShareResult> {
  const ctx = await resolveActingContext()
  if (!ctx || ctx.user.role !== 'admin') return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  // Verify the target belongs to the tenant.
  const table = scope === 'project' ? 'projects' : 'photos'
  const { data: target } = await adminClient
    .from(table)
    .select('id')
    .eq('id', targetId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (!target) return { error: 'Not found.' }

  const col = scope === 'project' ? 'project_id' : 'photo_id'

  // Reuse an existing active link if there is one.
  const nowIso = new Date().toISOString()
  const { data: existing } = await adminClient
    .from('photo_shares')
    .select('token, expires_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('scope', scope)
    .eq(col, targetId)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) return { token: existing.token, expiresAt: existing.expires_at }

  const token = newToken()
  const expiresAt = new Date(Date.now() + SHARE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await adminClient.from('photo_shares').insert({
    token,
    tenant_id: ctx.tenantId,
    scope,
    project_id: scope === 'project' ? targetId : null,
    photo_id: scope === 'photo' ? targetId : null,
    created_by: ctx.user.id,
    expires_at: expiresAt,
  })
  if (error) return { error: 'Could not create share link.' }
  return { token, expiresAt }
}

export async function createProjectShare(projectId: string): Promise<ShareResult> {
  return createShare('project', projectId)
}

export async function createPhotoShare(photoId: string): Promise<ShareResult> {
  return createShare('photo', photoId)
}

export async function revokeShare(token: string): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await resolveActingContext()
  if (!ctx || ctx.user.role !== 'admin') return { error: 'Admins only.' }
  const adminClient = createAdminClient()
  await adminClient
    .from('photo_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token)
    .eq('tenant_id', ctx.tenantId)
  return { ok: true }
}

// ---- Admin: signed originals for a client-side ZIP download ---------------

export type DownloadItem = { id: string; url: string; filename: string }

export async function getProjectDownloadUrls(projectId: string): Promise<DownloadItem[]> {
  const ctx = await resolveActingContext()
  if (!ctx) return []
  const adminClient = createAdminClient()
  const { data: proj } = await adminClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (!proj) return []

  const { data: photos } = await adminClient
    .from('photos')
    .select('id, storage_path, taken_at, created_at')
    .eq('project_id', projectId)
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
  const rows = (photos ?? []) as any[]
  if (rows.length === 0) return []

  const { data: signed } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), SHARE_TTL)
  const urlByPath = new Map<string, string>()
  for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)

  return rows
    .map((r) => {
      const url = urlByPath.get(r.storage_path)
      return url ? { id: r.id, url, filename: fileName(r) } : null
    })
    .filter((x): x is DownloadItem => !!x)
}

// Signed original for a single photo (individual download).
export async function getPhotoDownloadUrl(photoId: string): Promise<{ url?: string; filename?: string; error?: string }> {
  const ctx = await resolveActingContext()
  if (!ctx) return { error: 'Not authenticated.' }
  const adminClient = createAdminClient()
  const { data: photo } = await adminClient
    .from('photos')
    .select('id, storage_path, taken_at, created_at')
    .eq('id', photoId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (!photo) return { error: 'Not found.' }
  const { data } = await adminClient.storage.from(BUCKET).createSignedUrl((photo as any).storage_path, SHARE_TTL)
  if (!data?.signedUrl) return { error: 'Could not prepare download.' }
  return { url: data.signedUrl, filename: fileName(photo as any) }
}

// ---- Public: resolve a share token (NO auth — token is the capability) -----

export type SharedPhoto = {
  id: string
  thumb_url: string | null
  full_url: string | null
  taken_at: string | null
  caption: string | null
  filename: string
}

export type SharedView =
  | { kind: 'project'; companyName: string; projectName: string; address: string; photos: SharedPhoto[] }
  | { kind: 'photo'; companyName: string; projectName: string; photo: SharedPhoto }
  | { error: 'not_found' | 'expired' | 'revoked' }

export async function getSharedView(token: string): Promise<SharedView> {
  const adminClient = createAdminClient()
  const { data: share } = await adminClient
    .from('photo_shares')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (!share) return { error: 'not_found' }
  if ((share as any).revoked_at) return { error: 'revoked' }
  if (new Date((share as any).expires_at) < new Date()) return { error: 'expired' }

  const { data: tenant } = await adminClient.from('tenants').select('name').eq('id', (share as any).tenant_id).single()
  const companyName = (tenant as any)?.name ?? 'Kolrabee'

  async function signPhoto(p: any): Promise<SharedPhoto> {
    const { data: signed } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrls([p.storage_path, p.thumb_path], SHARE_TTL)
    const byPath = new Map<string, string>()
    for (const s of signed ?? []) if (s.path && s.signedUrl) byPath.set(s.path, s.signedUrl)
    return {
      id: p.id,
      full_url: byPath.get(p.storage_path) ?? null,
      thumb_url: byPath.get(p.thumb_path) ?? null,
      taken_at: p.taken_at,
      caption: p.caption,
      filename: fileName(p),
    }
  }

  if ((share as any).scope === 'project') {
    const { data: project } = await adminClient
      .from('projects')
      .select('customer_name, address')
      .eq('id', (share as any).project_id)
      .single()
    const { data: photos } = await adminClient
      .from('photos')
      .select('id, storage_path, thumb_path, taken_at, created_at, caption')
      .eq('project_id', (share as any).project_id)
      .order('created_at', { ascending: false })
    const signedPhotos = await Promise.all(((photos ?? []) as any[]).map(signPhoto))
    return {
      kind: 'project',
      companyName,
      projectName: (project as any)?.customer_name ?? 'Shared photos',
      address: (project as any)?.address ?? '',
      photos: signedPhotos,
    }
  }

  // photo scope
  const { data: photo } = await adminClient
    .from('photos')
    .select('id, project_id, storage_path, thumb_path, taken_at, created_at, caption')
    .eq('id', (share as any).photo_id)
    .single()
  if (!photo) return { error: 'not_found' }
  const { data: project } = await adminClient
    .from('projects')
    .select('customer_name')
    .eq('id', (photo as any).project_id)
    .maybeSingle()
  return {
    kind: 'photo',
    companyName,
    projectName: (project as any)?.customer_name ?? '',
    photo: await signPhoto(photo),
  }
}
