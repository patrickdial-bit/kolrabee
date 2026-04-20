'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/helpers'
import { hasTimeTracking } from '@/lib/types'

export async function setTimeClockEnabled(subId: string, enabled: boolean) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') return { error: 'Unauthorized' }
  if (!hasTimeTracking(tenant)) return { error: 'Time tracking requires the Growth plan or higher.' }

  const adminClient = createAdminClient()

  const { data: sub } = await adminClient
    .from('users')
    .select('id, tenant_id')
    .eq('id', subId)
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .single()

  if (!sub) return { error: 'Subcontractor not found.' }

  const { data: existing, error: selectErr } = await adminClient
    .from('subcontractor_settings')
    .select('id')
    .eq('subcontractor_id', subId)
    .maybeSingle()

  if (selectErr) {
    console.error('setTimeClockEnabled select error:', selectErr)
    return { error: 'Failed to update time clock setting.' }
  }

  const mutation = existing
    ? adminClient
        .from('subcontractor_settings')
        .update({ time_clock_enabled: enabled })
        .eq('id', existing.id)
    : adminClient
        .from('subcontractor_settings')
        .insert({
          tenant_id: tenant.id,
          subcontractor_id: subId,
          time_clock_enabled: enabled,
        })

  const { error } = await mutation

  if (error) {
    console.error('setTimeClockEnabled mutation error:', error)
    return { error: 'Failed to update time clock setting.' }
  }

  revalidatePath('/admin/subcontractors')
  revalidatePath(`/admin/subcontractors/${subId}`)
  return { success: true, enabled }
}
