import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_LIMITS } from '@/lib/types'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const tenantId = session.metadata?.tenant_id
      const plan = (session.metadata?.plan as string) || 'starter'
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter

      if (tenantId && session.subscription) {
        await adminClient
          .from('tenants')
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            plan,
            max_projects: limits.max_projects,
            max_subcontractors: limits.max_subcontractors,
          })
          .eq('id', tenantId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      if (subscription.status === 'active') {
        // Subscription is active — determine plan from metadata
        const plan = subscription.metadata?.plan || 'starter'
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter

        await adminClient
          .from('tenants')
          .update({
            plan,
            max_projects: limits.max_projects,
            max_subcontractors: limits.max_subcontractors,
          })
          .eq('stripe_customer_id', customerId)
      } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
        // Keep current plan but it will be checked via isTenantActive
        // No change needed — they still have a subscription, just payment issues
      }

      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      await adminClient
        .from('tenants')
        .update({
          plan: 'cancelled',
          stripe_subscription_id: null,
          max_projects: 0,
          max_subcontractors: 0,
        })
        .eq('stripe_customer_id', customerId)

      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      // Log payment failure — plan stays active until subscription is actually deleted
      console.warn(`Payment failed for customer ${customerId}`)
      break
    }
  }

  return NextResponse.json({ received: true })
}
