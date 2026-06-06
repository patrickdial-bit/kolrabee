import { getCurrentUser } from '@/lib/helpers'
import AppShell from '@/components/AppShell'
import TagsManager from '@/components/photos/TagsManager'
import { listTagsWithCounts } from '@/lib/tag-actions'

export const dynamic = 'force-dynamic'

export default async function TagsPage() {
  const { tenant } = await getCurrentUser()
  const tags = await listTagsWithCounts()

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <TagsManager initialTags={tags} />
    </AppShell>
  )
}
