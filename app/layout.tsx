import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kolrabee - Construction Subcontractor Management',
  description:
    'Post jobs, invite subcontractors, track who accepted, and record when they are paid.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
