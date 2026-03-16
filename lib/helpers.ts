import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export type AppUser = {
  id: string
  supabase_auth_id: string
  tenant_id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: 'admin' | 'subcontractor'
  status: 'active' | 'deleted'
  created_at: string
}

export type Tenant = {
  id: string
  name: string
  slug: string
  owner_user_id: string | null
  timezone: string
  created_at: string
}

export type Project = {
  id: string
  tenant_id: string
  created_by: string
  job_number: string | null
  customer_name: string
  address: string
  start_date: string | null
  payout_amount: number
  status: 'available' | 'accepted' | 'completed' | 'paid' | 'cancelled'
  companycam_link: string | null
  notes: string | null
  admin_notes: string | null
  accepted_by: string | null
  accepted_at: string | null
  paid_at: string | null
  version: number
  created_at: string
}

export type ProjectInvitation = {
  id: string
  tenant_id: string
  project_id: string
  subcontractor_id: string
  status: 'invited' | 'accepted' | 'declined'
  invited_at: string
}

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
  // Try to get city from typical US address format: "123 Main St, City, ST 12345"
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
