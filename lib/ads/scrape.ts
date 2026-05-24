import type { AdBrandKit } from '@/lib/types'

export type ScrapedAd = {
  headline: string
  primary_text: string
  image_url: string | null
  run_duration: string | null
  format: 'image' | 'video' | 'carousel' | 'unknown'
}

export type CompetitorScrapeSummary = {
  source: 'meta_ad_library'
  scraped_at: string
  competitors: { page_url: string; ad_count: number; ads: ScrapedAd[] }[]
  fallback_used: boolean
  note?: string
}

const MAX_ADS_PER_COMPETITOR = 30

// Step 1: competitor scrape.
//
// Note (prototype): the Meta Ad Library is a JS-rendered SPA that blocks plain
// HTTP scraping, and headless-browser (Playwright) runtime is not available in
// this build host. Per spec §4 "Scraper resilience", we attempt a best-effort
// fetch and otherwise fall back to a hard-coded competitor summary so the rest of
// the pipeline still runs. v2 swaps this for a real Playwright scrape.
export async function scrapeCompetitors(brandKit: AdBrandKit): Promise<CompetitorScrapeSummary> {
  const urls = brandKit.competitor_page_urls || []
  const summary: CompetitorScrapeSummary = {
    source: 'meta_ad_library',
    scraped_at: new Date().toISOString(),
    competitors: [],
    fallback_used: false,
  }

  if (urls.length === 0) {
    return { ...fallbackSummary(brandKit), note: 'No competitor page URLs configured.' }
  }

  let anySuccess = false
  for (const url of urls) {
    try {
      const ads = await tryFetchAds(url)
      if (ads.length > 0) anySuccess = true
      summary.competitors.push({ page_url: url, ad_count: ads.length, ads: ads.slice(0, MAX_ADS_PER_COMPETITOR) })
    } catch (err) {
      console.error('scrape failed for', url, err)
      summary.competitors.push({ page_url: url, ad_count: 0, ads: [] })
    }
  }

  if (!anySuccess) {
    return { ...fallbackSummary(brandKit), note: 'Live scrape returned no usable ads; used heuristic fallback.' }
  }
  return summary
}

async function tryFetchAds(_url: string): Promise<ScrapedAd[]> {
  // Placeholder for the real Playwright extraction. Meta Ad Library content is not
  // available via plain fetch, so this returns nothing and the caller falls back.
  return []
}

function fallbackSummary(brandKit: AdBrandKit): CompetitorScrapeSummary {
  const svc = brandKit.service_line || 'home services'
  return {
    source: 'meta_ad_library',
    scraped_at: new Date().toISOString(),
    fallback_used: true,
    competitors: [
      {
        page_url: 'fallback://industry-benchmarks',
        ad_count: 4,
        ads: [
          {
            headline: 'Free in-home estimate',
            primary_text: `Book a no-obligation ${svc} quote this week.`,
            image_url: null,
            run_duration: '30+ days',
            format: 'image',
          },
          {
            headline: 'Finished in a day',
            primary_text: 'Fast, tidy, and done right the first time.',
            image_url: null,
            run_duration: '14 days',
            format: 'image',
          },
          {
            headline: 'Locally owned & insured',
            primary_text: 'Trusted neighbors, backed by a written warranty.',
            image_url: null,
            run_duration: '60+ days',
            format: 'carousel',
          },
          {
            headline: 'See the transformation',
            primary_text: 'Before & after results that speak for themselves.',
            image_url: null,
            run_duration: '21 days',
            format: 'image',
          },
        ],
      },
    ],
  }
}
