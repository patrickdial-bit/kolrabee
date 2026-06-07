'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { searchKb } from '@/lib/kb-actions'
import { renderHeadline } from '@/lib/markdown'
import type { KbSearchResult, CategoryWithArticles } from '@/lib/types'

export default function HelpClient({
  tenantName,
  categories,
}: {
  tenantName: string
  categories: CategoryWithArticles[]
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KbSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced full-text search; clears back to browse when the box is empty.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    const q = query.trim()
    if (!q) {
      setResults(null)
      setSearching(false)
      return
    }
    setSearching(true)
    debounce.current = setTimeout(async () => {
      const r = await searchKb(q)
      setResults(r)
      setSearching(false)
    }, 250)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query])

  return (
    <AppShell variant="admin" companyName={tenantName}>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Help Center</h1>
          <p className="mt-1 text-sm text-gray-500">Guides and answers for getting the most out of Kolrabee.</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles…"
            className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-3 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember"
          />
        </div>

        {/* Results */}
        {results !== null ? (
          <div>
            {searching && <p className="text-sm text-gray-500">Searching…</p>}
            {!searching && results.length === 0 && (
              <p className="text-sm text-gray-500">No articles match “{query}”. Try different words.</p>
            )}
            <ul className="space-y-3">
              {results.map((r) => (
                <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4 hover:border-ember/40">
                  <Link href={`/admin/help/${r.slug}`} className="block">
                    {r.category_name && (
                      <span className="text-xs font-medium uppercase tracking-wide text-ember">{r.category_name}</span>
                    )}
                    <h3 className="text-base font-semibold text-gray-900">{r.title}</h3>
                    {r.headline && (
                      <p
                        className="mt-1 text-sm text-gray-600"
                        dangerouslySetInnerHTML={{ __html: renderHeadline(r.headline) }}
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          /* Browse by category */
          <div className="space-y-8">
            {categories.length === 0 && (
              <p className="text-sm text-gray-500">No help articles yet. Check back soon.</p>
            )}
            {categories.map((cat) => (
              <section key={cat.id}>
                <h2 className="text-lg font-semibold text-gray-900">{cat.name}</h2>
                {cat.description && <p className="mt-0.5 text-sm text-gray-500">{cat.description}</p>}
                <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                  {cat.articles.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/admin/help/${a.slug}`}
                        className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{a.title}</p>
                          {a.excerpt && <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{a.excerpt}</p>}
                        </div>
                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  )
}
