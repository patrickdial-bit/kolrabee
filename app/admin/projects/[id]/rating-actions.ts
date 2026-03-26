'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasGrowthFeatures } from '@/lib/types'

export async function submitRating(projectId: string, rating: number, note: string | null) {
  if (rating < 1 || rating > 5) {
    return { error: 'Rating must be between 1 and 5.' }
  }

  const { appUser, tenant } = await getCurrentUser()

  if (!hasGrowthFeatures(tenant)) {
    return { error: 'Sub ratings require the Growth plan or higher. Please upgrade.' }
  }
  const adminClient = createAdminClient()

  // Get the project to find the sub
  const { data: project } = await adminClient
    .from('projects')
    .select('accepted_by, status')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!project || !project.accepted_by) {
    return { error: 'Project not found or no subcontractor assigned.' }
  }

  if (!['completed', 'paid'].includes(project.status)) {
    return { error: 'Project must be completed or paid to rate.' }
  }

  // Check if already rated
  const { data: existing } = await adminClient
    .from('sub_ratings')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle()

  if (existing) {
    return { error: 'This project has already been rated.' }
  }

  const { error } = await adminClient
    .from('sub_ratings')
    .insert({
      tenant_id: tenant.id,
      project_id: projectId,
      subcontractor_id: project.accepted_by,
      rated_by: appUser.id,
      rating,
      note: note?.trim() || null,
    })

  if (error) {
    console.error('Rating insert error:', error)
    return { error: `Failed to submit rating: ${error.message}` }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  return { success: true }
}

export async function getRatingForProject(projectId: string) {
  const { tenant } = await getCurrentUser()
  const adminClient = createAdminClient()

  const { data } = await adminClient
    .from('sub_ratings')
    .select('*')
    .eq('project_id', projectId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  return { rating: data }
}
