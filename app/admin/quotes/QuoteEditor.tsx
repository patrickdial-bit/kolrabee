'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import MarginCalculator from '@/components/MarginCalculator'
import type { ProfitThresholds, ProjectEstimate } from '@/lib/types'

interface QuoteEditorProps {
  estimate: ProjectEstimate | null
  thresholds: ProfitThresholds
  tenantName: string
  role: 'admin' | 'estimator'
}

// Shared editor for /admin/quotes/new (estimate = null) and
// /admin/quotes/[id] (estimate loaded). MarginCalculator runs in standalone
// quote mode — no project required.
export default function QuoteEditor({ estimate, thresholds, tenantName, role }: QuoteEditorProps) {
  const router = useRouter()

  return (
    <AppShell variant="admin" companyName={tenantName} role={role}>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/admin/quotes" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700">
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Quotes
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">
              {estimate ? `Quote — ${estimate.customer_name ?? 'Unknown'}` : 'New Quote'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Check the guardrails before the contract goes to the customer.
            </p>
          </div>

          <MarginCalculator
            estimate={estimate}
            thresholds={thresholds}
            onSave={() => {
              toast.success('Quote saved.')
              router.push('/admin/quotes')
              router.refresh()
            }}
          />
        </div>
      </main>
    </AppShell>
  )
}
