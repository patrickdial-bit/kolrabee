'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import {
  disconnectProvider,
  setAutoCreateFolders,
  setAutoBackup,
  backupProjectToDrive,
} from '@/lib/integrations/backup'

export async function disconnectGoogleDrive() {
  const { tenant } = await getCurrentUser()
  await disconnectProvider(tenant.id, 'google_drive')
  revalidatePath('/admin/backup')
  return { success: true }
}

export async function updateAutoCreateFolders(enabled: boolean) {
  const { tenant } = await getCurrentUser()
  await setAutoCreateFolders(tenant.id, enabled)
  revalidatePath('/admin/backup')
  return { success: true }
}

export async function updateAutoBackup(enabled: boolean) {
  const { tenant } = await getCurrentUser()
  await setAutoBackup(tenant.id, enabled)
  revalidatePath('/admin/backup')
  return { success: true }
}

// Push a single job's photos + documents to the connected Google Drive. Used by
// the "Back up to Drive" control on the project detail page.
export async function backupJobToDrive(projectId: string) {
  const { tenant } = await getCurrentUser()
  const result = await backupProjectToDrive(tenant.id, projectId)
  if (result.error) return { error: result.error }
  revalidatePath(`/admin/projects/${projectId}`)
  return { success: true, ok: result.ok, skipped: result.skipped, failed: result.failed, folderUrl: result.folderUrl }
}
