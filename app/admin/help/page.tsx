import { getCurrentUser } from '@/lib/helpers'
import { getPublishedKb } from '@/lib/kb-actions'
import HelpClient from './HelpClient'

export default async function HelpPage() {
  const { tenant } = await getCurrentUser()
  const categories = await getPublishedKb()
  return <HelpClient tenantName={tenant.name} categories={categories} />
}
