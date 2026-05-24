import type { AdComplianceStatus } from '@/lib/types'

// Global gate banner shown on every Ads Agent screen (and in the export README)
// while output has not been cleared for paid spend (spec §6 / §10).
export default function AdsTestingBanner({ status }: { status: AdComplianceStatus }) {
  if (status !== 'testing_only') return null
  return (
    <div className="border-b border-amber-300 bg-amber-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5">
        <p className="text-sm text-amber-800">
          <span className="font-semibold">⚠️ Testing only — do not run paid.</span>{' '}
          This output has not been cleared for paid ad spend. Use for internal review only.
        </p>
      </div>
    </div>
  )
}
