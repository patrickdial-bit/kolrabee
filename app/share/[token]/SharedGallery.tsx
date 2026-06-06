'use client'

import { useState } from 'react'
import type { SharedView, SharedPhoto } from '@/lib/share-actions'
import { downloadUrlAsFile, zipAndDownload } from '@/lib/zip'

export default function SharedGallery({ view }: { view: Extract<SharedView, { kind: 'project' | 'photo' }> }) {
  const [active, setActive] = useState<SharedPhoto | null>(view.kind === 'photo' ? view.photo : null)
  const [zipping, setZipping] = useState<{ done: number; total: number } | null>(null)

  const photos = view.kind === 'project' ? view.photos : [view.photo]

  async function downloadAll() {
    if (view.kind !== 'project' || zipping) return
    const items = view.photos
      .filter((p) => p.full_url)
      .map((p) => ({ url: p.full_url as string, filename: p.filename }))
    if (items.length === 0) return
    setZipping({ done: 0, total: items.length })
    try {
      const safe = view.projectName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'photos'
      await zipAndDownload(items, `${safe}.zip`, (done, total) => setZipping({ done, total }))
    } finally {
      setZipping(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="font-display text-lg font-black uppercase tracking-tight text-[#0D1B2A]">
              kol<span className="text-[#00A896]">ra</span>bee
            </div>
            <div className="mt-0.5 truncate text-sm text-gray-500">{view.companyName}</div>
          </div>
          {view.kind === 'project' && photos.length > 0 && (
            <button
              type="button"
              onClick={downloadAll}
              disabled={!!zipping}
              className="shrink-0 rounded-md bg-[#00A896] px-4 py-2 text-sm font-semibold text-white hover:bg-[#008F7E] disabled:opacity-60"
            >
              {zipping ? `Zipping ${zipping.done}/${zipping.total}…` : 'Download all'}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">{view.projectName}</h1>
        {view.kind === 'project' && view.address && <p className="text-sm text-gray-500">{view.address}</p>}
        <p className="mt-1 text-sm text-gray-400">
          {photos.length} photo{photos.length === 1 ? '' : 's'}
        </p>

        {photos.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-500">
            No photos in this share.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActive(p)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100"
              >
                {p.thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumb_url} alt={p.caption ?? ''} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">No preview</div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {active && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={() => setActive(null)}>
          <div className="flex items-center justify-end gap-2 p-3" onClick={(e) => e.stopPropagation()}>
            {active.full_url && (
              <button
                type="button"
                onClick={() => downloadUrlAsFile(active.full_url as string, active.filename)}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
              >
                Download
              </button>
            )}
            <button
              type="button"
              onClick={() => setActive(null)}
              className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
            >
              Close
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-4" onClick={() => setActive(null)}>
            {active.full_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.full_url} alt={active.caption ?? ''} className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="text-white/60">Image unavailable</div>
            )}
          </div>
          {active.caption && <div className="p-4 text-center text-sm text-white/80">{active.caption}</div>}
        </div>
      )}
    </div>
  )
}
