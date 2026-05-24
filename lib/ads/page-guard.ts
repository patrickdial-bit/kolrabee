import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/helpers'
import { getAddonSettings } from '@/lib/ads/access'
import type { AppUser, Tenant, AdAddonSettings } from '@/lib/types'

// Server-side gate for /admin/ads/* pages. getCurrentUser() enforces auth +
// admin role; we additionally require the add-on to be enabled for the tenant.
export async function requireAdsPage(): Promise<{
  appUser: AppUser
  tenant: Tenant
  settings: AdAddonSettings
}> {
  const { appUser, tenant } = await getCurrentUser()
  const settings = await getAddonSettings(tenant.id)
  if (!settings.enabled) redirect('/admin/dashboard')
  return { appUser, tenant, settings }
}
