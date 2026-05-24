import type { AdAngle, AdBrandKit, AdVariantType } from '@/lib/types'
import { AD_VARIANT_LABELS } from '@/lib/types'
import { downloadAsset } from './storage'
import { solidColorPng, tintFor } from './placeholder'

export const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'

const VARIANT_DIRECTION: Record<AdVariantType, string> = {
  lifestyle: 'Lifestyle scene: real homeowners enjoying the finished result in a warm, in-context setting.',
  studio: 'Clean studio product/detail shot with controlled lighting and a simple background.',
  testimonial_style: 'Authentic testimonial-style portrait of a satisfied customer, candid and trustworthy.',
  before_after: 'Side-by-side before/after transformation with clear contrast between the two states.',
}

// Build the image prompt combining angle visual direction + variant type + brand style.
export function buildImagePrompt(
  brandKit: AdBrandKit,
  angle: AdAngle,
  variant: AdVariantType
): string {
  return [
    `High-quality advertising photograph for ${brandKit.brand_name} (${brandKit.service_line}).`,
    `Angle: ${angle.name} — ${angle.hook}`,
    `Visual direction: ${angle.visual_direction}`,
    `Format: ${AD_VARIANT_LABELS[variant]}. ${VARIANT_DIRECTION[variant]}`,
    `Brand palette: primary ${brandKit.primary_color_hex}, secondary ${brandKit.secondary_color_hex}${
      brandKit.accent_color_hex ? `, accent ${brandKit.accent_color_hex}` : ''
    }.`,
    `Target audience: ${brandKit.target_audience} in ${brandKit.target_geo}.`,
    `Square 1:1 composition, photorealistic, no text overlays, no watermarks.`,
  ].join(' ')
}

type GenResult = { png: Buffer; costCents: number; usedFallback: boolean }

// Generate one image. Uses Gemini when GEMINI_API_KEY is set (image-to-image when a
// seed image is provided), otherwise a deterministic branded placeholder so the
// pipeline still completes.
export async function generateImage(params: {
  brandKit: AdBrandKit
  angle: AdAngle
  variant: AdVariantType
  variantIndex: number
  prompt: string
  seedUrl?: string | null
}): Promise<GenResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (apiKey) {
    try {
      const png = await callGemini(apiKey, params.prompt, params.seedUrl ?? null)
      if (png) return { png, costCents: 4, usedFallback: false }
    } catch (err) {
      console.error('Gemini image generation failed, using placeholder', err)
    }
  }
  const tint = tintFor(params.brandKit.primary_color_hex, params.variantIndex)
  return { png: solidColorPng(tint), costCents: 0, usedFallback: true }
}

async function callGemini(apiKey: string, prompt: string, seedUrl: string | null): Promise<Buffer | null> {
  const parts: any[] = [{ text: prompt }]

  if (seedUrl) {
    const seed = await downloadAsset(seedUrl)
    if (seed) {
      parts.push({
        inline_data: { mime_type: 'image/png', data: seed.toString('base64') },
      })
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
    }
  )

  if (!res.ok) {
    console.error('Gemini API error', res.status, await res.text())
    return null
  }

  const json: any = await res.json()
  const responseParts = json?.candidates?.[0]?.content?.parts ?? []
  for (const part of responseParts) {
    const data = part?.inline_data?.data ?? part?.inlineData?.data
    if (data) return Buffer.from(data, 'base64')
  }
  return null
}
