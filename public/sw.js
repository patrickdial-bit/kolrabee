// Minimal app-shell service worker. Its job in Phase 1 is to satisfy the PWA
// installability requirement (a fetch handler + manifest makes the app
// installable on Android Chrome) and to keep the shell snappy on flaky LTE.
//
// Deliberately NOT an offline upload queue — that's a Phase 1.5 rabbit hole.
// We use a network-first strategy for navigations so crews always get fresh
// data when online, falling back to cache only when the network fails.

const CACHE = 'kolrabee-shell-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never cache Supabase API / storage or any cross-origin request — always go
  // to the network so auth, uploads, and signed URLs behave correctly.
  if (url.origin !== self.location.origin) return

  // Network-first for page navigations; cached shell as a fallback offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/').then((r) => r || Response.error())))
    return
  }

  // Cache-first for same-origin static assets (icons, _next static chunks).
  if (url.pathname.startsWith('/_next/') || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((resp) => {
            const copy = resp.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
            return resp
          }),
      ),
    )
  }
})
