'use client'

import { stopImpersonation } from '@/app/super-admin/impersonate/actions'
import { useTransition } from 'react'

export default function ImpersonationBanner({ tenantName }: { tenantName: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="bg-amber-500 text-black px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-3">
      <span>Viewing as: {tenantName}</span>
      <button
        onClick={() => startTransition(() => stopImpersonation())}
        disabled={isPending}
        className="rounded bg-black/20 px-3 py-1 text-xs font-bold text-black hover:bg-black/30 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Exiting...' : 'Back to Super Admin'}
      </button>
    </div>
  )
}
