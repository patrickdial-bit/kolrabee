import { redirect } from 'next/navigation'
import { getCurrentSub } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCrewLeader, type CrewMember } from '@/lib/types'
import CrewPageClient from './CrewPageClient'

export default async function CrewPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const { appUser, tenant } = await getCurrentSub(slug)

  if (!isCrewLeader(appUser)) {
    redirect(`/${slug}/dashboard`)
  }

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('crew_members')
    .select('*')
    .eq('crew_leader_id', appUser.id)
    .order('status', { ascending: true })
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  const members = (data ?? []) as CrewMember[]

  return (
    <CrewPageClient
      slug={slug}
      tenantName={tenant.name}
      subName={`${appUser.first_name} ${appUser.last_name}`}
      members={members}
    />
  )
}
