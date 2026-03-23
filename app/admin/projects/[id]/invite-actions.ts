'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, extractCity } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSubCompliant, isTenantActive, getNotificationPrefs } from '@/lib/types'
import { sendInviteEmail } from '@/lib/email'
import type { AppUser, Project } from '@/lib/types'

export async function getSubcontractors(tenantId: string) {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('role', 'subcontractor')
    .eq('status', 'active')
    .order('first_name', { ascending: true })

  if (error) {
    return { error: 'Failed to fetch subcontractors.', data: [] }
  }

  const subs = (data ?? []).map((s: AppUser) => ({
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    email: s.email,
    company_name: s.company_name,
    compliant: isSubCompliant(s),
  }))

  return { data: subs }
}

export async function sendInvitations(projectId: string, subcontractorIds: string[], expiresInDays: number = 7) {
  if (!subcontractorIds.length) {
    return { error: 'No subcontractors selected.' }
  }

  const { tenant } = await getCurrentUser()

  // Plan enforcement
  if (!isTenantActive(tenant)) {
    return { error: 'Your trial has expired. Please subscribe to a plan.' }
  }

  const adminClient = createAdminClient()

  // Verify all selected subs are compliant
  const { data: subs } = await adminClient
    .from('users')
    .select('*')
    .in('id', subcontractorIds)
    .eq('tenant_id', tenant.id)
    .eq('role', 'subcontractor')
    .eq('status', 'active')

  const nonCompliant = (subs ?? []).filter((s: AppUser) => !isSubCompliant(s))
  if (nonCompliant.length > 0) {
    const names = nonCompliant.map((s: AppUser) => `${s.first_name} ${s.last_name}`).join(', ')
    return { error: `Cannot invite: ${names} — missing W-9, COI, or insurance is expired.` }
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiresInDays * 86400000).toISOString()

  const rows = subcontractorIds.map((subId) => ({
    tenant_id: tenant.id,
    project_id: projectId,
    subcontractor_id: subId,
    status: 'invited' as const,
    invited_at: now.toISOString(),
    expires_at: expiresAt,
  }))

  const { error } = await adminClient
    .from('project_invitations')
    .upsert(rows, {
      onConflict: 'project_id,subcontractor_id',
      ignoreDuplicates: true,
    })

  if (error) {
    return { error: 'Failed to send invitations.' }
  }

  // Fetch project details for the email
  const { data: project } = await adminClient
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  // Send invitation emails (fire-and-forget — don't block on email failures)
  if (project && subs) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`
    const loginUrl = `${siteUrl}/${tenant.slug}/login`
    const city = extractCity(project.address)

    for (const sub of subs.filter((s: AppUser) => subcontractorIds.includes(s.id))) {
      const prefs = getNotificationPrefs(sub)
      if (!prefs.project_invites) continue
      sendInviteEmail({
        to: sub.email,
        subName: sub.first_name,
        tenantName: tenant.name,
        notificationEmail: tenant.notification_email,
        jobNumber: project.job_number,
        customerName: project.customer_name,
        city,
        startDate: project.start_date,
        payout: project.payout_amount,
        loginUrl,
      })
    }
  }

  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/admin/dashboard')
  return { success: true }
}
