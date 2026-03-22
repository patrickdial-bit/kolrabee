'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/[slug]/dashboard/actions'
import { useTooltips } from '@/lib/tooltip-context'
import { useI18n } from '@/lib/i18n'
import KolrabeeLogo from '@/components/KolrabeeLogo'

interface SubNavProps {
  slug: string
  tenantName: string
  subName: string
}

export default function SubNav({ slug, tenantName, subName }: SubNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { enabled: tooltipsOn, toggle: toggleTooltips } = useTooltips()
  const { locale, setLocale, t } = useI18n()

  const navLinks = [
    { href: `/${slug}/dashboard`, label: t('nav.dashboard') },
    { href: `/${slug}/profile`, label: t('nav.profile') },
  ]

  const logoutWithSlug = logout.bind(null, slug)

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: logo + tenant name */}
          <div className="flex items-center gap-3">
            <Link href={`/${slug}/dashboard`}>
              <KolrabeeLogo size="md" />
            </Link>
            {tenantName && (
              <>
                <span className="hidden sm:inline text-sm text-gray-400">|</span>
                <span className="hidden sm:inline text-sm font-medium text-forge truncate max-w-[200px]">
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
                      ? 'bg-ember/10 text-ember'
                      : 'text-forge/60 hover:bg-gray-50 hover:text-forge'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Right: name + lang + tooltips + logout + hamburger */}
          <div className="flex items-center gap-2">
            {subName && (
              <span className="hidden md:inline text-sm text-forge/60 mr-1">{subName}</span>
            )}
            {/* Language toggle */}
            <button
              type="button"
              onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold bg-gray-100 text-forge/70 hover:bg-gray-200 transition-colors"
              title={locale === 'en' ? 'Cambiar a Español' : 'Switch to English'}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.467.732-3.558" />
              </svg>
              {locale === 'en' ? 'Español' : 'English'}
            </button>
            {/* Tooltips toggle */}
            <button
              type="button"
              onClick={toggleTooltips}
              className={`hidden md:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                tooltipsOn
                  ? 'bg-ember/10 text-ember hover:bg-ember/15'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={tooltipsOn ? 'Turn off tooltips' : 'Turn on tooltips'}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              {t(tooltipsOn ? 'nav.tips_on' : 'nav.tips_off')}
            </button>
            <form action={logoutWithSlug}>
              <button
                type="submit"
                className="hidden md:inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-forge/60 hover:bg-gray-50 hover:text-forge transition-colors"
              >
                {t('nav.logout')}
              </button>
            </form>
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-forge/50 hover:bg-gray-100 hover:text-forge"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={t('nav.toggle_menu')}
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
            <div className="px-4 py-3 text-sm font-medium text-forge border-b border-gray-100">
              {tenantName}
            </div>
          )}
          {subName && (
            <div className="px-4 py-2 text-sm text-forge/50">
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
                      ? 'bg-ember/10 text-ember'
                      : 'text-forge/60 hover:bg-gray-50 hover:text-forge'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
            {/* Mobile language toggle */}
            <button
              type="button"
              onClick={() => { setLocale(locale === 'en' ? 'es' : 'en'); setMobileOpen(false) }}
              className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-forge/60 hover:bg-gray-50 hover:text-forge flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.467.732-3.558" />
              </svg>
              {locale === 'en' ? 'Español — Traducir página' : 'English — Translate page'}
            </button>
            {/* Mobile tooltips toggle */}
            <button
              type="button"
              onClick={() => { toggleTooltips(); setMobileOpen(false) }}
              className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-forge/60 hover:bg-gray-50 hover:text-forge"
            >
              {t(tooltipsOn ? 'nav.tips_on' : 'nav.tips_off')}
            </button>
            <form action={logoutWithSlug}>
              <button
                type="submit"
                className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-forge/60 hover:bg-gray-50 hover:text-forge"
              >
                {t('nav.logout')}
              </button>
            </form>
          </div>
        </div>
      )}
    </nav>
  )
}
