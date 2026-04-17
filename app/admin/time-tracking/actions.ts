'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/helpers'
import { hasTimeTracking } from '@/lib/types'

export async function updateTimeEntry(
  entryId: string,
  updates: { clock_in?: string; clock_out?: string | null; notes?: string | null }
) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') return { error: 'Unauthorized' }
  if (!hasTimeTracking(tenant)) return { error: 'Time tracking requires the Growth plan or higher.' }

  const adminClient = createAdminClient()

  const { data: entry } = await adminClient
    .from('time_entries')
    .select('id, tenant_id, clock_in, clock_out')
    .eq('id', entryId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!entry) return { error: 'Entry not found.' }

  const nextClockIn = updates.clock_in ?? entry.clock_in
  const nextClockOut = updates.clock_out === undefined ? entry.clock_out : updates.clock_out
  if (nextClockOut !== null && new Date(nextClockOut) <= new Date(nextClockIn)) {
    return { error: 'Clock-out time must be after clock-in time.' }
  }

  const payload: Record<string, unknown> = {
    edited_by_admin_id: appUser.id,
    edited_at: new Date().toISOString(),
  }
  if (updates.clock_in !== undefined) payload.clock_in = updates.clock_in
  if (updates.clock_out !== undefined) payload.clock_out = updates.clock_out
  if (updates.notes !== undefined) payload.notes = updates.notes

  const { error } = await adminClient
    .from('time_entries')
    .update(payload)
    .eq('id', entryId)

  if (error) return { error: 'Failed to update entry.' }

  revalidatePath('/admin/time-tracking')
  return { success: true }
}

export async function deleteTimeEntry(entryId: string) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') return { error: 'Unauthorized' }
  if (!hasTimeTracking(tenant)) return { error: 'Time tracking requires the Growth plan or higher.' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('time_entries')
    .delete()
    .eq('id', entryId)
    .eq('tenant_id', tenant.id)

  if (error) return { error: 'Failed to delete entry.' }

  revalidatePath('/admin/time-tracking')
  return { success: true }
}
