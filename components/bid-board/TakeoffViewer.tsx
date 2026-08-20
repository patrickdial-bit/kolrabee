'use client'

// Real image viewer for takeoffs (spec: "Takeoff viewer"): wheel/pinch zoom,
// drag pan, double-tap/click to fit, full-screen, download original. A bidder
// is reading small dimension labels on a phone — zoom must be clean.

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  src: string
  alt: string
  downloadUrl?: string
  className?: string
}

const MIN_SCALE = 0.2
const MAX_SCALE = 12

export default function TakeoffViewer({ src, alt, downloadUrl, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [fullscreen, setFullscreen] = useState(false)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastPinchDist = useRef<number | null>(null)
  const dragging = useRef(false)

  const fit = useCallback(() => setTransform({ x: 0, y: 0, scale: 1 }), [])

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = clientX - rect.left - rect.width / 2
    const cy = clientY - rect.top - rect.height / 2
    setTransform((t) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor))
      const ratio = scale / t.scale
      return { scale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio }
    })
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15)
    },
    [zoomAt]
  )

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) dragging.current = true
    if (pointers.current.size === 2) lastPinchDist.current = null
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      // Pinch zoom
      const [a, b] = Array.from(pointers.current.values())
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (lastPinchDist.current !== null && lastPinchDist.current > 0) {
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2
        zoomAt(midX, midY, dist / lastPinchDist.current)
      }
      lastPinchDist.current = dist
    } else if (dragging.current && pointers.current.size === 1) {
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) lastPinchDist.current = null
    if (pointers.current.size === 0) dragging.current = false
  }

  // Escape exits fullscreen
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const viewer = (
    <div
      className={`relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-900 ${
        fullscreen ? 'fixed inset-0 z-50 rounded-none' : className ?? 'h-[420px]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 bg-gray-800 px-3 py-2">
        <span className="truncate text-xs font-medium text-gray-200">{alt}</span>
        <div className="flex items-center gap-1">
          <ViewerButton label="Zoom out" onClick={() => zoomAt(centerX(), centerY(), 1 / 1.4)}>−</ViewerButton>
          <ViewerButton label="Zoom in" onClick={() => zoomAt(centerX(), centerY(), 1.4)}>+</ViewerButton>
          <ViewerButton label="Fit" onClick={fit}>Fit</ViewerButton>
          <ViewerButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={() => setFullscreen((f) => !f)}>
            {fullscreen ? '✕' : '⛶'}
          </ViewerButton>
          {downloadUrl && (
            <a
              href={downloadUrl}
              className="rounded px-2 py-1 text-xs font-medium text-gray-200 hover:bg-gray-700"
              title="Download original"
            >
              ↓
            </a>
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={fit}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 max-h-full max-w-full"
          style={{
            transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: 'center center',
          }}
        />
      </div>
    </div>
  )

  function centerX() {
    const rect = containerRef.current?.getBoundingClientRect()
    return rect ? rect.left + rect.width / 2 : 0
  }
  function centerY() {
    const rect = containerRef.current?.getBoundingClientRect()
    return rect ? rect.top + rect.height / 2 : 0
  }

  return viewer
}

function ViewerButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="rounded px-2 py-1 text-xs font-medium text-gray-200 hover:bg-gray-700"
    >
      {children}
    </button>
  )
}
