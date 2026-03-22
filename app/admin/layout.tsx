import { getImpersonation } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { TooltipProvider } from '@/lib/tooltip-context'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSuperAdmin, impersonatingTenantId } = await getImpersonation()

  let tenantName = ''
  if (isSuperAdmin && impersonatingTenantId) {
    const adminClient = createAdminClient()
    const { data: tenant } = await adminClient
      .from('tenants')
      .select('name')
      .eq('id', impersonatingTenantId)
      .single()
    tenantName = tenant?.name ?? ''
  }

  return (
    <TooltipProvider>
      {isSuperAdmin && impersonatingTenantId && (
        <ImpersonationBanner tenantName={tenantName} />
      )}
      {children}
    </TooltipProvider>
  )
}
