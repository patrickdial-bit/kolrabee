import Anthropic from '@anthropic-ai/sdk'
import type { AdAngle, AdBrandKit, AdVariantType } from '@/lib/types'
import { AD_HEADLINE_MAX, AD_PRIMARY_TEXT_MAX } from '@/lib/types'

export const ANTHROPIC_MODEL = 'claude-sonnet-4-6'

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

function textFromResponse(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

// Extract a JSON value from a model response that may be wrapped in prose or fences.
function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.search(/[[{]/)
  if (start === -1) return null
  const slice = candidate.slice(start)
  try {
    return JSON.parse(slice) as T
  } catch {
    // Try trimming to the last closing bracket/brace.
    const lastArr = slice.lastIndexOf(']')
    const lastObj = slice.lastIndexOf('}')
    const end = Math.max(lastArr, lastObj)
    if (end > 0) {
      try {
        return JSON.parse(slice.slice(0, end + 1)) as T
      } catch {
        return null
      }
    }
    return null
  }
}

const ANGLE_SYNTHESIS_SYSTEM_PROMPT = `You are an expert direct-response ad strategist for service businesses.
Given competitor ad data and brand context, synthesize 5 distinct ad angles
that this brand could win with on Meta.

An "angle" is a single psychological hook with a clear customer benefit.
Examples for painting: "Save $500 — no obligation quote", "Done in 1 day",
"5-year warranty included", "Local crew you can trust", "Before/after transformation".

Return exactly 5 angles as a JSON array. For each, provide:
- name (short label)
- hook (one-sentence customer benefit)
- emotional_driver (one of: price, speed, trust, quality, transformation)
- visual_direction (one paragraph describing the imagery the ads should evoke)

Return ONLY the JSON array, no prose.`

const COPY_SYSTEM_PROMPT = `You are a direct-response copywriter for service businesses on Meta.
Write headline + primary text for each ad concept.

Constraints:
- Headline: <= ${AD_HEADLINE_MAX} characters, sentence case, no clickbait
- Primary text: <= ${AD_PRIMARY_TEXT_MAX} characters, conversational, one clear CTA
- Match the brand voice exactly
- Each concept's copy must reflect its angle and visual style
- Avoid superlative claims ("best", "cheapest")

Return ONLY a JSON array, one object per concept, in the same order received,
each: { "index": <number>, "headline": <string>, "primary_text": <string> }.`

function brandContext(brandKit: AdBrandKit): string {
  return [
    `Brand: ${brandKit.brand_name}`,
    `Service line: ${brandKit.service_line}`,
    `Target geo: ${brandKit.target_geo}`,
    `Target audience: ${brandKit.target_audience}`,
    `Brand voice: ${brandKit.brand_voice}`,
    `Value props: ${(brandKit.value_props || []).join('; ')}`,
  ].join('\n')
}

// --- Step 2: angle synthesis -----------------------------------------------

export async function synthesizeAngles(
  brandKit: AdBrandKit,
  scrapeSummary: unknown
): Promise<{ angles: AdAngle[]; costCents: number; usedFallback: boolean }> {
  const anthropic = client()
  if (anthropic) {
    try {
      const userPrompt = [
        brandContext(brandKit),
        '',
        'Competitor ad data (from Meta Ad Library):',
        JSON.stringify(scrapeSummary ?? {}, null, 2).slice(0, 12000),
      ].join('\n')

      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        system: ANGLE_SYNTHESIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const parsed = extractJson<AdAngle[]>(textFromResponse(response.content))
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        return { angles: normalizeAngles(parsed), costCents: 2, usedFallback: false }
      }
    } catch (err) {
      console.error('synthesizeAngles failed, using fallback', err)
    }
  }
  return { angles: fallbackAngles(brandKit), costCents: 0, usedFallback: true }
}

function normalizeAngles(raw: AdAngle[]): AdAngle[] {
  const drivers = ['price', 'speed', 'trust', 'quality', 'transformation']
  return raw.slice(0, 5).map((a, i) => ({
    name: a.name || `Angle ${i + 1}`,
    hook: a.hook || '',
    emotional_driver: (drivers.includes(a.emotional_driver) ? a.emotional_driver : 'trust') as AdAngle['emotional_driver'],
    visual_direction: a.visual_direction || '',
  }))
}

// Hard-coded angle set (spec §11 Sprint 3 / scraper resilience fallback).
export function fallbackAngles(brandKit: AdBrandKit): AdAngle[] {
  const svc = brandKit.service_line || 'home services'
  const geo = brandKit.target_geo || 'your area'
  return [
    {
      name: 'No-obligation quote',
      hook: `Get a free, no-pressure quote for ${svc}.`,
      emotional_driver: 'price',
      visual_direction: `A friendly estimator reviewing a bright, freshly finished room with the homeowner, warm natural light, approachable and trustworthy mood.`,
    },
    {
      name: 'Done fast',
      hook: 'Most jobs finished in a single day with minimal disruption.',
      emotional_driver: 'speed',
      visual_direction: `A clean, efficient crew at work, motion and energy, crisp tools and tidy drop cloths, a sense of speed and professionalism.`,
    },
    {
      name: 'Local crew you can trust',
      hook: `A locally owned ${geo} team that treats your home like their own.`,
      emotional_driver: 'trust',
      visual_direction: `A small local team smiling in front of a tidy work van, neighborhood backdrop, authentic and grounded, community feel.`,
    },
    {
      name: 'Premium finish',
      hook: 'Meticulous prep and premium materials for a flawless result.',
      emotional_driver: 'quality',
      visual_direction: `An extreme close-up of a perfectly smooth, crisp paint edge and rich color, studio lighting, premium and detail-obsessed.`,
    },
    {
      name: 'Before & after',
      hook: 'See the dramatic transformation a fresh finish delivers.',
      emotional_driver: 'transformation',
      visual_direction: `A split before/after of a dated room becoming bright and modern, dramatic contrast, satisfying and aspirational.`,
    },
  ]
}

// --- Step 4: copy generation (single batched call) -------------------------

export type CopyConceptInput = {
  index: number
  angle: string
  variant_type: AdVariantType
  image_prompt: string
}

export type CopyPair = { index: number; headline: string; primary_text: string }

export async function generateCopy(
  brandKit: AdBrandKit,
  angles: AdAngle[],
  concepts: CopyConceptInput[]
): Promise<{ pairs: CopyPair[]; costCents: number; usedFallback: boolean }> {
  const anthropic = client()
  if (anthropic) {
    try {
      const userPrompt = [
        brandContext(brandKit),
        '',
        'Angles:',
        JSON.stringify(angles, null, 2),
        '',
        'Concepts needing copy:',
        JSON.stringify(concepts, null, 2),
      ].join('\n')

      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: COPY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const parsed = extractJson<CopyPair[]>(textFromResponse(response.content))
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        const byIndex = new Map(parsed.map((p) => [p.index, p]))
        const pairs = concepts.map((c) => {
          const p = byIndex.get(c.index)
          return clampPair({
            index: c.index,
            headline: p?.headline ?? fallbackPair(c).headline,
            primary_text: p?.primary_text ?? fallbackPair(c).primary_text,
          })
        })
        return { pairs, costCents: 5, usedFallback: false }
      }
    } catch (err) {
      console.error('generateCopy failed, using fallback', err)
    }
  }
  return { pairs: concepts.map((c) => clampPair(fallbackPair(c))), costCents: 0, usedFallback: true }
}

function clampPair(p: CopyPair): CopyPair {
  return {
    index: p.index,
    headline: (p.headline || '').slice(0, AD_HEADLINE_MAX),
    primary_text: (p.primary_text || '').slice(0, AD_PRIMARY_TEXT_MAX),
  }
}

function fallbackPair(c: CopyConceptInput): CopyPair {
  return {
    index: c.index,
    headline: `${c.angle}`.slice(0, AD_HEADLINE_MAX),
    primary_text: `${c.angle} — request your free quote today.`.slice(0, AD_PRIMARY_TEXT_MAX),
  }
}
