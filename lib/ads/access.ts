import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AppUser, Tenant, AdAddonSettings } from '@/lib/types'

export type AdsContext = {
  appUser: AppUser
  tenant: Tenant
  settings: AdAddonSettings
}

type Resolved = { authUser: any; appUser: AppUser; tenant: Tenant } | null

// Resolve the current API caller without redirecting (getCurrentUser in helpers.ts
// redirects, which is wrong for route handlers). Supports super-admin impersonation
// of a tenant the same way the page-level helper does.
export async function getApiUser(): Promise<Resolved> {
  return resolveUser()
}

async function resolveUser(): Promise<Resolved> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const adminClient = createAdminClient()

  // Super-admin impersonation via cookie.
  const { data: superAdmin } = await adminClient
    .from('super_admins')
    .select('id')
    .eq('supabase_auth_id', authUser.id)
    .maybeSingle()

  if (superAdmin) {
    const cookieStore = await cookies()
    const impersonatingTenantId = cookieStore.get('impersonate_tenant_id')?.value
    if (impersonatingTenantId) {
      const { data: tenant } = await adminClient
        .from('tenants')
        .select('*')
        .eq('id', impersonatingTenantId)
        .single()
      const { data: adminUser } = await adminClient
        .from('users')
        .select('*')
        .eq('tenant_id', impersonatingTenantId)
        .eq('role', 'admin')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      if (tenant && adminUser) {
        return { authUser, appUser: adminUser as AppUser, tenant: tenant as Tenant }
      }
    }
  }

  const { data: appUser } = await adminClient
    .from('users')
    .select('*')
    .eq('supabase_auth_id', authUser.id)
    .maybeSingle()
  if (!appUser || appUser.status === 'deleted') return null

  const { data: tenant } = await adminClient
    .from('tenants')
    .select('*')
    .eq('id', appUser.tenant_id)
    .single()
  if (!tenant) return null

  return { authUser, appUser: appUser as AppUser, tenant: tenant as Tenant }
}

// Ensure (or lazily create) the add-on settings row for a tenant.
export async function getAddonSettings(tenantId: string): Promise<AdAddonSettings> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('ad_addon_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (data) return resetMonthlyCounterIfNeeded(data as AdAddonSettings)

  const { data: created } = await adminClient
    .from('ad_addon_settings')
    .insert({ tenant_id: tenantId })
    .select('*')
    .single()
  return created as AdAddonSettings
}

// The runs_this_month counter resets on the 1st of each month. We reset lazily on
// read so we don't need a scheduled job for the prototype.
async function resetMonthlyCounterIfNeeded(settings: AdAddonSettings): Promise<AdAddonSettings> {
  const updated = new Date(settings.updated_at)
  const now = new Date()
  const sameMonth =
    updated.getUTCFullYear() === now.getUTCFullYear() &&
    updated.getUTCMonth() === now.getUTCMonth()
  if (sameMonth || settings.runs_this_month === 0) return settings

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('ad_addon_settings')
    .update({ runs_this_month: 0 })
    .eq('id', settings.id)
    .select('*')
    .single()
  return (data as AdAddonSettings) ?? { ...settings, runs_this_month: 0 }
}

export class AdsAccessError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Require an authenticated tenant user with the Ads Agent add-on enabled.
export async function requireAdsTenant(opts?: { adminOnly?: boolean }): Promise<AdsContext> {
  const resolved = await resolveUser()
  if (!resolved) throw new AdsAccessError(401, 'Not authenticated')

  if (opts?.adminOnly && resolved.appUser.role !== 'admin') {
    throw new AdsAccessError(403, 'Admin access required')
  }

  const settings = await getAddonSettings(resolved.tenant.id)
  if (!settings.enabled) {
    throw new AdsAccessError(403, 'Ads Agent is not enabled for this tenant')
  }

  return { appUser: resolved.appUser, tenant: resolved.tenant, settings }
}

// Require a platform super-admin (for the admin add-on management endpoints).
export async function requireSuperAdminApi(): Promise<{ authUser: any }> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) throw new AdsAccessError(401, 'Not authenticated')

  const adminClient = createAdminClient()
  const { data: superAdmin } = await adminClient
    .from('super_admins')
    .select('id')
    .eq('supabase_auth_id', authUser.id)
    .maybeSingle()
  if (!superAdmin) throw new AdsAccessError(403, 'Super-admin access required')

  return { authUser }
}
