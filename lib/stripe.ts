// Server-only Stripe configuration
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    })
  }
  return _stripe
}

// Plan price IDs — set these in your .env
export const PLAN_PRICES = {
  growth: process.env.STRIPE_GROWTH_PRICE_ID!,
  operator: process.env.STRIPE_OPERATOR_PRICE_ID!,
}

// Re-export client-safe plan data for server-side usage
export { ALL_PLANS, PLANS } from './plans'
export type { PlanId } from './plans'
