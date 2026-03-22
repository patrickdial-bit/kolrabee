import { NextRequest, NextResponse } from 'next/server'
import { getStripe, PLAN_PRICES } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanId } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json() as { plan: PlanId }

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const { appUser, tenant } = await getCurrentUser()

    if (appUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const adminClient = createAdminClient()

    // Create or reuse Stripe customer
    let customerId = tenant.stripe_customer_id
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: tenant.billing_email || appUser.email,
        name: tenant.name,
        metadata: { tenant_id: tenant.id },
      })
      customerId = customer.id

      // Save stripe_customer_id immediately
      await adminClient
        .from('tenants')
        .update({ stripe_customer_id: customerId })
        .eq('id', tenant.id)
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PLAN_PRICES[plan],
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/admin/billing?success=true`,
      cancel_url: `${siteUrl}/admin/billing?canceled=true`,
      metadata: {
        tenant_id: tenant.id,
        plan,
      },
      subscription_data: {
        metadata: {
          tenant_id: tenant.id,
          plan,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
