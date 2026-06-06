import { getCurrentUser } from '@/lib/helpers'
import AppShell from '@/components/AppShell'
import PhotosView from '@/components/photos/PhotosView'
import { getPhotos, listTags, listTenantProjects, listPhotoUploaders } from '@/lib/tag-actions'

export const dynamic = 'force-dynamic'

export default async function AllPhotosPage() {
  const { tenant } = await getCurrentUser()
  const [photos, tags, projects, users] = await Promise.all([
    getPhotos(),
    listTags(),
    listTenantProjects(),
    listPhotoUploaders(),
  ])

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <PhotosView initialPhotos={photos} tags={tags} projects={projects} users={users} />
    </AppShell>
  )
}
