import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_LIMITS } from '@/lib/types'

export async function POST() {
  try {
    const { appUser, tenant } = await getCurrentUser()

    if (appUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!tenant.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found.' }, { status: 400 })
    }

    // Cancel the subscription immediately
    await getStripe().subscriptions.cancel(tenant.stripe_subscription_id)

    // Downgrade to free plan immediately (don't wait for webhook)
    const freeLimits = PLAN_LIMITS.free
    const adminClient = createAdminClient()
    await adminClient
      .from('tenants')
      .update({
        plan: 'free',
        stripe_subscription_id: null,
        max_projects: freeLimits.max_projects,
        max_subcontractors: freeLimits.max_subcontractors,
      })
      .eq('id', tenant.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
