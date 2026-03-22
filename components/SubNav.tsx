'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/[slug]/dashboard/actions'
import { useTooltips } from '@/lib/tooltip-context'

interface SubNavProps {
  slug: string
  tenantName: string
  subName: string
}

export default function SubNav({ slug, tenantName, subName }: SubNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { enabled: tooltipsOn, toggle: toggleTooltips } = useTooltips()

  const navLinks = [
    { href: `/${slug}/dashboard`, label: 'Dashboard' },
    { href: `/${slug}/profile`, label: 'Profile' },
  ]

  const logoutWithSlug = logout.bind(null, slug)

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: logo + tenant name */}
          <div className="flex items-center gap-3">
            <Link
              href={`/${slug}/dashboard`}
              className="text-xl font-bold text-indigo-600"
            >
              Kolrabee
            </Link>
            {tenantName && (
              <>
                <span className="hidden sm:inline text-sm text-gray-400">|</span>
                <span className="hidden sm:inline text-sm font-medium text-gray-700 truncate max-w-[200px]">
                  {tenantName}
                </span>
              </>
            )}
          </div>

          {/* Center: desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Right: name + tooltips + logout + hamburger */}
          <div className="flex items-center gap-2">
            {subName && (
              <span className="hidden md:inline text-sm text-gray-600 mr-2">{subName}</span>
            )}
            <button
              type="button"
              onClick={toggleTooltips}
              className={`hidden md:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                tooltipsOn
                  ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={tooltipsOn ? 'Turn off tooltips' : 'Turn on tooltips'}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              Tips {tooltipsOn ? 'On' : 'Off'}
            </button>
            <form action={logoutWithSlug}>
              <button
                type="submit"
                className="hidden md:inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                Log out
              </button>
            </form>
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          {tenantName && (
            <div className="px-4 py-3 text-sm font-medium text-gray-700 border-b border-gray-100">
              {tenantName}
            </div>
          )}
          {subName && (
            <div className="px-4 py-2 text-sm text-gray-500">
              {subName}
            </div>
          )}
          <div className="space-y-1 px-2 py-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
            <form action={logoutWithSlug}>
              <button
                type="submit"
                className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </nav>
  )
}
