import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/AppShell'
import PhotosView from '@/components/photos/PhotosView'
import ProjectShareBar from '@/components/photos/ProjectShareBar'
import { getPhotos, listTags, listPhotoUploaders } from '@/lib/tag-actions'

export const dynamic = 'force-dynamic'

export default async function ProjectGalleryPage({ params }: { params: { projectId: string } }) {
  const { tenant } = await getCurrentUser()

  const adminClient = createAdminClient()
  const { data: project } = await adminClient
    .from('projects')
    .select('id, customer_name, address')
    .eq('id', params.projectId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!project) notFound()

  const [photos, tags, users] = await Promise.all([
    getPhotos({ projectId: params.projectId }),
    listTags(),
    listPhotoUploaders(),
  ])

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-8">
        <div className="min-w-0">
          <Link href="/admin/photos/galleries" className="inline-flex items-center gap-1 text-sm font-medium text-[#0F6E56] hover:underline">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Galleries
          </Link>
          <p className="mt-1 text-sm text-gray-500">{project.address}</p>
        </div>
        <ProjectShareBar projectId={params.projectId} projectName={project.customer_name} />
      </div>
      <PhotosView
        initialPhotos={photos}
        tags={tags}
        projects={[]}
        users={users}
        fixedProjectId={params.projectId}
        title={project.customer_name}
      />
    </AppShell>
  )
}
