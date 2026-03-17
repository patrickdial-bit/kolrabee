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

export type PlanId = 'starter' | 'pro'

export const PLANS: Record<PlanId, { name: string; price: number; features: string[] }> = {
  starter: {
    name: 'Starter',
    price: 49,
    features: [
      'Up to 50 projects',
      'Up to 20 subcontractors',
      'Email notifications',
      'Document management',
    ],
  },
  pro: {
    name: 'Pro',
    price: 99,
    features: [
      'Unlimited projects',
      'Unlimited subcontractors',
      'Email notifications',
      'Document management',
      'Priority support',
    ],
  },
}
