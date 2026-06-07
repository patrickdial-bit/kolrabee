'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { getProjectBackup } from '@/lib/backup-actions'
import { zipBackupAndDownload } from '@/lib/zip'

// One-click local backup of a job: bundles its photos + documents into a single
// organized ZIP (photos/, documents/, README). This is the "local" destination
// of the backup feature; cloud destinations (Google Drive, Dropbox, OneDrive)
// are planned and will reuse the same getProjectBackup payload.
export default function BackupButton({
  projectId,
  variant = 'secondary',
  className = '',
}: {
  projectId: string
  variant?: 'primary' | 'secondary'
  className?: string
}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function run() {
    if (progress) return
    setProgress({ done: 0, total: 0 })
    try {
      const backup = await getProjectBackup(projectId)
      if (!backup) {
        toast.error('Could not prepare backup.')
        setProgress(null)
        return
      }
      const fileCount = backup.photos.length + backup.documents.length
      if (fileCount === 0) {
        toast.info('Nothing to back up yet — no photos or documents on this job.')
        setProgress(null)
        return
      }
      setProgress({ done: 0, total: fileCount })
      const { ok, failed } = await zipBackupAndDownload(
        {
          rootFolder: backup.folderName,
          groups: [
            { folder: 'photos', items: backup.photos },
            { folder: 'documents', items: backup.documents },
          ],
          textFiles: [{ filename: 'README.txt', content: backup.manifest }],
        },
        `${backup.folderName}-backup.zip`,
        (done, total) => setProgress({ done, total }),
      )
      if (failed > 0) toast.warning(`Backed up ${ok} file${ok === 1 ? '' : 's'}, ${failed} failed.`)
      else toast.success(`Backup ready — ${ok} file${ok === 1 ? '' : 's'}.`)
    } catch {
      toast.error('Backup failed. Try again.')
    } finally {
      setProgress(null)
    }
  }

  const base = variant === 'primary'
    ? 'bg-ember text-white hover:bg-primary-700'
    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'

  const label = progress
    ? progress.total > 0 ? `Backing up ${progress.done}/${progress.total}…` : 'Preparing…'
    : 'Download Backup'

  return (
    <button
      type="button"
      onClick={run}
      disabled={!!progress}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60 ${base} ${className}`}
      title="Download a ZIP backup of this job's photos and documents"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
      </svg>
      {label}
    </button>
  )
}
