'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createProjectShare, getProjectDownloadUrls, revokeShare } from '@/lib/share-actions'
import { zipAndDownload } from '@/lib/zip'

// Download-all (client-side ZIP) + public share-link controls for a project's
// photo gallery. Rendered on the per-project documentation lens.
export default function ProjectShareBar({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [zipping, setZipping] = useState<{ done: number; total: number } | null>(null)
  const [share, setShare] = useState<{ token: string; expiresAt: string } | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const shareUrl = share ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${share.token}` : ''

  async function downloadAll() {
    if (zipping) return
    const items = await getProjectDownloadUrls(projectId)
    if (items.length === 0) {
      toast.info('No photos to download.')
      return
    }
    setZipping({ done: 0, total: items.length })
    try {
      const safe = projectName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'photos'
      const { ok, failed } = await zipAndDownload(items, `${safe}.zip`, (done, total) => setZipping({ done, total }))
      if (failed > 0) toast.warning(`Downloaded ${ok}, ${failed} failed.`)
    } finally {
      setZipping(null)
    }
  }

  async function openShare() {
    setBusy(true)
    const res = await createProjectShare(projectId)
    setBusy(false)
    if (res.error || !res.token) {
      toast.error(res.error ?? 'Could not create link.')
      return
    }
    setShare({ token: res.token, expiresAt: res.expiresAt! })
    setShareOpen(true)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied.')
    } catch {
      toast.error('Copy failed — select and copy manually.')
    }
  }

  async function turnOff() {
    if (!share) return
    await revokeShare(share.token)
    setShare(null)
    setShareOpen(false)
    toast.success('Share link turned off.')
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={downloadAll}
        disabled={!!zipping}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {zipping ? `Zipping ${zipping.done}/${zipping.total}…` : 'Download all'}
      </button>

      <button
        type="button"
        onClick={openShare}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#00A896] px-3 py-2 text-sm font-semibold text-white hover:bg-[#008F7E] disabled:opacity-60"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
        </svg>
        Share
      </button>

      {shareOpen && share && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Public share link</h3>
            <button type="button" onClick={() => setShareOpen(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">Anyone with this link can view and download these photos — no login needed.</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-700" />
            <button type="button" onClick={copyLink} className="rounded-md bg-[#0D1B2A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b1724]">
              Copy
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <span>Expires {new Date(share.expiresAt).toLocaleDateString()}</span>
            <button type="button" onClick={turnOff} className="font-medium text-red-500 hover:text-red-600">
              Turn off link
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
