'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreCompetitor } from '@/lib/marketing'

export async function addCompetitor(formData: FormData) {
  const { tenant } = await getCurrentUser()
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Competitor name is required.' }

  const geography = (formData.get('geography') as string)?.trim() || null
  const website = (formData.get('website') as string)?.trim() || null
  const ratingRaw = formData.get('rating') as string
  const reviewsRaw = formData.get('review_count') as string
  const rating = ratingRaw ? parseFloat(ratingRaw) : null
  const reviewCount = reviewsRaw ? parseInt(reviewsRaw) : null
  const adActivity = formData.get('ad_activity') === 'on'

  const { score, reasons } = scoreCompetitor({ rating, review_count: reviewCount, ad_activity: adActivity, website })
  const dedupeKey = `${name.toLowerCase().replace(/\s+/g, ' ')}::${(geography ?? '').toLowerCase()}`
  const seenAt = new Date().toISOString()

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('mk_competitors').upsert(
    {
      tenant_id: tenant.id,
      name: name.slice(0, 200),
      geography,
      website,
      rating,
      review_count: reviewCount,
      ad_activity: adActivity,
      score,
      score_reasons: reasons,
      provenance: { name: { source_key: 'manual', seen_at: seenAt } },
      dedupe_key: dedupeKey,
      refreshed_at: seenAt,
    },
    { onConflict: 'tenant_id,dedupe_key' }
  )
  if (error) return { error: 'Failed to save competitor.' }

  revalidatePath('/admin/market')
  return { success: true }
}

export async function addCompetitorAd(competitorId: string, formData: FormData) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: competitor } = await adminClient
    .from('mk_competitors')
    .select('id')
    .eq('id', competitorId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!competitor) return { error: 'Competitor not found.' }

  const firstSeen = (formData.get('first_seen') as string) || null
  const lastSeen = (formData.get('last_seen') as string) || null
  let runDays: number | null = null
  if (firstSeen && lastSeen) {
    runDays = Math.max(0, Math.round((Date.parse(lastSeen) - Date.parse(firstSeen)) / 86400000))
  }

  const { error } = await adminClient.from('mk_competitor_ads').insert({
    tenant_id: tenant.id,
    competitor_id: competitorId,
    platform: ['meta', 'google', 'other'].includes(formData.get('platform') as string)
      ? (formData.get('platform') as string)
      : 'meta',
    theme: (formData.get('theme') as string)?.trim().slice(0, 100) || null,
    pattern_summary: (formData.get('pattern_summary') as string)?.trim().slice(0, 1000) || null,
    first_seen: firstSeen,
    last_seen: lastSeen,
    run_days: runDays,
    library_url: (formData.get('library_url') as string)?.trim() || null,
  })
  if (error) return { error: 'Failed to save ad observation.' }

  await adminClient
    .from('mk_competitors')
    .update({ ad_activity: true })
    .eq('id', competitorId)

  revalidatePath('/admin/market')
  return { success: true }
}

// Scrape runs may only target sources whose written policy is 'approved' —
// the compliance gate is enforced here, not left to the UI.
export async function createScrapeRun(formData: FormData) {
  const { tenant } = await getCurrentUser()
  const sourceKey = (formData.get('source_key') as string)?.trim()
  const geography = (formData.get('geography') as string)?.trim()
  if (!sourceKey || !geography) return { error: 'Source and geography are required.' }

  const adminClient = createAdminClient()
  const { data: policy } = await adminClient
    .from('mk_source_policies')
    .select('status, display_name')
    .eq('source_key', sourceKey)
    .single()
  if (!policy) return { error: 'Unknown source.' }
  if (policy.status !== 'approved') {
    return { error: `${policy.display_name} is ${policy.status} — a written per-source policy must clear it before any run.` }
  }

  const cadence = ['once', 'daily', 'weekly', 'monthly'].includes(formData.get('cadence') as string)
    ? (formData.get('cadence') as string)
    : 'weekly'

  const { error } = await adminClient.from('mk_scrape_runs').insert({
    tenant_id: tenant.id,
    source_key: sourceKey,
    geography: geography.slice(0, 200),
    cadence,
    status: 'queued',
  })
  if (error) return { error: 'Failed to create run.' }

  revalidatePath('/admin/market')
  return { success: true }
}
