'use server'

import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const { appUser, tenant } = await getCurrentUser({ roles: ['admin', 'estimator'] })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return new Response('Missing projectId', { status: 400 })
  }

  // Project-scoped reads are an admin surface.
  if (appUser.role !== 'admin') {
    return new Response('Unauthorized', { status: 403 })
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
  const { appUser, tenant } = await getCurrentUser({ roles: ['admin', 'estimator'] })

  const body = await req.json()
  const {
    estimateId,
    projectId,
    customerName,
    customerAddress,
    paintscoutQuoteId,
    totalPrice,
    estimatedHours,
    crewCount,
    crewRatePerHour,
    materialCostEstimate,
    referralFee,
  } = body

  if (
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

  const sharedFields = {
    paintscout_quote_id: paintscoutQuoteId,
    total_price: totalPrice,
    estimated_hours: estimatedHours,
    crew_count: crewCount,
    crew_rate_per_hour: crewRatePerHour,
    material_cost_estimate: materialCostEstimate || 0,
    referral_fee: referralFee || null,
    updated_by: appUser.id,
  }

  // Update an existing quote by id. Estimators may only touch their own.
  if (estimateId) {
    let query = adminClient
      .from('project_estimates')
      .update({
        ...sharedFields,
        customer_name: customerName ?? undefined,
        customer_address: customerAddress ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', estimateId)
      .eq('tenant_id', tenant.id)
    if (appUser.role === 'estimator') {
      query = query.eq('created_by', appUser.id)
    }
    const { data, error } = await query.select().single()
    if (error || !data) {
      console.error('Error updating estimate:', error)
      return new Response('Failed to update estimate', { status: error?.code === 'PGRST116' ? 404 : 500 })
    }
    return Response.json(data)
  }

  // Upsert against a project (admin surface on the project detail page).
  if (projectId) {
    if (appUser.role !== 'admin') {
      return new Response('Unauthorized', { status: 403 })
    }

    const { data: project } = await adminClient
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('tenant_id', tenant.id)
      .single()

    if (!project) {
      return new Response('Project not found', { status: 404 })
    }

    // Update-then-insert instead of upsert: an existing row may be a linked
    // estimator quote, and overwriting created_by would silently take it out
    // of that estimator's list.
    const { data: existingRow } = await adminClient
      .from('project_estimates')
      .select('id')
      .eq('project_id', projectId)
      .maybeSingle()

    const { data, error } = existingRow
      ? await adminClient
          .from('project_estimates')
          .update({ ...sharedFields, updated_at: new Date().toISOString() })
          .eq('id', existingRow.id)
          .select()
          .single()
      : await adminClient
          .from('project_estimates')
          .insert({
            tenant_id: tenant.id,
            project_id: projectId,
            ...sharedFields,
            created_by: appUser.id,
          })
          .select()
          .single()

    if (error) {
      console.error('Error saving estimate:', error)
      return new Response('Failed to save estimate', { status: 500 })
    }
    return Response.json(data)
  }

  // Standalone quote — no project yet, just a customer. This is the
  // estimator's pre-contract workflow.
  if (!customerName || !customerName.trim()) {
    return new Response('Customer name is required for a quote', { status: 400 })
  }

  const { data, error } = await adminClient
    .from('project_estimates')
    .insert({
      tenant_id: tenant.id,
      customer_name: customerName.trim(),
      customer_address: customerAddress?.trim() || null,
      ...sharedFields,
      created_by: appUser.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating quote:', error)
    return new Response('Failed to create quote', { status: 500 })
  }

  return Response.json(data)
}
