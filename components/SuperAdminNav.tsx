'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/admin/dashboard/actions'
import KolrabeeLogo from '@/components/KolrabeeLogo'

const navLinks = [
  { href: '/super-admin', label: 'Tenants' },
]

export default function SuperAdminNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-forge border-b border-white/10 sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/super-admin">
              <KolrabeeLogo size="md" className="[&>span]:!text-white [&>span:nth-child(2)]:!text-ember [&>span:nth-child(3)]:!text-green-400" />
            </Link>
            <span className="rounded-full bg-ember px-2 py-0.5 text-xs font-semibold text-white">
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
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
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
