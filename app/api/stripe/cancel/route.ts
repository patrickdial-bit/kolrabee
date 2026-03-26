import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/helpers'

export async function POST() {
  try {
    const { appUser, tenant } = await getCurrentUser()

    if (appUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!tenant.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found.' }, { status: 400 })
    }

    // Cancel at period end — let them use what they paid for
    await getStripe().subscriptions.update(tenant.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    return NextResponse.json({ success: true, message: 'Subscription will cancel at end of billing period.' })
  } catch (error: any) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
