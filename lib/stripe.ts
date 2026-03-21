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

export const ALL_PLANS: Record<string, { name: string; price: number; features: string[] }> = {
  free: {
    name: 'Free',
    price: 0,
    features: [
      'Up to 3 projects',
      '1 subcontractor',
      '1 admin user',
    ],
  },
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

// Paid plans only (used for Stripe checkout)
export const PLANS: Record<PlanId, { name: string; price: number; features: string[] }> = {
  starter: ALL_PLANS.starter,
  pro: ALL_PLANS.pro,
}
