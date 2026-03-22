'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/admin/dashboard/actions'

const navLinks = [
  { href: '/super-admin', label: 'Tenants' },
]

export default function SuperAdminNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-gray-900 border-b border-gray-700 sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/super-admin" className="text-lg font-bold text-white">
              Kolrabee
            </Link>
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-black">
              Super Admin
            </span>
          </div>

          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  )
}
