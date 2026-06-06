'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { PhotoListItem, Tag } from '@/lib/types'
import { getPhotos, type PhotoFilters } from '@/lib/tag-actions'
import { getPhotoFullUrl } from '@/lib/photo-actions'
import TagFilter from '@/components/TagFilter'
import TagEditor from '@/components/TagEditor'
import PhotoCard from '@/components/photos/PhotoCard'

type Props = {
  initialPhotos: PhotoListItem[]
  tags: Tag[]
  projects: { id: string; customer_name: string }[]
  users: { id: string; name: string }[]
  // When set, the view is the per-project lens: project filter is fixed/hidden.
  fixedProjectId?: string
  title?: string
}

function effIso(p: PhotoListItem): string {
  return p.taken_at ?? p.created_at
}

// All Photos = date-grouped grid with a filter bar (date range, project, user,
// tags). Selecting filters narrows the list live. Grouping into "Thursday,
// June 4th" sections happens client-side.
export default function PhotosView({ initialPhotos, tags, projects, users, fixedProjectId, title }: Props) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [allTags, setAllTags] = useState(tags)
  const [loading, setLoading] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [projectId, setProjectId] = useState('')
  const [userId, setUserId] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [active, setActive] = useState<PhotoListItem | null>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const handle = setTimeout(async () => {
      setLoading(true)
      const filters: PhotoFilters = {
        projectId: fixedProjectId ?? (projectId || null),
        userId: userId || null,
        start: start || null,
        end: end || null,
        tagIds,
      }
      const next = await getPhotos(filters)
      setPhotos(next)
      setLoading(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [start, end, projectId, userId, tagIds, fixedProjectId])

  // Group by calendar date of the effective time.
  const groups = useMemo(() => {
    const map = new Map<string, PhotoListItem[]>()
    for (const p of photos) {
      const key = effIso(p).slice(0, 10)
      const list = map.get(key) ?? []
      list.push(p)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [photos])

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">{title ?? 'All Photos'}</h1>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs font-medium text-gray-500">
          Start date
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-[#00A896] focus:ring-1 focus:ring-[#00A896]" />
        </label>
        <label className="flex flex-col text-xs font-medium text-gray-500">
          End date
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-[#00A896] focus:ring-1 focus:ring-[#00A896]" />
        </label>
        {!fixedProjectId && (
          <label className="flex flex-col text-xs font-medium text-gray-500">
            Project
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-[#00A896] focus:ring-1 focus:ring-[#00A896]">
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.customer_name}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col text-xs font-medium text-gray-500">
          User
          <select value={userId} onChange={(e) => setUserId(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-[#00A896] focus:ring-1 focus:ring-[#00A896]">
            <option value="">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <div className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Tags</span>
          <TagFilter tags={allTags} selected={tagIds} onChange={setTagIds} />
        </div>
      </div>

      {loading && <div className="py-2 text-sm text-gray-400">Updating…</div>}

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-500">
          No photos match these filters.
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                {format(parseISO(date), 'EEEE, MMMM do')}
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {items.map((p) => (
                  <PhotoCard key={p.id} photo={p} onOpen={() => setActive(p)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {active && (
        <Lightbox
          photo={active}
          allTags={allTags}
          onClose={() => setActive(null)}
          onTagsChange={(next) => {
            setPhotos((prev) => prev.map((p) => (p.id === active.id ? { ...p, tags: next } : p)))
            setActive((cur) => (cur ? { ...cur, tags: next } : cur))
          }}
          onTagCreated={(t) => setAllTags((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]))}
        />
      )}
    </main>
  )
}

function Lightbox({
  photo,
  allTags,
  onClose,
  onTagsChange,
  onTagCreated,
}: {
  photo: PhotoListItem
  allTags: Tag[]
  onClose: () => void
  onTagsChange: (next: PhotoListItem['tags']) => void
  onTagCreated: (t: Tag) => void
}) {
  const [fullUrl, setFullUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setFullUrl(null)
    getPhotoFullUrl(photo.id).then((res) => {
      if (!cancelled) setFullUrl(res.url ?? photo.thumb_url)
    })
    return () => {
      cancelled = true
    }
  }, [photo.id, photo.thumb_url])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-1 items-center justify-center bg-black">
          {fullUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fullUrl} alt={photo.caption ?? ''} className="max-h-[60vh] w-full object-contain sm:max-h-[90vh]" />
          ) : (
            <div className="flex h-64 w-full items-center justify-center text-white/50">Loading…</div>
          )}
        </div>
        <div className="w-full shrink-0 space-y-4 overflow-y-auto p-4 sm:w-72">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">{photo.project_name}</div>
              <div className="text-xs text-gray-500">{photo.uploader_name}</div>
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {photo.caption && <p className="text-sm text-gray-700">{photo.caption}</p>}
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Tags</div>
            <TagEditor
              target="photo"
              targetId={photo.id}
              value={photo.tags}
              allTags={allTags}
              onChange={onTagsChange}
              onTagCreated={onTagCreated}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
