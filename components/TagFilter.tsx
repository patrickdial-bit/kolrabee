'use client'

import { useEffect, useRef, useState } from 'react'
import type { Tag } from '@/lib/types'

// Multi-select, searchable tag dropdown. Emits the selected tag ids. Filter
// semantics are OR (match any) — applied by the caller's query.
export default function TagFilter({
  tags,
  selected,
  onChange,
}: {
  tags: Tag[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selectedSet = new Set(selected)
  const filtered = tags.filter((t) => t.name.includes(search.trim().toLowerCase()))

  function toggle(id: string) {
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z M6 6h.008v.008H6V6Z" />
        </svg>
        Tags
        {selected.length > 0 && (
          <span className="ml-1 rounded-full bg-[#00A896] px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {selected.length}
          </span>
        )}
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tags"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-[#00A896] focus:outline-none focus:ring-1 focus:ring-[#00A896]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">No tags found</div>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    selectedSet.has(t.id) ? 'border-[#00A896] bg-[#00A896] text-white' : 'border-gray-300'
                  }`}
                >
                  {selectedSet.has(t.id) && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                {t.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />}
                <span className="truncate text-gray-700">{t.name}</span>
              </button>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-md px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Clear ({selected.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
