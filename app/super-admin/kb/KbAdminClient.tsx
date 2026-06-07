'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import type { KbArticle, KbCategory } from '@/lib/types'
import { createCategory, deleteCategory, saveArticle, deleteArticle } from '@/lib/kb-actions'

const empty: Partial<KbArticle> = { status: 'draft', body: '', position: 0 }

export default function KbAdminClient({
  categories,
  articles,
}: {
  categories: KbCategory[]
  articles: KbArticle[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<Partial<KbArticle> | null>(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Uncategorized'

  const handleSaveArticle = (formData: FormData) => {
    startTransition(async () => {
      const res = await saveArticle(formData)
      if (res?.error) { toast.error(res.error) } else { toast.success('Article saved.'); setEditing(null); router.refresh() }
    })
  }

  const handleDeleteArticle = (id: string) => {
    if (!confirm('Delete this article?')) return
    startTransition(async () => {
      const res = await deleteArticle(id)
      if (res?.error) toast.error(res.error)
      else { toast.success('Article deleted.'); router.refresh() }
    })
  }

  const handleCreateCategory = (formData: FormData) => {
    startTransition(async () => {
      const res = await createCategory(formData)
      if (res?.error) toast.error(res.error)
      else { toast.success('Category created.'); setShowCategoryForm(false); router.refresh() }
    })
  }

  const handleDeleteCategory = (id: string) => {
    if (!confirm('Delete this category? Its articles become uncategorized.')) return
    startTransition(async () => {
      const res = await deleteCategory(id)
      if (res?.error) toast.error(res.error)
      else { toast.success('Category deleted.'); router.refresh() }
    })
  }

  const inputCls = 'block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm'

  return (
    <AppShell variant="superadmin">
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
            <p className="mt-1 text-sm text-gray-500">Help articles shown to every admin in their Help Center.</p>
          </div>
          <button
            onClick={() => setEditing({ ...empty })}
            className="inline-flex items-center rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            New Article
          </button>
        </div>

        {/* Categories */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
            <button onClick={() => setShowCategoryForm((v) => !v)} className="text-sm font-medium text-ember hover:text-primary-700">
              {showCategoryForm ? 'Cancel' : '+ Add category'}
            </button>
          </div>
          {showCategoryForm && (
            <form action={handleCreateCategory} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input name="name" required placeholder="Name" className={inputCls} />
              <input name="description" placeholder="Description (optional)" className={inputCls} />
              <div className="flex gap-2">
                <input name="position" type="number" defaultValue={0} className={`${inputCls} w-20`} title="Sort order" />
                <button type="submit" disabled={isPending} className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">Add</button>
              </div>
            </form>
          )}
          {categories.length === 0 ? (
            <p className="text-sm text-gray-500">No categories yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    {c.description && <span className="ml-2 text-sm text-gray-500">{c.description}</span>}
                  </div>
                  <button onClick={() => handleDeleteCategory(c.id)} disabled={isPending} className="text-xs font-medium text-amber-600 hover:text-amber-700">Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Articles */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Articles</h2>
          {articles.length === 0 ? (
            <p className="text-sm text-gray-500">No articles yet. Create your first one.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {articles.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{a.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{catName(a.category_id)} · /{a.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditing(a)} className="text-xs font-medium text-ember hover:text-primary-700">Edit</button>
                    <button onClick={() => handleDeleteArticle(a.id)} disabled={isPending} className="text-xs font-medium text-amber-600 hover:text-amber-700">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Article editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">{editing.id ? 'Edit Article' : 'New Article'}</h3>
            </div>
            <form action={handleSaveArticle} className="space-y-4 px-6 py-5">
              {editing.id && <input type="hidden" name="id" value={editing.id} />}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
                <input name="title" required defaultValue={editing.title ?? ''} className={inputCls} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                  <select name="category_id" defaultValue={editing.category_id ?? ''} className={inputCls}>
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                  <select name="status" defaultValue={editing.status ?? 'draft'} className={inputCls}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Slug (optional)</label>
                  <input name="slug" defaultValue={editing.slug ?? ''} placeholder="auto from title" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Sort order</label>
                  <input name="position" type="number" defaultValue={editing.position ?? 0} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Excerpt</label>
                <textarea name="excerpt" rows={2} defaultValue={editing.excerpt ?? ''} placeholder="Short summary shown in lists and search" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Body (Markdown)</label>
                <textarea name="body" rows={12} defaultValue={editing.body ?? ''} className={`${inputCls} font-mono text-xs`} />
                <p className="mt-1 text-xs text-gray-400">Supports # headings, **bold**, `code`, - lists, and [links](https://…).</p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={isPending} className="inline-flex items-center rounded-md bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                  {isPending ? 'Saving…' : 'Save Article'}
                </button>
                <button type="button" onClick={() => setEditing(null)} className="rounded-md px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
