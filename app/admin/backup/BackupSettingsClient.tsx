'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import type { IntegrationStatus } from '@/lib/integrations/backup'
import { disconnectGoogleDrive, updateAutoCreateFolders } from './actions'

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'Google Drive backup isn’t configured on the server yet (missing credentials).',
  denied: 'Google sign-in was cancelled.',
  missing_code: 'Google didn’t return an authorization code. Try again.',
  bad_state: 'The sign-in session expired or didn’t match. Try again.',
  tenant_mismatch: 'That Google account was authorized for a different workspace.',
  no_refresh_token: 'Google didn’t return a refresh token — please try connecting again.',
  exchange_failed: 'Couldn’t complete the Google connection. Try again.',
  auth: 'Please sign in and try again.',
}

export default function BackupSettingsClient({
  tenantName,
  status,
}: {
  tenantName: string
  status: IntegrationStatus
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [autoCreate, setAutoCreate] = useState(status.autoCreateFolders)

  // Surface the OAuth round-trip result once, then clean the URL.
  useEffect(() => {
    if (params.get('connected')) {
      toast.success('Google Drive connected.')
      router.replace('/admin/backup')
    }
    const err = params.get('error')
    if (err) {
      toast.error(ERROR_MESSAGES[err] ?? 'Something went wrong connecting Google Drive.')
      router.replace('/admin/backup')
    }
  }, [params, router])

  const handleDisconnect = () => {
    if (!confirm('Disconnect Google Drive? New projects will stop creating Drive folders. Existing backed-up files stay in your Drive.')) return
    startTransition(async () => {
      await disconnectGoogleDrive()
      toast.success('Google Drive disconnected.')
      router.refresh()
    })
  }

  const handleToggleAuto = (next: boolean) => {
    setAutoCreate(next)
    startTransition(async () => {
      await updateAutoCreateFolders(next)
    })
  }

  return (
    <AppShell variant="admin" companyName={tenantName}>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Backup</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect cloud storage to automatically keep a copy of every job’s photos and documents.
          </p>
        </div>

        {/* Google Drive */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 border border-gray-200">
                <svg className="h-6 w-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Google Drive</h2>
                {status.connected ? (
                  <p className="text-sm text-gray-600">
                    Connected{status.accountEmail ? ` as ${status.accountEmail}` : ''}. Backups go to your
                    {' '}<span className="font-medium">{status.rootFolderName ?? 'Kolrabee Backups'}</span> folder.
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    Auto-create a folder for each new project and back up its photos and documents.
                  </p>
                )}
              </div>
            </div>
            <span
              className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                status.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {status.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          {!status.configured && (
            <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Google Drive backup isn’t configured on the server yet. An administrator needs to set the
              <code className="mx-1 rounded bg-amber-100 px-1">GOOGLE_CLIENT_ID</code>,
              <code className="mx-1 rounded bg-amber-100 px-1">GOOGLE_CLIENT_SECRET</code>, and
              <code className="mx-1 rounded bg-amber-100 px-1">INTEGRATION_ENCRYPTION_KEY</code> environment variables.
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {status.connected ? (
              <>
                <button
                  onClick={handleDisconnect}
                  disabled={isPending}
                  className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  Disconnect
                </button>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={autoCreate}
                    onChange={(e) => handleToggleAuto(e.target.checked)}
                    disabled={isPending}
                    className="h-4 w-4 rounded border-gray-300 text-ember focus:ring-ember"
                  />
                  Auto-create a Drive folder when a new project is added
                </label>
              </>
            ) : (
              <a
                href="/api/integrations/google/start"
                aria-disabled={!status.configured}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white ${
                  status.configured ? 'bg-ember hover:bg-primary-700' : 'bg-gray-300 pointer-events-none'
                }`}
              >
                Connect Google Drive
              </a>
            )}
          </div>
        </div>

        {/* Other providers — planned */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">More destinations</h2>
          <ul className="space-y-2 text-sm text-gray-500">
            <li className="flex items-center justify-between">
              <span>Dropbox</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">Coming soon</span>
            </li>
            <li className="flex items-center justify-between">
              <span>OneDrive</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">Coming soon</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            You can always download a local ZIP backup of any job from its detail page or photo gallery.
          </p>
        </div>
      </main>
    </AppShell>
  )
}
