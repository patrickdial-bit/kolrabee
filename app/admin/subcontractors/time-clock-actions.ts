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

  const { error } = await adminClient
    .from('subcontractor_settings')
    .upsert(
      {
        tenant_id: tenant.id,
        subcontractor_id: subId,
        time_clock_enabled: enabled,
      },
      { onConflict: 'subcontractor_id' }
    )

  if (error) return { error: 'Failed to update time clock setting.' }

  revalidatePath('/admin/subcontractors')
  revalidatePath(`/admin/subcontractors/${subId}`)
  return { success: true, enabled }
}
