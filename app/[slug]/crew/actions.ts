'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentSub } from '@/lib/helpers'
import { isCrewLeader } from '@/lib/types'

async function assertLeader(slug: string) {
  const { appUser, tenant } = await getCurrentSub(slug)
  if (!isCrewLeader(appUser)) {
    return { error: 'Not authorized.' as const }
  }
  return { appUser, tenant, adminClient: createAdminClient() }
}

export async function addCrewMember(
  slug: string,
  firstName: string,
  lastName: string,
  phone?: string,
) {
  const r = await assertLeader(slug)
  if ('error' in r) return r

  const fn = firstName.trim()
  const ln = lastName.trim()
  if (!fn || !ln) return { error: 'First and last name are required.' }

  const { data, error } = await r.adminClient
    .from('crew_members')
    .insert({
      tenant_id: r.tenant.id,
      crew_leader_id: r.appUser.id,
      first_name: fn,
      last_name: ln,
      phone: phone?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) return { error: 'Failed to add crew member.' }

  revalidatePath(`/${slug}/crew`)
  revalidatePath(`/${slug}/dashboard`)
  return { success: true, id: data.id }
}

export async function updateCrewMember(
  slug: string,
  id: string,
  patch: { first_name?: string; last_name?: string; phone?: string | null },
) {
  const r = await assertLeader(slug)
  if ('error' in r) return r

  const update: Record<string, unknown> = {}
  if (patch.first_name !== undefined) {
    const fn = patch.first_name.trim()
    if (!fn) return { error: 'First name cannot be empty.' }
    update.first_name = fn
  }
  if (patch.last_name !== undefined) {
    const ln = patch.last_name.trim()
    if (!ln) return { error: 'Last name cannot be empty.' }
    update.last_name = ln
  }
  if (patch.phone !== undefined) {
    update.phone = patch.phone?.trim() || null
  }

  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await r.adminClient
    .from('crew_members')
    .update(update)
    .eq('id', id)
    .eq('crew_leader_id', r.appUser.id)

  if (error) return { error: 'Failed to update crew member.' }

  revalidatePath(`/${slug}/crew`)
  revalidatePath(`/${slug}/dashboard`)
  return { success: true }
}

export async function archiveCrewMember(slug: string, id: string) {
  const r = await assertLeader(slug)
  if ('error' in r) return r

  const { data: open } = await r.adminClient
    .from('time_entries')
    .select('id')
    .eq('crew_member_id', id)
    .is('clock_out', null)
    .maybeSingle()

  if (open) return { error: 'Clock this crew member out before archiving.' }

  const { error } = await r.adminClient
    .from('crew_members')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('crew_leader_id', r.appUser.id)

  if (error) return { error: 'Failed to archive crew member.' }

  revalidatePath(`/${slug}/crew`)
  revalidatePath(`/${slug}/dashboard`)
  return { success: true }
}

export async function restoreCrewMember(slug: string, id: string) {
  const r = await assertLeader(slug)
  if ('error' in r) return r

  const { error } = await r.adminClient
    .from('crew_members')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('crew_leader_id', r.appUser.id)

  if (error) return { error: 'Failed to restore crew member.' }

  revalidatePath(`/${slug}/crew`)
  revalidatePath(`/${slug}/dashboard`)
  return { success: true }
}
