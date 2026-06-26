'use client'

// JobsMap — a Leaflet + OpenStreetMap map that plots job locations.
//
// Free tiles, no API key (consistent with the app's "no paid services" stance).
// Loaded only on the client via next/dynamic({ ssr: false }) by the page-level
// wrappers, because Leaflet touches `window`/`document` at import time.
//
// Markers use Leaflet divIcons (inline SVG pins) so we avoid the well-known
// broken default-marker-image problem and don't ship any image assets.
// "Approximate" points (e.g. jobs a subcontractor hasn't accepted yet) are
// drawn as a soft radius instead of a precise pin to preserve address privacy.

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap } from 'leaflet'

export type MapPoint = {
  id: string
  lat: number
  lng: number
  title: string
  subtitle?: string
  /** Project status; drives the pin color. */
  status?: string
  /** Optional detail line in the popup (e.g. formatted payout). */
  detail?: string
  /** If set, the popup shows a link to the job. */
  href?: string
  /** Draw a soft area instead of a precise pin (privacy for un-accepted jobs). */
  approximate?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  available: '#f59e0b', // amber
  accepted: '#3b82f6', // blue
  in_progress: '#6366f1', // indigo
  pending_completion: '#f97316', // orange
  completed: '#22c55e', // green
  paid: '#059669', // emerald
  cancelled: '#9ca3af', // gray
}

function colorFor(status?: string): string {
  return (status && STATUS_COLORS[status]) || '#0D1B2A'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function pinSvg(color: string): string {
  return (
    `<svg width="26" height="34" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M12 0C5.373 0 0 5.373 0 12c0 8.5 12 20 12 20s12-11.5 12-20C24 5.373 18.627 0 12 0z" ` +
    `fill="${color}" stroke="#ffffff" stroke-width="1.5"/>` +
    `<circle cx="12" cy="12" r="4.5" fill="#ffffff"/>` +
    `</svg>`
  )
}

function popupHtml(p: MapPoint): string {
  const parts: string[] = []
  parts.push(`<div style="font-weight:600;color:#0D1B2A">${escapeHtml(p.title)}</div>`)
  if (p.subtitle) parts.push(`<div style="color:#475569;font-size:12px">${escapeHtml(p.subtitle)}</div>`)
  if (p.detail) parts.push(`<div style="color:#475569;font-size:12px;margin-top:2px">${escapeHtml(p.detail)}</div>`)
  if (p.approximate) {
    parts.push(`<div style="color:#94a3b8;font-size:11px;margin-top:4px;font-style:italic">Approximate area — accept the job to see the exact location.</div>`)
  }
  if (p.href) {
    parts.push(`<a href="${escapeHtml(p.href)}" style="display:inline-block;margin-top:6px;color:#00A896;font-size:12px;font-weight:600">View job →</a>`)
  }
  return `<div style="min-width:150px">${parts.join('')}</div>`
}

export default function JobsMap({ points, className }: { points: MapPoint[]; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelled = false

    import('leaflet').then((mod) => {
      const L = mod.default ?? mod
      if (cancelled || !containerRef.current) return

      // Re-init cleanly if points change.
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([39.5, -98.35], 4)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      const bounds = L.latLngBounds([])
      let plotted = 0

      for (const p of points) {
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue
        if (Number.isNaN(p.lat) || Number.isNaN(p.lng)) continue
        const color = colorFor(p.status)

        if (p.approximate) {
          L.circle([p.lat, p.lng], {
            radius: 1300,
            color,
            weight: 1.5,
            fillColor: color,
            fillOpacity: 0.18,
          })
            .addTo(map)
            .bindPopup(popupHtml(p))
        } else {
          const icon = L.divIcon({
            className: 'jobs-map-pin',
            html: pinSvg(color),
            iconSize: [26, 34],
            iconAnchor: [13, 34],
            popupAnchor: [0, -30],
          })
          L.marker([p.lat, p.lng], { icon, title: p.title }).addTo(map).bindPopup(popupHtml(p))
        }

        bounds.extend([p.lat, p.lng])
        plotted += 1
      }

      if (plotted === 1) {
        map.setView(bounds.getCenter(), 13)
      } else if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2), { maxZoom: 14 })
      }

      // Re-measure once layout settles (the container starts at 0px during init).
      setTimeout(() => mapRef.current?.invalidateSize(), 0)
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [points])

  return <div ref={containerRef} className={className ?? 'h-full w-full'} />
}
