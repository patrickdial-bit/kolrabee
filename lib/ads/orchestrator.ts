import { createAdminClient } from '@/lib/supabase/admin'
import type { AdAngle, AdBrandKit, AdRunStatus, AdVariantType } from '@/lib/types'
import { AD_VARIANT_TYPES } from '@/lib/types'
import { scrapeCompetitors } from './scrape'
import { synthesizeAngles, generateCopy, type CopyConceptInput } from './anthropic'
import { buildImagePrompt, generateImage } from './gemini'
import { uploadAsset, storagePaths } from './storage'

const IMAGE_CONCURRENCY = 5

type RunRow = {
  id: string
  tenant_id: string
  brand_kit_id: string | null
}

async function setStatus(runId: string, status: AdRunStatus, extra: Record<string, unknown> = {}) {
  const adminClient = createAdminClient()
  await adminClient.from('ad_generation_runs').update({ status, ...extra }).eq('id', runId)
}

async function addCost(runId: string, cents: number) {
  if (cents <= 0) return
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('ad_generation_runs')
    .select('total_cost_cents')
    .eq('id', runId)
    .single()
  await adminClient
    .from('ad_generation_runs')
    .update({ total_cost_cents: (data?.total_cost_cents ?? 0) + cents })
    .eq('id', runId)
}

// Run the full creative pipeline for a queued run. Designed to be invoked
// fire-and-forget from the POST /api/ads/runs route; it persists status at each
// step so the UI can poll progress. Errors set status='failed' rather than throw.
export async function runAdsPipeline(run: RunRow): Promise<void> {
  const adminClient = createAdminClient()
  try {
    const { data: brandKit } = await adminClient
      .from('ad_brand_kits')
      .select('*')
      .eq('id', run.brand_kit_id ?? '')
      .maybeSingle()

    if (!brandKit) {
      await setStatus(run.id, 'failed', {
        error_message: 'No brand kit found for this run.',
        completed_at: new Date().toISOString(),
      })
      return
    }
    const kit = brandKit as AdBrandKit

    // Step 1 — competitor scrape
    await setStatus(run.id, 'scraping')
    const scrapeSummary = await scrapeCompetitors(kit)
    await addCost(run.id, 1)
    await setStatus(run.id, 'synthesizing', { competitor_scrape_summary: scrapeSummary })

    // Step 2 — angle synthesis
    const { angles, costCents: angleCost } = await synthesizeAngles(kit, scrapeSummary)
    await addCost(run.id, angleCost)
    await setStatus(run.id, 'generating_images', { synthesized_angles: angles })

    // Step 3 — image generation (20 concepts: 5 angles x 4 variants)
    const conceptInputs = buildConceptMatrix(angles)
    const seedUrls = kit.seed_image_urls || []
    const createdConcepts: { id: string; index: number; angle: string; variant_type: AdVariantType }[] = []

    for (let i = 0; i < conceptInputs.length; i += IMAGE_CONCURRENCY) {
      const batch = conceptInputs.slice(i, i + IMAGE_CONCURRENCY)
      const results = await Promise.all(
        batch.map((c) => generateAndStoreConcept(run, kit, c, seedUrls))
      )
      for (const r of results) {
        if (r) createdConcepts.push(r)
      }
    }

    await setStatus(run.id, 'writing_copy', { concepts_generated: createdConcepts.length })

    // Step 4 — copy generation (single batched call)
    const copyInputs: CopyConceptInput[] = conceptInputs.map((c) => ({
      index: c.index,
      angle: c.angle.name,
      variant_type: c.variant,
      image_prompt: c.prompt,
    }))
    const { pairs, costCents: copyCost } = await generateCopy(kit, angles, copyInputs)
    await addCost(run.id, copyCost)

    const pairByIndex = new Map(pairs.map((p) => [p.index, p]))
    for (const concept of createdConcepts) {
      const pair = pairByIndex.get(concept.index)
      if (!pair) continue
      await adminClient
        .from('ad_concepts')
        .update({ headline: pair.headline, primary_text: pair.primary_text })
        .eq('id', concept.id)
    }

    // Step 5 — ready for review
    await setStatus(run.id, 'ready_for_review', { completed_at: new Date().toISOString() })
  } catch (err: any) {
    console.error('runAdsPipeline failed', err)
    await setStatus(run.id, 'failed', {
      error_message: err?.message ?? 'Unknown error during generation.',
      completed_at: new Date().toISOString(),
    })
  }
}

type ConceptSpec = { index: number; angle: AdAngle; variant: AdVariantType; prompt: string }

function buildConceptMatrix(angles: AdAngle[]): ConceptSpec[] {
  // This depends on brand kit too, but the prompt is finalized in the loop where
  // we have the kit. Here we just lay out the 5x4 matrix; prompt filled in below.
  const specs: ConceptSpec[] = []
  let index = 1
  for (const angle of angles) {
    for (const variant of AD_VARIANT_TYPES) {
      specs.push({ index, angle, variant, prompt: '' })
      index++
    }
  }
  return specs
}

async function generateAndStoreConcept(
  run: RunRow,
  kit: AdBrandKit,
  spec: ConceptSpec,
  seedUrls: string[]
): Promise<{ id: string; index: number; angle: string; variant_type: AdVariantType } | null> {
  const adminClient = createAdminClient()
  try {
    const prompt = buildImagePrompt(kit, spec.angle, spec.variant)
    spec.prompt = prompt

    // Create the concept row first so we have an id for the storage path.
    const variantIndex = ((spec.index - 1) % AD_VARIANT_TYPES.length) + 1
    const { data: concept, error } = await adminClient
      .from('ad_concepts')
      .insert({
        tenant_id: run.tenant_id,
        run_id: run.id,
        angle: spec.angle.name,
        variant_index: variantIndex,
        variant_type: spec.variant,
        image_prompt: prompt,
        status: 'draft',
      })
      .select('id')
      .single()
    if (error || !concept) {
      console.error('concept insert failed', error)
      return null
    }

    const seedUrl = seedUrls.length > 0 ? seedUrls[(spec.index - 1) % seedUrls.length] : null
    const { png, costCents } = await generateImage({
      brandKit: kit,
      angle: spec.angle,
      variant: spec.variant,
      variantIndex: spec.index,
      prompt,
      seedUrl,
    })
    await addCost(run.id, costCents)

    const path = storagePaths.conceptImage(run.tenant_id, run.id, concept.id)
    const { signedUrl } = await uploadAsset(path, png, 'image/png')

    await adminClient.from('ad_concepts').update({ image_url: signedUrl }).eq('id', concept.id)

    return { id: concept.id, index: spec.index, angle: spec.angle.name, variant_type: spec.variant }
  } catch (err) {
    console.error('generateAndStoreConcept failed', err)
    return null
  }
}
