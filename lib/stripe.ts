// Server-only Stripe configuration
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
  typescript: true,
})

// Plan price IDs — set these in your .env
export const PLAN_PRICES = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  pro: process.env.STRIPE_PRO_PRICE_ID!,
}

// Re-export client-safe plan data for server-side usage
export { ALL_PLANS, PLANS } from './plans'
export type { PlanId } from './plans'
