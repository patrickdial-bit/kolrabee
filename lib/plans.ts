// Client-safe plan configuration (no server-only imports)

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
