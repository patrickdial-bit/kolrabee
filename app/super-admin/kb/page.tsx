import { requireSuperAdmin } from '@/lib/helpers'
import { getAllKbForAdmin } from '@/lib/kb-actions'
import KbAdminClient from './KbAdminClient'

export default async function SuperAdminKbPage() {
  await requireSuperAdmin()
  const { categories, articles } = await getAllKbForAdmin()
  return <KbAdminClient categories={categories} articles={articles} />
}
