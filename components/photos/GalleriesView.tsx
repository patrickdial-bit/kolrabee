'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { GalleryProject, Tag } from '@/lib/types'
import { getGalleries } from '@/lib/tag-actions'
import TagFilter from '@/components/TagFilter'
import ProjectRow from '@/components/photos/ProjectRow'

// Galleries = the per-project documentation lens list. Free-text search on
// name + address, a Tags dropdown (OR filter), and a project list with photo
// counts + recent-photo strips. Named "Galleries" to stay distinct from the
// Dashboard, which already lists projects.
export default function GalleriesView({
  initialProjects,
  tags,
}: {
  initialProjects: GalleryProject[]
  tags: Tag[]
}) {
  const [projects, setProjects] = useState(initialProjects)
  const [search, setSearch] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const firstRender = useRef(true)

  // Live filtering: refetch (debounced) whenever search or tags change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const handle = setTimeout(async () => {
      setLoading(true)
      const next = await getGalleries({ search, tagIds })
      setProjects(next)
      setLoading(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [search, tagIds])

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Galleries</h1>
          <p className="text-sm text-gray-500">Per-project photo documentation</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="inline-flex items-center justify-center rounded-md bg-[#00A896] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#008F7E]"
        >
          New project
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or address"
            className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#00A896] focus:ring-1 focus:ring-[#00A896]"
          />
        </div>
        <TagFilter tags={tags} selected={tagIds} onChange={setTagIds} />
      </div>

      {loading && <div className="py-2 text-sm text-gray-400">Updating…</div>}

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-500">
          No projects match. Adjust your search or tag filters.
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
        </div>
      )}
    </main>
  )
}
