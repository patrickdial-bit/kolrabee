'use client'

import type { TagRef } from '@/lib/types'

// A colored pill. Uses the tag's color when set, otherwise a neutral chip.
export default function TagChip({
  tag,
  onRemove,
  size = 'sm',
}: {
  tag: TagRef
  onRemove?: () => void
  size?: 'sm' | 'xs'
}) {
  const hasColor = !!tag.color
  const padding = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${padding} ${
        hasColor ? 'text-white' : 'bg-gray-100 text-gray-700'
      }`}
      style={hasColor ? { backgroundColor: tag.color! } : undefined}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className={`-mr-0.5 rounded-full hover:bg-black/10 ${hasColor ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
          aria-label={`Remove ${tag.name}`}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}
