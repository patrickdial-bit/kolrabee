import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/helpers'

export async function POST() {
  try {
    const { appUser, tenant } = await getCurrentUser()

    if (appUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!tenant.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const session = await getStripe().billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: `${siteUrl}/admin/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Portal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
