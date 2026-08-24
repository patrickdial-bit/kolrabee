'use server'

import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return new Response('Unauthorized', { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return new Response('Missing projectId', { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data: project } = await adminClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!project) {
    return new Response('Project not found', { status: 404 })
  }

  const { data, error } = await adminClient
    .from('project_estimates')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching estimate:', error)
    return new Response('Failed to fetch estimate', { status: 500 })
  }

  return Response.json(data || null)
}

export async function POST(req: Request) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return new Response('Unauthorized', { status: 403 })
  }

  const body = await req.json()
  const {
    projectId,
    paintscoutQuoteId,
    totalPrice,
    estimatedHours,
    crewCount,
    crewRatePerHour,
    materialCostEstimate,
    referralFee,
  } = body

  if (
    !projectId ||
    totalPrice === undefined ||
    totalPrice === null ||
    estimatedHours === undefined ||
    !crewCount ||
    crewRatePerHour === undefined ||
    crewRatePerHour === null
  ) {
    return new Response('Missing required fields', { status: 400 })
  }

  const adminClient = createAdminClient()

  // Verify project belongs to tenant
  const { data: project } = await adminClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!project) {
    return new Response('Project not found', { status: 404 })
  }

  // Upsert estimate
  const { data, error } = await adminClient
    .from('project_estimates')
    .upsert(
      {
        tenant_id: tenant.id,
        project_id: projectId,
        paintscout_quote_id: paintscoutQuoteId,
        total_price: totalPrice,
        estimated_hours: estimatedHours,
        crew_count: crewCount,
        crew_rate_per_hour: crewRatePerHour,
        material_cost_estimate: materialCostEstimate || 0,
        referral_fee: referralFee || null,
        created_by: appUser.id,
        updated_by: appUser.id,
      },
      { onConflict: 'project_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error saving estimate:', error)
    return new Response('Failed to save estimate', { status: 500 })
  }

  return Response.json(data)
}
