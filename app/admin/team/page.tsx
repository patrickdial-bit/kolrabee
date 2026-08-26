import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminTeamClient, { type TeamAdmin, type TeamInvite } from './AdminTeamClient'

export default async function AdminTeamPage() {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data: adminRows } = await adminClient
    .from('users')
    .select('id, first_name, last_name, email, status, created_at')
    .eq('tenant_id', tenant.id)
    .eq('role', 'admin')
    .order('created_at', { ascending: true })

  const { data: inviteRows } = await adminClient
    .from('platform_invites')
    .select('id, email, name, invited_at, expires_at, status')
    .eq('tenant_id', tenant.id)
    .eq('role', 'admin')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('invited_at', { ascending: false })

  const { data: estimatorRows } = await adminClient
    .from('users')
    .select('id, first_name, last_name, email, status, created_at')
    .eq('tenant_id', tenant.id)
    .eq('role', 'estimator')
    .order('created_at', { ascending: true })

  const { data: estimatorInviteRows } = await adminClient
    .from('platform_invites')
    .select('id, email, name, invited_at, expires_at, status')
    .eq('tenant_id', tenant.id)
    .eq('role', 'estimator')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('invited_at', { ascending: false })

  const admins = (adminRows ?? []) as TeamAdmin[]
  const invites = (inviteRows ?? []) as TeamInvite[]
  const estimators = (estimatorRows ?? []) as TeamAdmin[]
  const estimatorInvites = (estimatorInviteRows ?? []) as TeamInvite[]

  return (
    <AdminTeamClient
      admins={admins}
      invites={invites}
      estimators={estimators}
      estimatorInvites={estimatorInvites}
      tenantName={tenant.name}
      currentUserId={appUser.id}
      ownerUserId={tenant.owner_user_id}
    />
  )
}
