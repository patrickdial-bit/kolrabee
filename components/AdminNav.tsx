"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/dashboard/actions";

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

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: logo + company */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="text-xl font-bold text-primary-600"
            >
              TradeTap
            </Link>
            <span className="hidden sm:inline text-sm text-gray-400">|</span>
            <span className="hidden sm:inline text-sm font-medium text-gray-700 truncate max-w-[200px]">
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
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right: logout + hamburger */}
          <div className="flex items-center gap-2">
            <form action={logout}>
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
          <div className="px-4 py-3 text-sm font-medium text-gray-700 border-b border-gray-100">
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
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <form action={logout}>
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
  );
}
