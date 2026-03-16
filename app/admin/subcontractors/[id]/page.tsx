import { notFound } from 'next/navigation'
import { getCurrentUser, type AppUser, type Project } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import SubDetailClient from './SubDetailClient'

export default async function SubDetailPage({ params }: { params: { id: string } }) {
  const { appUser, tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  // Fetch the subcontractor
  const { data: sub, error } = await adminClient
    .from('users')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .single()

  if (error || !sub) {
    notFound()
  }

  // Fetch their project history
  const { data: projects } = await adminClient
    .from('projects')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', params.id)
    .order('created_at', { ascending: false })

  // Calculate YTD earnings
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const ytdEarnings = (projects ?? [])
    .filter((p: any) => p.status === 'paid' && p.paid_at && p.paid_at >= yearStart)
    .reduce((sum: number, p: any) => sum + (p.payout_amount ?? 0), 0)

  return (
    <SubDetailClient
      sub={sub as AppUser}
      projects={(projects ?? []) as Project[]}
      ytdEarnings={ytdEarnings}
      tenantName={tenant.name}
    />
  )
}
