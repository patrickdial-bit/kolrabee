import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/helpers'
import AppShell from '@/components/AppShell'
import BillingClient from './BillingClient'

export default async function BillingPage() {
  const { appUser, tenant } = await getCurrentUser()

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<div className="text-center py-12 text-gray-500">Loading billing...</div>}>
          <BillingClient tenant={tenant} />
        </Suspense>
      </main>
    </AppShell>
  )
}
