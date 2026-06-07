import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret, encryptSecret, hasEncryptionKey } from '@/lib/crypto'
import * as gdrive from '@/lib/integrations/google-drive'
import { getProjectBackup } from '@/lib/backup-actions'

// Server-side orchestration for cloud backup. Holds the DB <-> provider glue so
// both the OAuth callback, the project-create hook, and the "Back up now" action
// share one code path. Provider-specific calls go through lib/integrations/<p>.

export type BackupProvider = 'google_drive'

const ROOT_FOLDER_DEFAULT = 'Kolrabee Backups'

export type IntegrationStatus = {
  configured: boolean // server has the OAuth client + encryption key
  connected: boolean
  provider: BackupProvider | null
  accountEmail: string | null
  rootFolderName: string | null
  autoCreateFolders: boolean
  autoBackup: boolean
}

// Whether Google Drive backup can be offered at all (server env present).
export function googleConfigured(): boolean {
  return gdrive.isConfigured() && hasEncryptionKey()
}

export async function getIntegrationStatus(tenantId: string): Promise<IntegrationStatus> {
  const base: IntegrationStatus = {
    configured: googleConfigured(),
    connected: false,
    provider: null,
    accountEmail: null,
    rootFolderName: null,
    autoCreateFolders: true,
    autoBackup: true,
  }
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('tenant_integrations')
    .select('provider, status, account_email, root_folder_name, auto_create_folders, auto_backup')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_drive')
    .maybeSingle()
  if (!data || data.status !== 'connected') return base
  return {
    ...base,
    connected: true,
    provider: 'google_drive',
    accountEmail: data.account_email ?? null,
    rootFolderName: data.root_folder_name ?? null,
    autoCreateFolders: data.auto_create_folders ?? true,
    autoBackup: data.auto_backup ?? true,
  }
}

// Persist a freshly authorized Google connection. Creates (or finds) the root
// backup folder and stores the encrypted refresh token. Called by the callback.
export async function saveGoogleConnection(args: {
  tenantId: string
  connectedBy: string
  refreshToken: string
  accessToken: string
}): Promise<void> {
  const email = await gdrive.getUserEmail(args.accessToken)
  const root = await gdrive.ensureFolder(args.accessToken, ROOT_FOLDER_DEFAULT, null)

  const adminClient = createAdminClient()
  await adminClient
    .from('tenant_integrations')
    .upsert(
      {
        tenant_id: args.tenantId,
        provider: 'google_drive',
        status: 'connected',
        account_email: email,
        refresh_token_encrypted: encryptSecret(args.refreshToken),
        root_folder_id: root.id,
        root_folder_name: ROOT_FOLDER_DEFAULT,
        connected_by: args.connectedBy,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,provider' },
    )
}

export async function disconnectProvider(tenantId: string, provider: BackupProvider = 'google_drive'): Promise<void> {
  const adminClient = createAdminClient()
  await adminClient
    .from('tenant_integrations')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
}

export async function setAutoCreateFolders(tenantId: string, enabled: boolean): Promise<void> {
  const adminClient = createAdminClient()
  await adminClient
    .from('tenant_integrations')
    .update({ auto_create_folders: enabled, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_drive')
}

export async function setAutoBackup(tenantId: string, enabled: boolean): Promise<void> {
  const adminClient = createAdminClient()
  await adminClient
    .from('tenant_integrations')
    .update({ auto_backup: enabled, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_drive')
}

// Resolve a usable access token + root folder for a tenant, or null if not
// connected / misconfigured. Refreshes the short-lived access token each call.
async function getDriveSession(
  tenantId: string,
): Promise<{ accessToken: string; rootFolderId: string } | null> {
  if (!googleConfigured()) return null
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('tenant_integrations')
    .select('refresh_token_encrypted, root_folder_id, status')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_drive')
    .maybeSingle()
  if (!data || data.status !== 'connected' || !data.refresh_token_encrypted) return null

  try {
    const refreshToken = decryptSecret(data.refresh_token_encrypted)
    const accessToken = await gdrive.refreshAccessToken(refreshToken)
    let rootFolderId = data.root_folder_id as string | null
    if (!rootFolderId) {
      const root = await gdrive.ensureFolder(accessToken, ROOT_FOLDER_DEFAULT, null)
      rootFolderId = root.id
      await adminClient
        .from('tenant_integrations')
        .update({ root_folder_id: root.id })
        .eq('tenant_id', tenantId)
        .eq('provider', 'google_drive')
    }
    return { accessToken, rootFolderId }
  } catch (err) {
    await adminClient
      .from('tenant_integrations')
      .update({ status: 'error', last_error: String(err).slice(0, 500) })
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_drive')
    return null
  }
}

function projectFolderName(p: { job_number: string | null; customer_name: string }): string {
  return p.job_number ? `${p.job_number} - ${p.customer_name}` : p.customer_name
}

// Ensure a project has a backup folder in the connected drive, creating it under
// the tenant root if needed and caching the id on the project. Best-effort:
// returns the folder id or null (never throws to the caller).
export async function ensureProjectFolder(
  tenantId: string,
  project: { id: string; job_number: string | null; customer_name: string; drive_folder_id?: string | null },
): Promise<string | null> {
  const session = await getDriveSession(tenantId)
  if (!session) return null
  const adminClient = createAdminClient()
  try {
    if (project.drive_folder_id) return project.drive_folder_id
    const folder = await gdrive.ensureFolder(
      session.accessToken,
      projectFolderName(project),
      session.rootFolderId,
    )
    await adminClient
      .from('projects')
      .update({ drive_folder_id: folder.id, drive_folder_url: folder.webViewLink })
      .eq('id', project.id)
      .eq('tenant_id', tenantId)
    return folder.id
  } catch {
    return null
  }
}

function mimeFromName(name: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf',
  }
  return map[ext] ?? 'application/octet-stream'
}

export type BackupResult = { ok: number; skipped: number; failed: number; folderUrl: string | null; error?: string }

// Push a job's photos + documents into its drive folder (photos/ + documents/
// subfolders), mirroring the local ZIP layout. Reuses getProjectBackup so the
// signed-URL assembly + manifest live in one place.
export async function backupProjectToDrive(tenantId: string, projectId: string): Promise<BackupResult> {
  const session = await getDriveSession(tenantId)
  if (!session) return { ok: 0, skipped: 0, failed: 0, folderUrl: null, error: 'Google Drive is not connected.' }

  const adminClient = createAdminClient()
  const { data: project } = await adminClient
    .from('projects')
    .select('id, job_number, customer_name, drive_folder_id, drive_folder_url')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!project) return { ok: 0, skipped: 0, failed: 0, folderUrl: null, error: 'Project not found.' }

  const backup = await getProjectBackup(projectId)
  if (!backup) return { ok: 0, skipped: 0, failed: 0, folderUrl: null, error: 'Could not prepare backup.' }

  try {
    // Job folder (reuse cached id if present).
    let jobFolderId = project.drive_folder_id as string | null
    let folderUrl = project.drive_folder_url as string | null
    if (!jobFolderId) {
      const folder = await gdrive.ensureFolder(session.accessToken, projectFolderName(project), session.rootFolderId)
      jobFolderId = folder.id
      folderUrl = folder.webViewLink
      await adminClient
        .from('projects')
        .update({ drive_folder_id: folder.id, drive_folder_url: folder.webViewLink })
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
    }

    const photosFolder = await gdrive.ensureFolder(session.accessToken, 'photos', jobFolderId)
    const docsFolder = await gdrive.ensureFolder(session.accessToken, 'documents', jobFolderId)

    let ok = 0
    let skipped = 0
    let failed = 0

    const groups: { folderId: string; files: { url: string; filename: string }[] }[] = [
      { folderId: photosFolder.id, files: backup.photos },
      { folderId: docsFolder.id, files: backup.documents },
    ]
    for (const group of groups) {
      if (group.files.length === 0) continue
      // List the folder once and skip files already uploaded (dedupe). On a
      // listing error we get an empty set and fall back to re-uploading.
      const existing = await gdrive.listFileNames(session.accessToken, group.folderId)
      for (const f of group.files) {
        if (existing.has(f.filename)) {
          skipped++
          continue
        }
        try {
          const res = await fetch(f.url)
          if (!res.ok) throw new Error(String(res.status))
          const bytes = new Uint8Array(await res.arrayBuffer())
          await gdrive.uploadFile(session.accessToken, group.folderId, f.filename, bytes, mimeFromName(f.filename))
          ok++
        } catch {
          failed++
        }
      }
    }

    // README manifest at the job folder root — overwrite in place, never dupe.
    try {
      const manifestBytes = new TextEncoder().encode(backup.manifest)
      const existingReadme = await gdrive.findFileIdByName(session.accessToken, jobFolderId, 'README.txt')
      if (existingReadme) {
        await gdrive.updateFileContent(session.accessToken, existingReadme, manifestBytes, 'text/plain')
      } else {
        await gdrive.uploadFile(session.accessToken, jobFolderId, 'README.txt', manifestBytes, 'text/plain')
      }
    } catch {
      /* manifest is best-effort */
    }

    await adminClient
      .from('projects')
      .update({ last_backup_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('tenant_id', tenantId)

    return { ok, skipped, failed, folderUrl }
  } catch (err) {
    return { ok: 0, skipped: 0, failed: 0, folderUrl: null, error: `Backup failed: ${String(err).slice(0, 200)}` }
  }
}

export type ScheduledBackupSummary = {
  jobs: number
  ok: number
  skipped: number
  failed: number
  errors: number
}

// Cron entry point: back up the N jobs (across all connected, auto-backup
// tenants) with the oldest backups that have new files. Each job goes through
// backupProjectToDrive (which only uploads new files), so incremental nightly
// runs are cheap. Failures are recorded per tenant but never abort the run.
export async function runScheduledBackups(limit = 10): Promise<ScheduledBackupSummary> {
  const summary: ScheduledBackupSummary = { jobs: 0, ok: 0, skipped: 0, failed: 0, errors: 0 }
  if (!googleConfigured()) return summary

  const adminClient = createAdminClient()
  const { data: candidates, error } = await adminClient.rpc('projects_needing_backup', { p_limit: limit })
  if (error || !candidates) return summary

  for (const row of candidates as { project_id: string; tenant_id: string }[]) {
    summary.jobs++
    try {
      const result = await backupProjectToDrive(row.tenant_id, row.project_id)
      if (result.error) {
        summary.errors++
        await adminClient
          .from('tenant_integrations')
          .update({ last_error: result.error.slice(0, 500), updated_at: new Date().toISOString() })
          .eq('tenant_id', row.tenant_id)
          .eq('provider', 'google_drive')
      } else {
        summary.ok += result.ok
        summary.skipped += result.skipped
        summary.failed += result.failed
      }
    } catch (err) {
      summary.errors++
      await adminClient
        .from('tenant_integrations')
        .update({ last_error: String(err).slice(0, 500), updated_at: new Date().toISOString() })
        .eq('tenant_id', row.tenant_id)
        .eq('provider', 'google_drive')
    }
  }

  return summary
}
