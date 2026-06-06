'use client'

import { useMemo, useState } from 'react'
import type { Tag, TagRef } from '@/lib/types'
import {
  attachPhotoTag,
  attachProjectTag,
  createTag,
  detachPhotoTag,
  detachProjectTag,
} from '@/lib/tag-actions'
import TagChip from '@/components/TagChip'

// Add/remove tags on a project or photo, with inline-create autocompleting
// against the canonical tenant tag list. Optimistic; calls the server actions.
export default function TagEditor({
  target,
  targetId,
  value,
  allTags,
  onChange,
  onTagCreated,
}: {
  target: 'photo' | 'project'
  targetId: string
  value: TagRef[]
  allTags: Tag[]
  onChange: (next: TagRef[]) => void
  onTagCreated?: (tag: Tag) => void
}) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const attach = target === 'photo' ? attachPhotoTag : attachProjectTag
  const detach = target === 'photo' ? detachPhotoTag : detachProjectTag

  const selectedIds = useMemo(() => new Set(value.map((t) => t.id)), [value])
  const query = input.trim().toLowerCase()
  const suggestions = query
    ? allTags.filter((t) => t.name.includes(query) && !selectedIds.has(t.id)).slice(0, 6)
    : []
  const exactExists = allTags.some((t) => t.name === query)

  async function addExisting(tag: Tag) {
    if (busy || selectedIds.has(tag.id)) return
    setBusy(true)
    onChange([...value, { id: tag.id, name: tag.name, color: tag.color }])
    setInput('')
    const res = await attach(targetId, tag.id)
    if (res.error) onChange(value) // revert
    setBusy(false)
  }

  async function createAndAdd() {
    if (busy || !query) return
    setBusy(true)
    const res = await createTag(query)
    if (res.tag) {
      onTagCreated?.(res.tag)
      if (!selectedIds.has(res.tag.id)) {
        onChange([...value, { id: res.tag.id, name: res.tag.name, color: res.tag.color }])
        await attach(targetId, res.tag.id)
      }
      setInput('')
    }
    setBusy(false)
  }

  async function remove(tag: TagRef) {
    if (busy) return
    setBusy(true)
    const prev = value
    onChange(value.filter((t) => t.id !== tag.id))
    const res = await detach(targetId, tag.id)
    if (res.error) onChange(prev)
    setBusy(false)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <TagChip key={t.id} tag={t} onRemove={() => remove(t)} />
        ))}
        {value.length === 0 && <span className="text-xs text-gray-400">No tags yet</span>}
      </div>

      <div className="relative mt-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const match = allTags.find((t) => t.name === query)
              if (match) addExisting(match)
              else if (query) createAndAdd()
            }
          }}
          placeholder="Add a tag…"
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-[#00A896] focus:outline-none focus:ring-1 focus:ring-[#00A896]"
        />
        {query && (suggestions.length > 0 || !exactExists) && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            {suggestions.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => addExisting(t)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                {t.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />}
                <span className="text-gray-700">{t.name}</span>
              </button>
            ))}
            {!exactExists && (
              <button
                type="button"
                onClick={createAndAdd}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[#0F6E56] hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create “{query}”
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
