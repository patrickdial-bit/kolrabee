import { getCurrentUser } from '@/lib/helpers'
import AppShell from '@/components/AppShell'
import CompanyCamImport from '@/components/photos/CompanyCamImport'
import { getImportState } from '@/lib/companycam/actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function CompanyCamImportPage() {
  const { tenant } = await getCurrentUser()
  const state = await getImportState()

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <CompanyCamImport initialState={state} />
    </AppShell>
  )
}
