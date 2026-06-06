'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { Tag } from '@/lib/types'
import { createTag, updateTag, deleteTag } from '@/lib/tag-actions'

type TagRow = Tag & { photo_count: number; project_count: number }

const SWATCHES = ['#00A896', '#0F6E56', '#0D1B2A', '#E07A5F', '#F2CC8F', '#3D405B', '#81B29A', '#9C6644']

// Tag management: the canonical, tenant-scoped vocabulary. Create, recolor,
// and delete tags. Deleting a tag cascades its photo/project links (FK).
export default function TagsManager({ initialTags }: { initialTags: TagRow[] }) {
  const [tags, setTags] = useState<TagRow[]>(initialTags)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    const name = newName.trim()
    if (!name || busy) return
    setBusy(true)
    const res = await createTag(name)
    if (res.error || !res.tag) {
      toast.error(res.error ?? 'Could not create tag')
    } else if (tags.some((t) => t.id === res.tag!.id)) {
      toast.info('Tag already exists')
    } else {
      setTags((prev) => [...prev, { ...res.tag!, photo_count: 0, project_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    }
    setBusy(false)
  }

  async function handleColor(tag: TagRow, color: string) {
    const next = tag.color === color ? null : color
    setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, color: next } : t)))
    const res = await updateTag(tag.id, { color: next })
    if (res.error) toast.error(res.error)
  }

  async function handleDelete(tag: TagRow) {
    if (!confirm(`Delete tag “${tag.name}”? It will be removed from ${tag.photo_count} photo(s) and ${tag.project_count} project(s).`)) return
    const prev = tags
    setTags((p) => p.filter((t) => t.id !== tag.id))
    const res = await deleteTag(tag.id)
    if (res.error) {
      toast.error(res.error)
      setTags(prev)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Tags</h1>
      <p className="mb-6 text-sm text-gray-500">
        Your canonical tag vocabulary — the same tags filter both Galleries and Photos.
      </p>

      <div className="mb-6 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="New tag name"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#00A896] focus:outline-none focus:ring-1 focus:ring-[#00A896]"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy || !newName.trim()}
          className="rounded-md bg-[#00A896] px-4 py-2 text-sm font-semibold text-white hover:bg-[#008F7E] disabled:opacity-50"
        >
          Add tag
        </button>
      </div>

      {tags.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
          No tags yet. Create one above, or add tags to a photo and they’ll appear here.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center gap-3 p-3">
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-gray-200"
                style={{ backgroundColor: tag.color ?? '#e5e7eb' }}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{tag.name}</span>
              <span className="hidden text-xs text-gray-400 sm:inline">
                {tag.photo_count} photo{tag.photo_count === 1 ? '' : 's'} · {tag.project_count} project{tag.project_count === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-1">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColor(tag, c)}
                    className={`h-4 w-4 rounded-full ring-offset-1 transition ${tag.color === c ? 'ring-2 ring-gray-700' : ''}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Set color ${c}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(tag)}
                className="ml-1 rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
                aria-label={`Delete ${tag.name}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
