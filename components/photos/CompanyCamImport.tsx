'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  disconnect,
  getImportState,
  processChunk,
  saveConnection,
  startImport,
  type ImportJob,
  type ImportState,
} from '@/lib/companycam/actions'

export default function CompanyCamImport({ initialState }: { initialState: ImportState }) {
  const [state, setState] = useState<ImportState>(initialState)
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [job, setJob] = useState<ImportJob | null>(initialState.job)
  const running = useRef(false)

  const isActive = job?.status === 'running' || job?.status === 'pending'

  // Drive the chunked import: call processChunk in a loop until done/failed.
  async function runLoop() {
    if (running.current) return
    running.current = true
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await processChunk()
        if (res.job) setJob(res.job)
        if (res.error) {
          toast.error(res.error)
          break
        }
        if (res.done || !res.job) break
      }
    } finally {
      running.current = false
      setState(await getImportState())
    }
  }

  // Resume an in-flight import if the page was reloaded mid-run.
  useEffect(() => {
    if (initialState.job && (initialState.job.status === 'running' || initialState.job.status === 'pending')) {
      runLoop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConnect() {
    const t = token.trim()
    if (!t || saving) return
    setSaving(true)
    const res = await saveConnection(t)
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('CompanyCam connected.')
    setToken('')
    setState(await getImportState())
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect CompanyCam? Already-imported photos stay in Kolrabee.')) return
    await disconnect()
    setState(await getImportState())
    setJob(null)
  }

  async function handleStart() {
    const res = await startImport()
    if (res.error) {
      toast.error(res.error)
      return
    }
    setJob(res.job ?? null)
    runLoop()
  }

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Import from CompanyCam</h1>
      <p className="mb-6 text-sm text-gray-500">
        Bring your CompanyCam projects and photos into Kolrabee. Imported projects appear in
        Galleries and All Photos, separate from your dispatch jobs.
      </p>

      {!state.connected ? (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Connect your account</h2>
          <p className="mt-1 text-xs text-gray-500">
            Paste a CompanyCam API token from{' '}
            <a
              href="https://app.companycam.com/access_tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0F6E56] underline"
            >
              app.companycam.com/access_tokens
            </a>
            . It’s stored securely and only used server-side.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="CompanyCam API token"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#00A896] focus:outline-none focus:ring-1 focus:ring-[#00A896]"
            />
            <button
              type="button"
              onClick={handleConnect}
              disabled={saving || !token.trim()}
              className="rounded-md bg-[#00A896] px-4 py-2 text-sm font-semibold text-white hover:bg-[#008F7E] disabled:opacity-50"
            >
              {saving ? 'Verifying…' : 'Connect'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span className="h-2 w-2 rounded-full bg-[#00A896]" />
                CompanyCam connected
              </div>
              {state.lastImportAt && (
                <div className="mt-0.5 text-xs text-gray-500">
                  Last import {new Date(state.lastImportAt).toLocaleString()}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
            >
              Disconnect
            </button>
          </div>

          {job && (job.status !== 'pending' || isActive) && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  {job.status === 'running' && (job.phase === 'projects' ? 'Importing projects…' : 'Importing photos…')}
                  {job.status === 'completed' && 'Import complete'}
                  {job.status === 'failed' && 'Import failed'}
                  {job.status === 'pending' && 'Starting…'}
                </span>
                {isActive && (
                  <svg className="h-4 w-4 animate-spin text-[#00A896]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <Stat label="Projects" value={job.projects_done} />
                <Stat label="Photos" value={job.photos_done} />
                <Stat label="Skipped" value={job.photos_failed} muted />
              </div>
              {job.error && <p className="mt-3 text-sm text-red-600">{job.error}</p>}
              {job.status === 'completed' && (
                <Link
                  href="/admin/photos/galleries"
                  className="mt-4 inline-flex rounded-md bg-[#00A896] px-4 py-2 text-sm font-semibold text-white hover:bg-[#008F7E]"
                >
                  View Galleries
                </Link>
              )}
            </div>
          )}

          {!isActive && (
            <button
              type="button"
              onClick={handleStart}
              className="rounded-md bg-[#0D1B2A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0b1724]"
            >
              {job?.status === 'completed' || job?.status === 'failed' ? 'Run import again' : 'Start import'}
            </button>
          )}
          <p className="text-xs text-gray-400">
            Keep this tab open while importing. Large libraries may take several minutes; the import
            resumes where it left off if interrupted. Tags aren’t imported in this version.
          </p>
        </div>
      )}
    </main>
  )
}

function Stat({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`rounded-md p-3 ${muted ? 'bg-gray-50' : 'bg-[#00A896]/5'}`}>
      <div className={`text-xl font-bold ${muted ? 'text-gray-500' : 'text-[#0F6E56]'}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  )
}
