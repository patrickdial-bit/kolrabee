'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActingContext } from '@/lib/helpers'

// Backup assembles a job's photos + documents into a single signed payload the
// browser zips and downloads. It is the local/ZIP destination of the broader
// backup feature; cloud destinations (Google Drive, Dropbox, OneDrive) will
// reuse this same manifest builder to create a per-project folder and push the
// same files. Keep the shape provider-agnostic for that reason.

const PHOTO_BUCKET = 'jobsite-photos'
const DOCS_BUCKET = 'documents'
const TTL = 60 * 60 * 6 // 6h signed URLs — enough to zip a large job

export type BackupFile = { url: string; filename: string }

export type ProjectBackup = {
  folderName: string
  photos: BackupFile[]
  documents: BackupFile[]
  manifest: string
}

function slug(input: string): string {
  return input.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'job'
}

function photoName(p: { id: string; taken_at: string | null; created_at: string }): string {
  const iso = p.taken_at ?? p.created_at
  const date = (iso ?? '').slice(0, 10) || 'photo'
  return `${date}-${p.id.slice(0, 8)}.jpg`
}

// Ensure each filename is unique within its folder (storage names can collide).
function dedupe(used: Set<string>, name: string): string {
  if (!used.has(name)) { used.add(name); return name }
  const dot = name.lastIndexOf('.')
  const base = dot === -1 ? name : name.slice(0, dot)
  const ext = dot === -1 ? '' : name.slice(dot)
  let i = 2
  while (used.has(`${base}-${i}${ext}`)) i++
  const out = `${base}-${i}${ext}`
  used.add(out)
  return out
}

/**
 * Build a downloadable backup of a single job: its jobsite photos and job
 * documents, plus a small README manifest for provenance. Tenant-scoped and
 * impersonation-aware (mirrors the photo/share actions). Returns null if the
 * caller has no context or the project isn't in their tenant.
 */
export async function getProjectBackup(projectId: string): Promise<ProjectBackup | null> {
  const ctx = await resolveActingContext()
  if (!ctx) return null
  const adminClient = createAdminClient()

  const { data: project } = await adminClient
    .from('projects')
    .select('id, job_number, customer_name, address, status, payout_amount, start_date, created_at')
    .eq('id', projectId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (!project) return null

  // Photos (full-size originals).
  const { data: photoRows } = await adminClient
    .from('photos')
    .select('id, storage_path, taken_at, created_at')
    .eq('project_id', projectId)
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
  const photos = (photoRows ?? []) as any[]

  const photoFiles: BackupFile[] = []
  if (photos.length > 0) {
    const { data: signed } = await adminClient.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(photos.map((p) => p.storage_path), TTL)
    const urlByPath = new Map<string, string>()
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
    const used = new Set<string>()
    for (const p of photos) {
      const url = urlByPath.get(p.storage_path)
      if (url) photoFiles.push({ url, filename: dedupe(used, photoName(p)) })
    }
  }

  // Job documents (attachments).
  const { data: docRows } = await adminClient
    .from('project_attachments')
    .select('id, file_name, file_url')
    .eq('project_id', projectId)
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: true })
  const docs = (docRows ?? []) as any[]

  const docFiles: BackupFile[] = []
  if (docs.length > 0) {
    const { data: signed } = await adminClient.storage
      .from(DOCS_BUCKET)
      .createSignedUrls(docs.map((d) => d.file_url), TTL)
    const urlByPath = new Map<string, string>()
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
    const used = new Set<string>()
    for (const d of docs) {
      const url = urlByPath.get(d.file_url)
      if (url) docFiles.push({ url, filename: dedupe(used, d.file_name || `document-${d.id.slice(0, 8)}`) })
    }
  }

  const label = project.job_number ? `${project.job_number} - ${project.customer_name}` : project.customer_name
  const manifest = [
    `Kolrabee job backup`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `Job number: ${project.job_number ?? '—'}`,
    `Customer:   ${project.customer_name}`,
    `Address:    ${project.address}`,
    `Status:     ${project.status}`,
    `Photos:     ${photoFiles.length}`,
    `Documents:  ${docFiles.length}`,
  ].join('\n')

  return {
    folderName: slug(label),
    photos: photoFiles,
    documents: docFiles,
    manifest,
  }
}
