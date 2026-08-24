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
    .from('project_ledger_entries')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching ledger entry:', error)
    return new Response('Failed to fetch ledger entry', { status: 500 })
  }

  return Response.json(data || null)
}

export async function POST(req: Request) {
  const { appUser, tenant } = await getCurrentUser()
  if (appUser.role !== 'admin') {
    return new Response('Unauthorized', { status: 403 })
  }

  const body = await req.json()
  const { projectId, actualMaterialCost, actualCrewHours, actualCrewPay, referralFee, notes } = body

  if (
    !projectId ||
    actualMaterialCost === undefined ||
    actualMaterialCost === null ||
    actualCrewHours === undefined ||
    actualCrewHours === null ||
    actualCrewPay === undefined ||
    actualCrewPay === null
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

  // Fetch estimate to get total_price
  const { data: estimate, error: estimateError } = await adminClient
    .from('project_estimates')
    .select('total_price')
    .eq('project_id', projectId)
    .single()

  if (estimateError || !estimate) {
    return new Response('Estimate not found for this project', { status: 404 })
  }

  // Upsert ledger entry
  const { data, error } = await adminClient
    .from('project_ledger_entries')
    .upsert(
      {
        tenant_id: tenant.id,
        project_id: projectId,
        total_price: estimate.total_price,
        actual_material_cost: actualMaterialCost,
        actual_crew_hours: actualCrewHours,
        actual_crew_pay: actualCrewPay,
        referral_fee: referralFee || null,
        notes: notes || null,
        created_by: appUser.id,
      },
      { onConflict: 'project_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error saving ledger entry:', error)
    return new Response('Failed to save ledger entry', { status: 500 })
  }

  return Response.json(data)
}
