import { notFound } from 'next/navigation'
import { getCurrentUser, type Project, type ProjectInvitation } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SubRating, ProjectAttachment, JobMessage, ChangeOrder } from '@/lib/types'
import { subDisplayName } from '@/lib/types'
import { getProjectPhotos } from '@/lib/photo-actions'
import { getIntegrationStatus } from '@/lib/integrations/backup'
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
    .select('*, subcontractor:users!project_invitations_subcontractor_id_fkey(id, first_name, last_name, email, company_name)')
    .eq('project_id', project.id)
    .eq('tenant_id', tenant.id)

  // Fetch the accepted_by user info if applicable
  let acceptedByUser:
    | { first_name: string; last_name: string; email: string; company_name: string | null; display_name: string }
    | null = null
  if (project.accepted_by) {
    const { data: user } = await adminClient
      .from('users')
      .select('first_name, last_name, email, company_name')
      .eq('id', project.accepted_by)
      .single()
    acceptedByUser = user ? { ...user, display_name: subDisplayName(user) } : null
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

  // Change orders — scope/pay adjustment history, newest first.
  const { data: changeOrdersData } = await adminClient
    .from('change_orders')
    .select('*, creator:users!change_orders_created_by_fkey(first_name, last_name)')
    .eq('project_id', project.id)
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  const changeOrders = (changeOrdersData ?? []).map((c: any) => ({
    id: c.id,
    tenant_id: c.tenant_id,
    project_id: c.project_id,
    amount: Number(c.amount),
    description: c.description,
    previous_payout: Number(c.previous_payout),
    new_payout: Number(c.new_payout),
    created_by: c.created_by,
    created_at: c.created_at,
    created_by_name: c.creator ? `${c.creator.first_name} ${c.creator.last_name}` : 'Admin',
  }))

  // Cloud backup connection — controls whether the "Back up to Drive" action shows.
  const integration = await getIntegrationStatus(tenant.id)

  // Jobsite photos with signed thumbnail URLs for the gallery.
  const photos = await getProjectPhotos(project.id)

  const invitationsWithNames = (invitations ?? []).map((inv: any) => ({
    id: inv.id,
    project_id: inv.project_id,
    tenant_id: inv.tenant_id,
    subcontractor_id: inv.subcontractor_id,
    status: inv.status as 'invited' | 'accepted' | 'declined',
    invited_at: inv.invited_at,
    subcontractor_name: inv.subcontractor
      ? subDisplayName(inv.subcontractor)
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
      tenantPlan={tenant.plan ?? 'free'}
      existingRating={ratingData as SubRating | null}
      attachments={(attachmentsData ?? []) as ProjectAttachment[]}
      messages={messages}
      changeOrders={changeOrders}
      currentUserId={appUser.id}
      photos={photos}
      driveConnected={integration.connected}
    />
  )
}
