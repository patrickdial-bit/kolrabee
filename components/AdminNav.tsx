"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/dashboard/actions";
import { resetTour } from "@/components/GuidedTour";
import { useTooltips } from "@/lib/tooltip-context";
import KolrabeeLogo from "@/components/KolrabeeLogo";

interface AdminNavProps {
  companyName: string;
}

const navLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/subcontractors", label: "Subcontractors" },
  { href: "/admin/billing", label: "Billing" },
];

export default function AdminNav({ companyName }: AdminNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { enabled: tooltipsOn, toggle: toggleTooltips } = useTooltips();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: logo + company */}
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard">
              <KolrabeeLogo size="md" />
            </Link>
            <span className="hidden sm:inline text-sm text-gray-400">|</span>
            <span className="hidden sm:inline text-sm font-medium text-forge truncate max-w-[200px]">
              {companyName}
            </span>
          </div>

          {/* Center: desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-ember/10 text-ember"
                      : "text-forge/60 hover:bg-gray-50 hover:text-forge"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right: tooltips toggle + help + logout + hamburger */}
          <div className="flex items-center gap-2">
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
              Tips {tooltipsOn ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={() => {
                const current = pathname.includes('/subcontractors') ? 'admin-subcontractors'
                  : pathname.includes('/billing') ? 'admin-billing'
                  : pathname.includes('/projects/new') ? 'admin-project-new'
                  : 'admin-dashboard'
                resetTour(current)
                window.location.reload()
              }}
              className="inline-flex items-center justify-center rounded-full h-8 w-8 text-forge/40 hover:bg-ember/10 hover:text-ember transition-colors"
              title="Show guided tour"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
            </button>
            <form action={logout}>
              <button
                type="submit"
                className="hidden md:inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-forge/60 hover:bg-gray-50 hover:text-forge transition-colors"
              >
                Log out
              </button>
            </form>
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-forge/50 hover:bg-gray-100 hover:text-forge"
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
          <div className="px-4 py-3 text-sm font-medium text-forge border-b border-gray-100">
            {companyName}
          </div>
          <div className="space-y-1 px-2 py-2">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-ember/10 text-ember"
                      : "text-forge/60 hover:bg-gray-50 hover:text-forge"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <form action={logout}>
              <button
                type="submit"
                className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-forge/60 hover:bg-gray-50 hover:text-forge"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
