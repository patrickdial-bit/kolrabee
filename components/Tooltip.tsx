'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useTooltips } from '@/lib/tooltip-context'

interface TooltipProps {
  text: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ text, children, position = 'top' }: TooltipProps) {
  const { enabled } = useTooltips()
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return
    const tRect = triggerRef.current.getBoundingClientRect()
    const ttRect = tooltipRef.current.getBoundingClientRect()
    let top = 0, left = 0

    switch (position) {
      case 'top':
        top = tRect.top - ttRect.height - 8
        left = tRect.left + tRect.width / 2 - ttRect.width / 2
        break
      case 'bottom':
        top = tRect.bottom + 8
        left = tRect.left + tRect.width / 2 - ttRect.width / 2
        break
      case 'left':
        top = tRect.top + tRect.height / 2 - ttRect.height / 2
        left = tRect.left - ttRect.width - 8
        break
      case 'right':
        top = tRect.top + tRect.height / 2 - ttRect.height / 2
        left = tRect.right + 8
        break
    }

    // Keep tooltip in viewport
    left = Math.max(8, Math.min(left, window.innerWidth - ttRect.width - 8))
    top = Math.max(8, top)

    setCoords({ top, left })
  }, [visible, position])

  return (
    <div
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {enabled && visible && (
        <div
          ref={tooltipRef}
          className="fixed z-[100] max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg pointer-events-none"
          style={{ top: coords.top, left: coords.left }}
        >
          {text}
        </div>
      )}
    </div>
  )
}
