import type { Metadata } from 'next'
import { getSharedView } from '@/lib/share-actions'
import SharedGallery from './SharedGallery'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Shared photos · Kolrabee',
  robots: { index: false, follow: false },
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const view = await getSharedView(params.token)

  if ('error' in view) {
    const msg =
      view.error === 'expired'
        ? 'This share link has expired.'
        : view.error === 'revoked'
          ? 'This share link has been turned off.'
          : 'This share link is invalid.'
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="font-display text-2xl font-black uppercase tracking-tight text-[#0D1B2A]">
            kol<span className="text-[#00A896]">ra</span>bee
          </div>
          <p className="mt-4 text-gray-600">{msg}</p>
        </div>
      </div>
    )
  }

  return <SharedGallery view={view} />
}
