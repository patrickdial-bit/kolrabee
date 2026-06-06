'use client'

import type { PhotoListItem } from '@/lib/types'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function timeLabel(p: PhotoListItem): string {
  const iso = p.taken_at ?? p.created_at
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

// One photo tile: thumbnail, uploader initials badge, project name, time.
// Tap opens the lightbox (handled by the parent view).
export default function PhotoCard({ photo, onOpen }: { photo: PhotoListItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block overflow-hidden rounded-lg bg-gray-100 text-left"
    >
      <div className="aspect-square w-full">
        {photo.thumb_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.thumb_url}
            alt={photo.caption ?? ''}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
            </svg>
          </div>
        )}
      </div>

      {/* Uploader badge */}
      <span
        className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#0D1B2A]/80 text-[10px] font-bold text-white"
        title={photo.uploader_name}
      >
        {initials(photo.uploader_name)}
      </span>

      {/* Bottom gradient with project + time */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
        <div className="truncate text-[11px] font-medium text-white">{photo.project_name}</div>
        <div className="text-[10px] text-white/70">{timeLabel(photo)}</div>
      </div>
    </button>
  )
}
