'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentSub } from '@/lib/helpers'
import { hasTimeTracking } from '@/lib/types'

async function assertClockEnabled(slug: string) {
  const { appUser, tenant } = await getCurrentSub(slug)
  if (!hasTimeTracking(tenant)) {
    return { error: 'Time tracking not available on this plan.' as const }
  }

  const adminClient = createAdminClient()
  const { data: settings } = await adminClient
    .from('subcontractor_settings')
    .select('time_clock_enabled')
    .eq('subcontractor_id', appUser.id)
    .maybeSingle()

  if (!settings?.time_clock_enabled) {
    return { error: 'Time clock is not enabled for your account.' as const }
  }

  return { appUser, tenant, adminClient }
}

export async function clockIn(slug: string, projectId: string, force = false) {
  const result = await assertClockEnabled(slug)
  if ('error' in result) return { error: result.error }
  const { appUser, tenant, adminClient } = result

  // Verify project belongs to tenant and the sub has accepted it.
  const { data: project } = await adminClient
    .from('projects')
    .select('id, tenant_id, accepted_by, status, customer_name, job_number')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!project) return { error: 'Project not found.' }
  if (project.accepted_by !== appUser.id) {
    return { error: 'You can only clock in to jobs you have accepted.' }
  }

  // Check for an existing open entry.
  const { data: openEntry } = await adminClient
    .from('time_entries')
    .select('id, project_id, clock_in, projects:project_id (customer_name, job_number)')
    .eq('subcontractor_id', appUser.id)
    .is('clock_out', null)
    .maybeSingle()

  if (openEntry) {
    if (openEntry.project_id === projectId) {
      return { error: 'You are already clocked in to this job.' }
    }
    if (!force) {
      const p = (openEntry as any).projects
      const label = p?.job_number || p?.customer_name || 'another job'
      return {
        conflict: true as const,
        openEntryId: openEntry.id,
        openProjectLabel: label,
      }
    }
    // Force path: close the old one as of now so we can open a new one.
    const { error: closeErr } = await adminClient
      .from('time_entries')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', openEntry.id)
      .eq('subcontractor_id', appUser.id)
    if (closeErr) return { error: 'Could not close the previous entry.' }
  }

  const { data: inserted, error } = await adminClient
    .from('time_entries')
    .insert({
      tenant_id: tenant.id,
      subcontractor_id: appUser.id,
      project_id: projectId,
      clock_in: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: 'Failed to clock in.' }

  revalidatePath(`/${slug}/dashboard`)
  return { success: true, entryId: inserted.id }
}

export async function clockOut(slug: string, entryId: string, overrideClockOut?: string) {
  const result = await assertClockEnabled(slug)
  if ('error' in result) return { error: result.error }
  const { appUser, adminClient } = result

  const { data: entry } = await adminClient
    .from('time_entries')
    .select('id, subcontractor_id, clock_in, clock_out')
    .eq('id', entryId)
    .single()

  if (!entry || entry.subcontractor_id !== appUser.id) {
    return { error: 'Entry not found.' }
  }
  if (entry.clock_out !== null) {
    return { error: 'Already clocked out.' }
  }

  const clockOutIso = overrideClockOut ?? new Date().toISOString()
  if (new Date(clockOutIso) <= new Date(entry.clock_in)) {
    return { error: 'Clock-out time must be after clock-in time.' }
  }

  const { error } = await adminClient
    .from('time_entries')
    .update({ clock_out: clockOutIso })
    .eq('id', entryId)

  if (error) return { error: 'Failed to clock out.' }

  revalidatePath(`/${slug}/dashboard`)
  return { success: true }
}

export async function resolveStaleEntry(slug: string, entryId: string, actualClockOut: string) {
  return clockOut(slug, entryId, actualClockOut)
}
