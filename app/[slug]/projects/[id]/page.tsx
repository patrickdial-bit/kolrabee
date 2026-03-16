import { getCurrentSub, type Project, type ProjectInvitation } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import SubProjectDetailClient from './SubProjectDetailClient'

export default async function SubProjectDetailPage({
  params,
}: {
  params: { slug: string; id: string }
}) {
  const { slug, id } = params
  const { appUser, tenant } = await getCurrentSub(slug)

  const adminClient = createAdminClient()

  // Fetch project
  const { data: project } = await adminClient
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!project) {
    notFound()
  }

  // Fetch invitation for this sub
  const { data: invitation } = await adminClient
    .from('project_invitations')
    .select('*')
    .eq('project_id', id)
    .eq('subcontractor_id', appUser.id)
    .maybeSingle()

  // Sub must either be invited or have accepted this project
  if (!invitation && project.accepted_by !== appUser.id) {
    notFound()
  }

  return (
    <SubProjectDetailClient
      slug={slug}
      tenantName={tenant.name}
      subName={`${appUser.first_name} ${appUser.last_name}`}
      project={project as Project}
      invitation={invitation as ProjectInvitation | null}
      isAcceptedByMe={project.accepted_by === appUser.id}
    />
  )
}
