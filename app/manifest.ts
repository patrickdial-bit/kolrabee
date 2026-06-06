import type { MetadataRoute } from 'next'

// PWA manifest — makes Kolrabee installable ("add to home screen") so crews can
// launch it like a native app and capture photos in standalone mode.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kolrabee',
    short_name: 'Kolrabee',
    description: 'Jobsite photo capture and crew management for trade contractors.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D1B2A',
    theme_color: '#0D1B2A',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
