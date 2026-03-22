import { TooltipProvider } from '@/lib/tooltip-context'
import { I18nProvider } from '@/lib/i18n'

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </I18nProvider>
  )
}
