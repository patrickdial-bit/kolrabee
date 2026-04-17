import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { AppUser, Tenant } from '@/lib/types'

export type { AppUser, Tenant } from '@/lib/types'
export type { Project, ProjectInvitation } from '@/lib/types'

// Check if the current user is a super admin impersonating a tenant or subcontractor
export async function getImpersonation(): Promise<{
  isSuperAdmin: boolean
  impersonatingTenantId: string | null
  impersonatingSubId: string | null
}> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { isSuperAdmin: false, impersonatingTenantId: null, impersonatingSubId: null }

  const adminClient = createAdminClient()
  const { data: superAdmin } = await adminClient
    .from('super_admins')
    .select('id')
    .eq('supabase_auth_id', authUser.id)
    .single()

  if (!superAdmin) return { isSuperAdmin: false, impersonatingTenantId: null, impersonatingSubId: null }

  const cookieStore = await cookies()
  const impersonatingTenantId = cookieStore.get('impersonate_tenant_id')?.value || null
  const impersonatingSubId = cookieStore.get('impersonate_sub_id')?.value || null

  return { isSuperAdmin: true, impersonatingTenantId, impersonatingSubId }
}

// Get the current authenticated user and their app user record
export async function getCurrentUser(): Promise<{ authUser: any; appUser: AppUser; tenant: Tenant; impersonating?: boolean }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/admin/login')
  }

  const adminClient = createAdminClient()

  // Check for super admin impersonation
  const { isSuperAdmin, impersonatingTenantId } = await getImpersonation()

  if (isSuperAdmin && impersonatingTenantId) {
    // Load the impersonated tenant
    const { data: tenant } = await adminClient
      .from('tenants')
      .select('*')
      .eq('id', impersonatingTenantId)
      .single()

    if (!tenant) {
      redirect('/super-admin')
    }

    // Get the tenant's admin user to impersonate
    const { data: adminUser } = await adminClient
      .from('users')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('role', 'admin')
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!adminUser) {
      redirect('/super-admin')
    }

    return { authUser, appUser: adminUser as AppUser, tenant: tenant as Tenant, impersonating: true }
  }

  const { data: appUser, error } = await adminClient
    .from('users')
    .select('*')
    .eq('supabase_auth_id', authUser.id)
    .single()

  if (error || !appUser) {
    redirect('/admin/login')
  }

  const { data: tenant } = await adminClient
    .from('tenants')
    .select('*')
    .eq('id', appUser.tenant_id)
    .single()

  if (!tenant) {
    redirect('/admin/login')
  }

  if (tenant.status === 'suspended' || tenant.status === 'deleted') {
    const supabase2 = await createClient()
    await supabase2.auth.signOut()
    redirect('/admin/login?error=suspended')
  }

  // Ensure only admins can access admin routes
  if (appUser.role !== 'admin') {
    redirect('/admin/login')
  }

  return { authUser, appUser: appUser as AppUser, tenant: tenant as Tenant }
}

// Get current sub user with tenant info
export async function getCurrentSub(slug: string): Promise<{ authUser: any; appUser: AppUser; tenant: Tenant; impersonating?: boolean }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect(`/${slug}/login`)
  }

  const adminClient = createAdminClient()

  const { data: tenant } = await adminClient
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!tenant) {
    redirect('/')
  }

  if (tenant.status === 'suspended' || tenant.status === 'deleted') {
    await supabase.auth.signOut()
    redirect(`/${slug}/login?error=suspended`)
  }

  // Super admin impersonating a subcontractor: load the sub by ID
  const { isSuperAdmin, impersonatingSubId } = await getImpersonation()
  if (isSuperAdmin && impersonatingSubId) {
    const { data: impersonatedSub } = await adminClient
      .from('users')
      .select('*')
      .eq('id', impersonatingSubId)
      .eq('tenant_id', tenant.id)
      .eq('role', 'subcontractor')
      .single()

    if (impersonatedSub && impersonatedSub.status !== 'deleted') {
      return { authUser, appUser: impersonatedSub as AppUser, tenant: tenant as Tenant, impersonating: true }
    }
  }

  const { data: appUser } = await adminClient
    .from('users')
    .select('*')
    .eq('supabase_auth_id', authUser.id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!appUser || appUser.status === 'deleted') {
    await supabase.auth.signOut()
    redirect(`/${slug}/login`)
  }

  return { authUser, appUser: appUser as AppUser, tenant: tenant as Tenant }
}

// Check if the current authenticated user is a super admin
export async function requireSuperAdmin(): Promise<{ authUser: any }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/admin/login')
  }

  const adminClient = createAdminClient()
  const { data: superAdmin } = await adminClient
    .from('super_admins')
    .select('id')
    .eq('supabase_auth_id', authUser.id)
    .single()

  if (!superAdmin) {
    redirect('/admin/login')
  }

  return { authUser }
}

// Normalize a URL: prepend https:// if no protocol is present
export function normalizeUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

// Extract city from full address
export function extractCity(address: string): string {
  const parts = address.split(',').map(p => p.trim())
  if (parts.length >= 2) {
    return parts[1].replace(/\s+\w{2}\s+\d{5}(-\d{4})?$/, '').trim()
  }
  return address
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// Format date
export function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
