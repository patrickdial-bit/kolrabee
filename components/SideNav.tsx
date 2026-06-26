'use client'

import Link from 'next/link'
import KolrabeeLogo from '@/components/KolrabeeLogo'

// ---------------------------------------------------------------------------
// SideNav — presentational navy sidebar for the global AppShell.
//
// Brand palette (registered Kolrabee): midnight navy #0D1B2A chrome, teal
// #00A896 active fill with dark text, inactive items white at ~70% opacity.
// The sidebar stays dark in light and dark mode — it is app chrome.
//
// Purely presentational: AppShell owns the nav config (with computed `active`
// flags), the collapse/drawer state, and the per-variant footer controls.
// ---------------------------------------------------------------------------

export type SideNavItem = {
  href: string
  label: string
  icon: IconName
  active: boolean
}

export type SideNavGroup = {
  /** Optional uppercase group label (e.g. PHOTOS). Omit for the primary group. */
  label?: string
  items: SideNavItem[]
}

interface SideNavProps {
  /** Sidebar header line under the brand (company / tenant name). */
  title?: string
  /** Smaller secondary line (e.g. the signed-in sub's name). */
  subtitle?: string
  /** Small pill rendered next to the brand (e.g. "Super Admin"). */
  badge?: string
  /** Home link for the brand mark. */
  homeHref: string
  /** Show the (stubbed for now) search field. */
  showSearch?: boolean
  groups: SideNavGroup[]
  /** Footer content — typically the log-out form plus per-variant controls. */
  footer?: React.ReactNode
  collapsed: boolean
  onToggleCollapse: () => void
  /** Mobile off-canvas drawer state. */
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function SideNav({
  title,
  subtitle,
  badge,
  homeHref,
  showSearch = false,
  groups,
  footer,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SideNavProps) {
  const widthClass = collapsed ? 'lg:w-[72px]' : 'lg:w-64'

  const panel = (
    <div className="flex h-full flex-col bg-[#0D1B2A] text-white">
      {/* Brand */}
      <div className={`flex items-center gap-2 px-4 h-16 shrink-0 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
        <Link href={homeHref} onClick={onMobileClose} className="flex items-center gap-2 min-w-0">
          {collapsed ? (
            <span className="font-display font-black text-2xl leading-none text-white">k</span>
          ) : (
            <KolrabeeLogo size="md" variant="dark" />
          )}
        </Link>
        {!collapsed && badge && (
          <span className="rounded-full bg-[#00A896] px-2 py-0.5 text-[11px] font-semibold text-[#0D1B2A] whitespace-nowrap">
            {badge}
          </span>
        )}
        {!collapsed && title && !badge && (
          <>
            <span className="text-white/30">|</span>
            <span className="truncate text-sm font-medium text-white/80">{title}</span>
          </>
        )}
      </div>

      {/* Secondary header line (company under badge, or sub name) */}
      {!collapsed && (title && badge ? (
        <div className="px-4 pb-2 -mt-1 text-sm font-medium text-white/80 truncate">{title}</div>
      ) : null)}
      {!collapsed && subtitle && (
        <div className="px-4 pb-2 -mt-1 text-xs text-white/50 truncate">{subtitle}</div>
      )}

      {/* Search (stub this phase — wired to the photo dashboard in Part B) */}
      {!collapsed && showSearch && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1.5">
            <svg className="h-4 w-4 text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="search"
              placeholder="Search"
              aria-label="Search"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {groups.map((group, gi) => (
          <div key={group.label ?? `group-${gi}`} className="space-y-1">
            {!collapsed && group.label && (
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                title={collapsed ? item.label : undefined}
                aria-current={item.active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  collapsed ? 'lg:justify-center lg:px-0' : ''
                } ${
                  item.active
                    ? 'bg-[#00A896] text-[#0D1B2A]'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
                <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/10 p-2">{footer}</div>

      {/* Desktop collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden lg:flex items-center justify-center gap-2 border-t border-white/10 px-3 py-2 text-xs font-medium text-white/50 hover:bg-white/10 hover:text-white transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.8"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        {!collapsed && <span>Collapse</span>}
      </button>
    </div>
  )

  return (
    <>
      {/* Desktop: static sticky sidebar in normal flow */}
      <aside className={`hidden lg:block ${widthClass} shrink-0 transition-[width] duration-200`}>
        <div className={`fixed inset-y-0 left-0 ${collapsed ? 'w-[72px]' : 'w-64'} transition-[width] duration-200`}>
          {panel}
        </div>
      </aside>

      {/* Mobile: off-canvas drawer + backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onMobileClose}
        aria-hidden="true"
      />
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {panel}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Icons — minimal inline set so the collapsed rail can show icon-only items.
// ---------------------------------------------------------------------------

export type IconName =
  | 'dashboard'
  | 'projects'
  | 'subcontractors'
  | 'team'
  | 'time'
  | 'billing'
  | 'galleries'
  | 'photos'
  | 'tags'
  | 'crew'
  | 'profile'
  | 'tenants'
  | 'import'
  | 'cloud'
  | 'help'
  | 'map'

function NavIcon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    ),
    projects: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
    ),
    subcontractors: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.479m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    ),
    team: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    ),
    time: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    ),
    billing: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
    ),
    galleries: (
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    ),
    photos: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M18 12V6m3 3h-6M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
    ),
    tags: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z M6 6h.008v.008H6V6Z" />
    ),
    crew: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.479m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    ),
    profile: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    ),
    tenants: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    ),
    import: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-6L12 15m0 0 4.5-4.5M12 15V3" />
    ),
    cloud: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
    ),
    help: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    ),
    map: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
    ),
  }

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
