import { getCurrentSub, type Project, type ProjectInvitation } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProjectAttachment } from '@/lib/types'
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

  // Fetch attachments
  const { data: attachmentsData } = await adminClient
    .from('project_attachments')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  // Fetch messages (only if sub accepted this project)
  let messages: any[] = []
  if (project.accepted_by === appUser.id) {
    const { data: messagesData } = await adminClient
      .from('job_messages')
      .select('*, sender:users!job_messages_sender_id_fkey(first_name, last_name)')
      .eq('project_id', id)
      .order('created_at', { ascending: true })

    messages = (messagesData ?? []).map((m: any) => ({
      id: m.id,
      tenant_id: m.tenant_id,
      project_id: m.project_id,
      sender_id: m.sender_id,
      body: m.body,
      created_at: m.created_at,
      sender_name: m.sender ? `${m.sender.first_name} ${m.sender.last_name}` : 'Unknown',
    }))
  }

  return (
    <SubProjectDetailClient
      slug={slug}
      tenantName={tenant.name}
      subName={`${appUser.first_name} ${appUser.last_name}`}
      project={project as Project}
      invitation={invitation as ProjectInvitation | null}
      isAcceptedByMe={project.accepted_by === appUser.id}
      attachments={(attachmentsData ?? []) as ProjectAttachment[]}
      messages={messages}
      currentUserId={appUser.id}
    />
  )
}
