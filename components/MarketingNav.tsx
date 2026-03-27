'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/pricing', label: 'Pricing' },
  ]

  return (
    <>
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-0 text-xl font-bold tracking-tight" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
          <span style={{ color: '#0D1B2A' }}>kol</span>
          <span style={{ color: '#00A896' }}>ra</span>
          <span style={{ color: '#F4A261' }}>bee</span>
        </Link>
        <div className="hidden md:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/admin/login"
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/admin/signup"
            className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
            style={{ backgroundColor: '#00A896' }}
          >
            Get Started Free
          </Link>
        </div>
        <button
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </nav>
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-6 py-4 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/admin/login" onClick={() => setMobileOpen(false)} className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">Login</Link>
          <Link href="/admin/signup" onClick={() => setMobileOpen(false)} className="block rounded-lg px-4 py-2 text-sm font-semibold text-white text-center transition-colors mt-2" style={{ backgroundColor: '#00A896' }}>Get Started Free</Link>
        </div>
      )}
    </>
  )
}
