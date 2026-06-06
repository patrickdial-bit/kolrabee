'use client'

import Link from 'next/link'
import type { GalleryProject } from '@/lib/types'
import TagChip from '@/components/TagChip'

// One project in the Galleries list: name/address + tag chips on the left,
// photo count + recent-photo strip on the right. Mirrors the CompanyCam
// projects layout. Links to the per-project documentation lens.
export default function ProjectRow({ project }: { project: GalleryProject }) {
  const strip = project.recent_thumb_urls.slice(0, 4)
  return (
    <Link
      href={`/admin/photos/galleries/${project.id}`}
      className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-[#00A896]/50 hover:bg-[#00A896]/[0.03]"
    >
      {/* Left: name, address, tags */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-gray-900">{project.customer_name}</div>
        <div className="truncate text-xs text-gray-500">{project.address}</div>
        {project.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {project.tags.map((t) => (
              <TagChip key={t.id} tag={t} size="xs" />
            ))}
          </div>
        )}
      </div>

      {/* Right: count + recent thumbnails */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-900">{project.photo_count}</div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400">photos</div>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          {strip.length === 0 ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-100 text-gray-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
              </svg>
            </div>
          ) : (
            strip.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                className="h-12 w-12 rounded-md object-cover"
                loading="lazy"
              />
            ))
          )}
        </div>
      </div>
    </Link>
  )
}
