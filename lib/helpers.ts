import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { AppUser, Tenant } from '@/lib/types'

export type { AppUser, Tenant } from '@/lib/types'
export type { Project, ProjectInvitation } from '@/lib/types'

// Get the current authenticated user and their app user record
export async function getCurrentUser(): Promise<{ authUser: any; appUser: AppUser; tenant: Tenant }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/admin/login')
  }

  const adminClient = createAdminClient()
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

  return { authUser, appUser: appUser as AppUser, tenant: tenant as Tenant }
}

// Get current sub user with tenant info
export async function getCurrentSub(slug: string): Promise<{ authUser: any; appUser: AppUser; tenant: Tenant }> {
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
