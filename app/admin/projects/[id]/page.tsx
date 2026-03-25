import { notFound } from 'next/navigation'
import { getCurrentUser, type Project, type ProjectInvitation } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SubRating, ProjectAttachment, JobMessage } from '@/lib/types'
import ProjectDetailClient from './ProjectDetailClient'

interface PageProps {
  params: { id: string }
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { appUser, tenant } = await getCurrentUser()

  const adminClient = createAdminClient()

  // Fetch the project
  const { data: project } = await adminClient
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!project) {
    notFound()
  }

  // Fetch invitations with subcontractor info
  const { data: invitations } = await adminClient
    .from('project_invitations')
    .select('*, subcontractor:users!project_invitations_subcontractor_id_fkey(id, first_name, last_name, email)')
    .eq('project_id', project.id)
    .eq('tenant_id', tenant.id)

  // Fetch the accepted_by user info if applicable
  let acceptedByUser: { first_name: string; last_name: string; email: string } | null = null
  if (project.accepted_by) {
    const { data: user } = await adminClient
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', project.accepted_by)
      .single()
    acceptedByUser = user
  }

  // Fetch rating for this project
  const { data: ratingData } = await adminClient
    .from('sub_ratings')
    .select('*')
    .eq('project_id', project.id)
    .maybeSingle()

  // Fetch attachments
  const { data: attachmentsData } = await adminClient
    .from('project_attachments')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true })

  // Fetch messages
  const { data: messagesData } = await adminClient
    .from('job_messages')
    .select('*, sender:users!job_messages_sender_id_fkey(first_name, last_name)')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true })

  const messages = (messagesData ?? []).map((m: any) => ({
    id: m.id,
    tenant_id: m.tenant_id,
    project_id: m.project_id,
    sender_id: m.sender_id,
    body: m.body,
    created_at: m.created_at,
    sender_name: m.sender ? `${m.sender.first_name} ${m.sender.last_name}` : 'Unknown',
  }))

  const invitationsWithNames = (invitations ?? []).map((inv: any) => ({
    id: inv.id,
    project_id: inv.project_id,
    tenant_id: inv.tenant_id,
    subcontractor_id: inv.subcontractor_id,
    status: inv.status as 'invited' | 'accepted' | 'declined',
    invited_at: inv.invited_at,
    subcontractor_name: inv.subcontractor
      ? `${inv.subcontractor.first_name} ${inv.subcontractor.last_name}`
      : 'Unknown',
    subcontractor_email: inv.subcontractor?.email ?? '',
  }))

  return (
    <ProjectDetailClient
      project={project as Project}
      invitations={invitationsWithNames}
      acceptedByUser={acceptedByUser}
      tenantName={tenant.name}
      tenantId={tenant.id}
      existingRating={ratingData as SubRating | null}
      attachments={(attachmentsData ?? []) as ProjectAttachment[]}
      messages={messages}
      currentUserId={appUser.id}
    />
  )
}
