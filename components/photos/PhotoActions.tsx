'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createPhotoShare, getPhotoDownloadUrl, revokeShare } from '@/lib/share-actions'
import { downloadUrlAsFile } from '@/lib/zip'
import { clientSiteUrl } from '@/lib/site-url'

// Download + public share-link controls for a single photo (used in the
// photo lightbox).
export default function PhotoActions({ photoId }: { photoId: string }) {
  const [downloading, setDownloading] = useState(false)
  const [share, setShare] = useState<{ token: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const shareUrl = share ? `${clientSiteUrl()}/share/${share.token}` : ''

  async function download() {
    if (downloading) return
    setDownloading(true)
    try {
      const res = await getPhotoDownloadUrl(photoId)
      if (res.error || !res.url) {
        toast.error(res.error ?? 'Could not download.')
        return
      }
      await downloadUrlAsFile(res.url, res.filename ?? 'photo.jpg')
    } catch {
      toast.error('Download failed.')
    } finally {
      setDownloading(false)
    }
  }

  async function makeShare() {
    if (share) {
      copy()
      return
    }
    setBusy(true)
    const res = await createPhotoShare(photoId)
    setBusy(false)
    if (res.error || !res.token) {
      toast.error(res.error ?? 'Could not create link.')
      return
    }
    setShare({ token: res.token, expiresAt: res.expiresAt! })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied.')
    } catch {
      toast.error('Copy failed.')
    }
  }

  async function turnOff() {
    if (!share) return
    await revokeShare(share.token)
    setShare(null)
    toast.success('Link turned off.')
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {downloading ? '…' : 'Download'}
        </button>
        <button
          type="button"
          onClick={makeShare}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#00A896] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#008F7E] disabled:opacity-60"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
          </svg>
          {share ? 'Copy link' : 'Share'}
        </button>
      </div>
      {share && (
        <div className="mt-2 rounded-md bg-gray-50 p-2">
          <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} className="w-full bg-transparent text-xs text-gray-600" />
          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
            <span>Expires {new Date(share.expiresAt).toLocaleDateString()}</span>
            <button type="button" onClick={turnOff} className="font-medium text-red-500 hover:text-red-600">Turn off</button>
          </div>
        </div>
      )}
    </div>
  )
}
