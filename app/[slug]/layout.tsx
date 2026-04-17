import { TooltipProvider } from '@/lib/tooltip-context'
import { I18nProvider } from '@/lib/i18n'
import { getImpersonation } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import ImpersonationBanner from '@/components/ImpersonationBanner'

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, impersonatingSubId } = await getImpersonation()

  let bannerLabel = ''
  if (isSuperAdmin && impersonatingSubId) {
    const adminClient = createAdminClient()
    const { data: sub } = await adminClient
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', impersonatingSubId)
      .single()
    if (sub) {
      bannerLabel = `${sub.first_name} ${sub.last_name} (${sub.email})`
    }
  }

  return (
    <I18nProvider>
      <TooltipProvider>
        {isSuperAdmin && impersonatingSubId && bannerLabel && (
          <ImpersonationBanner tenantName={bannerLabel} />
        )}
        {children}
      </TooltipProvider>
    </I18nProvider>
  )
}
