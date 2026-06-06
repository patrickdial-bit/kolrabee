import { getCurrentUser } from '@/lib/helpers'
import AppShell from '@/components/AppShell'
import GalleriesView from '@/components/photos/GalleriesView'
import { getGalleries, listTags } from '@/lib/tag-actions'

export const dynamic = 'force-dynamic'

export default async function GalleriesPage() {
  const { tenant } = await getCurrentUser()
  const [projects, tags] = await Promise.all([getGalleries(), listTags()])

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <GalleriesView initialProjects={projects} tags={tags} />
    </AppShell>
  )
}
