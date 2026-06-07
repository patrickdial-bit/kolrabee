import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/helpers'
import { getPublishedArticle } from '@/lib/kb-actions'
import { renderMarkdown } from '@/lib/markdown'
import AppShell from '@/components/AppShell'

export default async function HelpArticlePage({ params }: { params: { slug: string } }) {
  const { tenant } = await getCurrentUser()
  const result = await getPublishedArticle(params.slug)
  if (!result) notFound()
  const { article, categoryName } = result

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin/help" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 mb-6">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Help Center
        </Link>

        <article className="rounded-lg border border-gray-200 bg-white p-6 sm:p-8">
          {categoryName && (
            <span className="text-xs font-medium uppercase tracking-wide text-ember">{categoryName}</span>
          )}
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{article.title}</h1>
          <div
            className="mt-6 space-y-3 text-sm leading-relaxed text-gray-700"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
          />
        </article>
      </main>
    </AppShell>
  )
}
