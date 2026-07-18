'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSub } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { DOOR_KNOCK_OUTCOMES, type DoorKnockOutcome } from '@/lib/types'

export async function logDoorKnock(
  slug: string,
  projectId: string,
  input: {
    outcome: DoorKnockOutcome
    notes?: string
    address?: string
    latitude?: number | null
    longitude?: number | null
  }
) {
  const { appUser, tenant } = await getCurrentSub(slug)

  if (!DOOR_KNOCK_OUTCOMES.some((o) => o.value === input.outcome)) {
    return { error: 'Invalid outcome.' }
  }

  const adminClient = createAdminClient()

  // Only the accepted rep can log doors, and only on door-to-door jobs
  const { data: project } = await adminClient
    .from('projects')
    .select('id, project_type')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .eq('accepted_by', appUser.id)
    .single()

  if (!project) {
    return { error: 'You can only log doors on jobs you have accepted.' }
  }
  if (project.project_type !== 'door_to_door') {
    return { error: 'This job does not track door knocks.' }
  }

  const lat =
    typeof input.latitude === 'number' && isFinite(input.latitude) && Math.abs(input.latitude) <= 90
      ? input.latitude
      : null
  const lng =
    typeof input.longitude === 'number' && isFinite(input.longitude) && Math.abs(input.longitude) <= 180
      ? input.longitude
      : null

  const { error } = await adminClient.from('door_knocks').insert({
    tenant_id: tenant.id,
    project_id: projectId,
    subcontractor_id: appUser.id,
    outcome: input.outcome,
    notes: input.notes?.trim().slice(0, 500) || null,
    address: input.address?.trim().slice(0, 300) || null,
    latitude: lat,
    longitude: lng,
  })

  if (error) {
    return { error: 'Failed to log the door. Please try again.' }
  }

  revalidatePath(`/${slug}/projects/${projectId}`)
  return { success: true }
}

export async function deleteDoorKnock(slug: string, knockId: string) {
  const { appUser, tenant } = await getCurrentSub(slug)
  const adminClient = createAdminClient()

  const { data: rows, error } = await adminClient
    .from('door_knocks')
    .delete()
    .eq('id', knockId)
    .eq('tenant_id', tenant.id)
    .eq('subcontractor_id', appUser.id)
    .select('project_id')

  if (error || !rows || rows.length === 0) {
    return { error: 'Could not remove that entry.' }
  }

  revalidatePath(`/${slug}/projects/${rows[0].project_id}`)
  return { success: true }
}
