import { getCurrentUser } from '@/lib/helpers'
import AdminNav from '@/components/AdminNav'
import BillingClient from './BillingClient'

export default async function BillingPage() {
  const { appUser, tenant } = await getCurrentUser()

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav companyName={tenant.name} />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <BillingClient tenant={tenant} />
      </main>
    </div>
  )
}
