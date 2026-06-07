'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { backupJobToDrive } from '@/app/admin/backup/actions'

// "Back up to Drive" — pushes this job's photos + documents into its Google
// Drive folder. Only rendered when the tenant has Drive connected.
export default function BackupToDriveButton({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [running, setRunning] = useState(false)

  const run = () => {
    setRunning(true)
    startTransition(async () => {
      const res = await backupJobToDrive(projectId)
      setRunning(false)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      const ok = res?.ok ?? 0
      const skipped = res?.skipped ?? 0
      const failed = res?.failed ?? 0
      const parts = [`${ok} backed up`]
      if (skipped > 0) parts.push(`${skipped} already there`)
      if (failed > 0) parts.push(`${failed} failed`)
      const summary = parts.join(', ')
      if (failed > 0) toast.warning(`Drive backup: ${summary}.`)
      else if (ok === 0 && skipped > 0) toast.success(`Already up to date — ${skipped} file${skipped === 1 ? '' : 's'} in Drive.`)
      else toast.success(`Drive backup: ${summary}.`)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={isPending || running}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      title="Back up this job's photos and documents to your connected Google Drive"
    >
      <svg className="h-4 w-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
        <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
      </svg>
      {running ? 'Backing up…' : 'Back up to Drive'}
    </button>
  )
}
