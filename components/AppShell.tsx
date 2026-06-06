'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import KolrabeeLogo from '@/components/KolrabeeLogo'
import SideNav, { type SideNavGroup } from '@/components/SideNav'
import { useTooltips } from '@/lib/tooltip-context'
import { useI18n } from '@/lib/i18n'
import { resetTour } from '@/components/GuidedTour'
import { logout as adminLogout } from '@/app/admin/dashboard/actions'
import { logout as subLogout } from '@/app/[slug]/dashboard/actions'

// ---------------------------------------------------------------------------
// AppShell — global layout chrome: navy SideNav + light content outlet.
//
// One shell, three surfaces (admin / subcontractor portal / super admin). It
// reuses the existing per-surface nav definitions and labels — this is a shell
// swap, not a rebuild of the routes. The shell owns collapse + mobile-drawer
// state and builds the per-variant footer controls (tips, language, tour,
// log out) so the right hooks/actions are used for each surface.
// ---------------------------------------------------------------------------

type AdminProps = {
  variant: 'admin'
  companyName?: string
}

type SubProps = {
  variant: 'sub'
  slug: string
  tenantName?: string
  subName?: string
  isCrewLeader?: boolean
}

type SuperAdminProps = {
  variant: 'superadmin'
}

type AppShellProps = (AdminProps | SubProps | SuperAdminProps) & {
  children: React.ReactNode
}

export default function AppShell(props: AppShellProps) {
  const { children } = props
  const pathname = usePathname() || ''
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const { enabled: tooltipsOn, toggle: toggleTooltips } = useTooltips()
  const { locale, setLocale } = useI18n()

  // ---- per-variant config ------------------------------------------------
  let homeHref = '/'
  let title: string | undefined
  let subtitle: string | undefined
  let badge: string | undefined
  let showSearch = false
  let groups: SideNavGroup[] = []

  const footerRow = `flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors ${
    collapsed ? 'lg:justify-center lg:px-0' : ''
  }`
  const footerLabel = collapsed ? 'lg:hidden' : ''

  let footer: React.ReactNode = null

  if (props.variant === 'admin') {
    homeHref = '/admin/dashboard'
    title = props.companyName
    showSearch = true
    groups = [
      {
        items: [
          { href: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard', active: pathname.startsWith('/admin/dashboard') },
          { href: '/admin/subcontractors', label: 'Subcontractors', icon: 'subcontractors', active: pathname.startsWith('/admin/subcontractors') },
          { href: '/admin/team', label: 'Team', icon: 'team', active: pathname.startsWith('/admin/team') },
          { href: '/admin/time-tracking', label: 'Time Tracking', icon: 'time', active: pathname.startsWith('/admin/time-tracking') },
          { href: '/admin/billing', label: 'Billing', icon: 'billing', active: pathname.startsWith('/admin/billing') },
        ],
      },
      {
        label: 'Photos',
        items: [
          { href: '/admin/photos/galleries', label: 'Galleries', icon: 'galleries', active: pathname.startsWith('/admin/photos/galleries') },
          { href: '/admin/photos', label: 'All Photos', icon: 'photos', active: pathname === '/admin/photos' },
          { href: '/admin/photos/tags', label: 'Tags', icon: 'tags', active: pathname.startsWith('/admin/photos/tags') },
        ],
      },
    ]
    footer = (
      <div className="space-y-1">
        <button type="button" onClick={toggleTooltips} className={footerRow} title={tooltipsOn ? 'Turn off tooltips' : 'Turn on tooltips'}>
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <span className={footerLabel}>Tips {tooltipsOn ? 'On' : 'Off'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const current = pathname.includes('/subcontractors')
              ? 'admin-subcontractors'
              : pathname.includes('/billing')
                ? 'admin-billing'
                : pathname.includes('/projects/new')
                  ? 'admin-project-new'
                  : 'admin-dashboard'
            resetTour(current)
            window.location.reload()
          }}
          className={footerRow}
          title="Show guided tour"
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
          </svg>
          <span className={footerLabel}>Guided tour</span>
        </button>
        <form action={adminLogout}>
          <button type="submit" className={footerRow}>
            <LogoutIcon />
            <span className={footerLabel}>Log out</span>
          </button>
        </form>
      </div>
    )
  } else if (props.variant === 'sub') {
    const { slug, tenantName, subName, isCrewLeader } = props
    homeHref = `/${slug}/dashboard`
    title = tenantName
    subtitle = subName
    const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
    groups = [
      {
        items: [
          { href: `/${slug}/dashboard`, label: 'Dashboard', icon: 'dashboard', active: isActive(`/${slug}/dashboard`) },
          ...(isCrewLeader
            ? [{ href: `/${slug}/crew`, label: 'Crew', icon: 'crew' as const, active: isActive(`/${slug}/crew`) }]
            : []),
          { href: `/${slug}/profile`, label: 'Profile', icon: 'profile', active: isActive(`/${slug}/profile`) },
        ],
      },
    ]
    const subLogoutWithSlug = subLogout.bind(null, slug)
    footer = (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
          className={footerRow}
          title={locale === 'en' ? 'Cambiar a Español' : 'Switch to English'}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.467.732-3.558" />
          </svg>
          <span className={footerLabel}>{locale === 'en' ? 'Español' : 'English'}</span>
        </button>
        <button type="button" onClick={toggleTooltips} className={footerRow} title={tooltipsOn ? 'Turn off tooltips' : 'Turn on tooltips'}>
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <span className={footerLabel}>Tips {tooltipsOn ? 'On' : 'Off'}</span>
        </button>
        <form action={subLogoutWithSlug}>
          <button type="submit" className={footerRow}>
            <LogoutIcon />
            <span className={footerLabel}>Log out</span>
          </button>
        </form>
      </div>
    )
  } else {
    // superadmin
    homeHref = '/super-admin'
    badge = 'Super Admin'
    groups = [
      {
        items: [
          {
            href: '/super-admin',
            label: 'Tenants',
            icon: 'tenants',
            active: pathname === '/super-admin' || pathname.startsWith('/super-admin/tenants'),
          },
          {
            href: '/super-admin/subcontractors',
            label: 'Subcontractors',
            icon: 'subcontractors',
            active: pathname === '/super-admin/subcontractors' || pathname.startsWith('/super-admin/subcontractors/'),
          },
        ],
      },
    ]
    footer = (
      <form action={adminLogout}>
        <button type="submit" className={footerRow}>
          <LogoutIcon />
          <span className={footerLabel}>Log out</span>
        </button>
      </form>
    )
  }

  const mobileTitle =
    props.variant === 'admin'
      ? props.companyName
      : props.variant === 'sub'
        ? props.tenantName
        : 'Super Admin'

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <SideNav
        homeHref={homeHref}
        title={title}
        subtitle={subtitle}
        badge={badge}
        showSearch={showSearch}
        groups={groups}
        footer={footer}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with hamburger */}
        <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center justify-center rounded-md p-2 text-forge/60 hover:bg-gray-100 hover:text-forge"
            aria-label="Open navigation"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <KolrabeeLogo size="sm" />
          {mobileTitle && (
            <>
              <span className="text-gray-300">|</span>
              <span className="truncate text-sm font-medium text-forge/80">{mobileTitle}</span>
            </>
          )}
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

function LogoutIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
      />
    </svg>
  )
}
