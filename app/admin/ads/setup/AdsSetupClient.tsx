'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import AdsTestingBanner from '@/components/AdsTestingBanner'
import type { AdBrandKit, AdComplianceStatus, AdSeedImageSource } from '@/lib/types'

interface Props {
  companyName: string
  complianceStatus: AdComplianceStatus
  brandKit: AdBrandKit
}

const inputClass =
  'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

export default function AdsSetupClient({ companyName, complianceStatus, brandKit }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    brand_name: brandKit.brand_name || '',
    service_line: brandKit.service_line || '',
    brand_website_url: brandKit.brand_website_url || '',
    primary_color_hex: brandKit.primary_color_hex || '#1E3A8A',
    secondary_color_hex: brandKit.secondary_color_hex || '#0D1B2A',
    accent_color_hex: brandKit.accent_color_hex || '#F59E0B',
    font_family: brandKit.font_family || 'sans-serif',
    brand_voice: brandKit.brand_voice || '',
    target_geo: brandKit.target_geo || '',
    target_audience: brandKit.target_audience || '',
    value_props: (brandKit.value_props || []).join('\n'),
    competitor_page_urls: (brandKit.competitor_page_urls || []).join('\n'),
  })

  const [seeds, setSeeds] = useState<AdSeedImageSource[]>(brandKit.seed_image_sources || [])
  const [candidates, setCandidates] = useState<string[]>([])
  const [scraping, setScraping] = useState(false)
  const [ingesting, setIngesting] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function findImages() {
    setError(null)
    setScraping(true)
    setCandidates([])
    try {
      const res = await fetch('/api/ads/brand-kit/scrape-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_url: form.brand_website_url }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not scrape images.')
      } else {
        setCandidates(data.candidates || [])
        if ((data.candidates || []).length === 0) {
          setError(data.error || 'No images found on that site.')
        }
      }
    } catch {
      setError('Network error scraping images.')
    } finally {
      setScraping(false)
    }
  }

  async function ingestScraped(url: string) {
    setIngesting(true)
    setError(null)
    try {
      const res = await fetch('/api/ads/brand-kit/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: url }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Could not add image.')
      else {
        setSeeds((s) => [...s, data.seed])
        setCandidates((c) => c.filter((u) => u !== url))
      }
    } catch {
      setError('Network error adding image.')
    } finally {
      setIngesting(false)
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setIngesting(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/ads/brand-kit/upload-image', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Upload failed.')
        } else {
          setSeeds((s) => [...s, data.seed])
        }
      }
    } catch {
      setError('Network error uploading file.')
    } finally {
      setIngesting(false)
    }
  }

  function removeSeed(url: string) {
    setSeeds((s) => s.filter((seed) => seed.url !== url))
  }

  async function save() {
    setError(null)
    if (!form.brand_name.trim()) {
      setError('Brand name is required.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/ads/brand-kit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          value_props: form.value_props.split('\n').map((s) => s.trim()).filter(Boolean),
          competitor_page_urls: form.competitor_page_urls.split('\n').map((s) => s.trim()).filter(Boolean),
          seed_image_urls: seeds.map((s) => s.url),
          seed_image_sources: seeds,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not save.')
        setSaving(false)
        return
      }
      router.push('/admin/ads')
    } catch {
      setError('Network error saving brand kit.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={companyName} />
      <AdsTestingBanner status={complianceStatus} />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Brand Kit</h1>
        <p className="text-sm text-gray-500 mb-6">The agent uses these inputs for every generation run.</p>

        <div className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <label className={labelClass}>Brand name *</label>
            <input className={inputClass} value={form.brand_name} onChange={(e) => update('brand_name', e.target.value)} placeholder="Painter1 of Columbus" />
          </div>
          <div>
            <label className={labelClass}>Service line</label>
            <input className={inputClass} value={form.service_line} onChange={(e) => update('service_line', e.target.value)} placeholder="Interior painting and cabinet refinishing" />
          </div>
          <div>
            <label className={labelClass}>Brand website URL</label>
            <input className={inputClass} value={form.brand_website_url} onChange={(e) => update('brand_website_url', e.target.value)} placeholder="painter1columbus.com" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ColorField label="Primary" value={form.primary_color_hex} onChange={(v) => update('primary_color_hex', v)} />
            <ColorField label="Secondary" value={form.secondary_color_hex} onChange={(v) => update('secondary_color_hex', v)} />
            <ColorField label="Accent" value={form.accent_color_hex} onChange={(v) => update('accent_color_hex', v)} />
          </div>

          <div>
            <label className={labelClass}>Brand voice</label>
            <textarea className={inputClass} rows={3} value={form.brand_voice} onChange={(e) => update('brand_voice', e.target.value)} placeholder="Warm, trustworthy, neighborly. Confident but never pushy." />
          </div>
          <div>
            <label className={labelClass}>Value props (one per line)</label>
            <textarea className={inputClass} rows={4} value={form.value_props} onChange={(e) => update('value_props', e.target.value)} placeholder={'Free in-home estimates\n5-year workmanship warranty\nLocally owned crew'} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Target geo</label>
              <input className={inputClass} value={form.target_geo} onChange={(e) => update('target_geo', e.target.value)} placeholder="Columbus, OH metro" />
            </div>
            <div>
              <label className={labelClass}>Font family</label>
              <input className={inputClass} value={form.font_family} onChange={(e) => update('font_family', e.target.value)} placeholder="sans-serif" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Target audience</label>
            <input className={inputClass} value={form.target_audience} onChange={(e) => update('target_audience', e.target.value)} placeholder="Homeowners age 35–65, household income $75k+" />
          </div>
          <div>
            <label className={labelClass}>Competitor Meta page URLs (one per line)</label>
            <textarea className={inputClass} rows={3} value={form.competitor_page_urls} onChange={(e) => update('competitor_page_urls', e.target.value)} placeholder={'https://facebook.com/fivestarpainting\nhttps://facebook.com/certapro'} />
          </div>

          {/* Seed images */}
          <div className="border-t border-gray-100 pt-5">
            <label className={labelClass}>Seed images</label>
            <p className="text-xs text-gray-500 mb-3">Used to guide imagery. Mix scraped and uploaded sources.</p>

            {seeds.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                {seeds.map((seed) => (
                  <div key={seed.url} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={seed.url} alt="seed" className="h-20 w-full rounded-md object-cover border border-gray-200" />
                    <span className="absolute bottom-0 left-0 rounded-tr bg-black/60 px-1 text-[9px] text-white">{seed.source}</span>
                    <button onClick={() => removeSeed(seed.url)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 group-hover:opacity-100">×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Path A: scrape */}
            <div className="rounded-md bg-gray-50 p-3 mb-3">
              <p className="text-xs font-medium text-gray-700 mb-2">Find images on my site</p>
              <button onClick={findImages} disabled={scraping || !form.brand_website_url} className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
                {scraping ? 'Scanning…' : 'Find images'}
              </button>
              {candidates.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {candidates.map((url) => (
                    <button key={url} onClick={() => ingestScraped(url)} disabled={ingesting} className="relative block focus:outline-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="candidate" className="h-16 w-full rounded object-cover border border-gray-200 hover:ring-2 hover:ring-ember" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Path B: upload */}
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-700 mb-2">Upload images</p>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={(e) => uploadFiles(e.target.files)} className="text-xs text-gray-600" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button onClick={() => router.push('/admin/ads')} className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={save} disabled={saving || ingesting} className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-ember/90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save brand kit'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-9 rounded border border-gray-300 p-0.5" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember" />
      </div>
    </div>
  )
}
