import { TooltipProvider } from '@/lib/tooltip-context'

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}
