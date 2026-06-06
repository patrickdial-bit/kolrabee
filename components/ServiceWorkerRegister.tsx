'use client'

import { useEffect } from 'react'

// Registers the app-shell service worker so Kolrabee is installable as a PWA.
// Production-only — keeps the dev server free of stale-cache surprises.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration is best-effort; the app works fine without it.
      })
    }
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])
  return null
}
