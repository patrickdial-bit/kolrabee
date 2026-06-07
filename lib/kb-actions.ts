'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, requireSuperAdmin } from '@/lib/helpers'
import type { KbArticle, KbCategory, KbSearchResult, CategoryWithArticles } from '@/lib/types'

// ---------------------------------------------------------------------------
// Reads (admin-facing help center). The app reads via the service-role client;
// callers below still gate on an authenticated admin/super-admin context.
// Only PUBLISHED articles are exposed to admins.
// ---------------------------------------------------------------------------

export async function getPublishedKb(): Promise<CategoryWithArticles[]> {
  await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: categories } = await adminClient
    .from('kb_categories')
    .select('*')
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  const { data: articles } = await adminClient
    .from('kb_articles')
    .select('id, slug, title, excerpt, position, category_id')
    .eq('status', 'published')
    .order('position', { ascending: true })
    .order('title', { ascending: true })

  const byCategory = new Map<string, CategoryWithArticles['articles']>()
  for (const a of articles ?? []) {
    const key = (a as any).category_id ?? 'uncategorized'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push({
      id: (a as any).id,
      slug: (a as any).slug,
      title: (a as any).title,
      excerpt: (a as any).excerpt,
      position: (a as any).position,
    })
  }

  return (categories ?? [])
    .map((c) => ({ ...(c as KbCategory), articles: byCategory.get((c as any).id) ?? [] }))
    .filter((c) => c.articles.length > 0)
}

export async function getPublishedArticle(
  slug: string,
): Promise<{ article: KbArticle; categoryName: string | null } | null> {
  await getCurrentUser()
  const adminClient = createAdminClient()
  const { data: article } = await adminClient
    .from('kb_articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (!article) return null

  let categoryName: string | null = null
  if ((article as any).category_id) {
    const { data: cat } = await adminClient
      .from('kb_categories')
      .select('name')
      .eq('id', (article as any).category_id)
      .maybeSingle()
    categoryName = (cat as any)?.name ?? null
  }
  return { article: article as KbArticle, categoryName }
}

export async function searchKb(query: string): Promise<KbSearchResult[]> {
  await getCurrentUser()
  const q = query.trim()
  if (!q) return []
  const adminClient = createAdminClient()
  const { data, error } = await adminClient.rpc('search_kb', { q, max_results: 20 })
  if (error || !data) return []
  return (data as any[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    category_name: r.category_name ?? null,
    category_slug: r.category_slug ?? null,
    headline: r.headline ?? '',
    rank: r.rank ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Authoring (super admin only).
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110)
}

export async function getAllKbForAdmin(): Promise<{ categories: KbCategory[]; articles: KbArticle[] }> {
  await requireSuperAdmin()
  const adminClient = createAdminClient()
  const { data: categories } = await adminClient
    .from('kb_categories')
    .select('*')
    .order('position', { ascending: true })
  const { data: articles } = await adminClient
    .from('kb_articles')
    .select('*')
    .order('updated_at', { ascending: false })
  return {
    categories: (categories ?? []) as KbCategory[],
    articles: (articles ?? []) as KbArticle[],
  }
}

export async function createCategory(formData: FormData) {
  await requireSuperAdmin()
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Category name is required.' }
  const description = (formData.get('description') as string)?.trim() || null
  const position = parseInt((formData.get('position') as string) || '0', 10) || 0

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('kb_categories')
    .insert({ name, slug: slugify(name), description, position })
  if (error) {
    if (error.code === '23505') return { error: 'A category with that name already exists.' }
    return { error: 'Failed to create category.' }
  }
  revalidatePath('/super-admin/kb')
  revalidatePath('/admin/help')
  return { success: true }
}

export async function deleteCategory(id: string) {
  await requireSuperAdmin()
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('kb_categories').delete().eq('id', id)
  if (error) return { error: 'Failed to delete category.' }
  revalidatePath('/super-admin/kb')
  revalidatePath('/admin/help')
  return { success: true }
}

export async function saveArticle(formData: FormData) {
  await requireSuperAdmin()
  const id = (formData.get('id') as string) || null
  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'Title is required.' }
  const body = (formData.get('body') as string) ?? ''
  const excerpt = (formData.get('excerpt') as string)?.trim() || null
  const categoryId = (formData.get('category_id') as string) || null
  const status = (formData.get('status') as string) === 'published' ? 'published' : 'draft'
  const position = parseInt((formData.get('position') as string) || '0', 10) || 0
  const customSlug = (formData.get('slug') as string)?.trim()
  const slug = customSlug ? slugify(customSlug) : slugify(title)

  const adminClient = createAdminClient()
  const row = {
    title,
    slug,
    body,
    excerpt,
    category_id: categoryId,
    status,
    position,
    updated_at: new Date().toISOString(),
  }

  if (id) {
    const { error } = await adminClient.from('kb_articles').update(row).eq('id', id)
    if (error) {
      if (error.code === '23505') return { error: 'Another article already uses that slug.' }
      return { error: 'Failed to save article.' }
    }
  } else {
    const { error } = await adminClient.from('kb_articles').insert(row)
    if (error) {
      if (error.code === '23505') return { error: 'Another article already uses that slug.' }
      return { error: 'Failed to create article.' }
    }
  }
  revalidatePath('/super-admin/kb')
  revalidatePath('/admin/help')
  if (status === 'published') revalidatePath(`/admin/help/${slug}`)
  return { success: true }
}

export async function deleteArticle(id: string) {
  await requireSuperAdmin()
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('kb_articles').delete().eq('id', id)
  if (error) return { error: 'Failed to delete article.' }
  revalidatePath('/super-admin/kb')
  revalidatePath('/admin/help')
  return { success: true }
}
