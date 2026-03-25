// Client-safe plan configuration (no server-only imports)

export type PlanId = 'growth' | 'operator'

export const ALL_PLANS: Record<string, { name: string; price: number; features: string[] }> = {
  free: {
    name: 'Free',
    price: 0,
    features: [
      'Up to 3 projects',
      '3 subcontractors',
      '1 admin user',
    ],
  },
  growth: {
    name: 'Growth',
    price: 29,
    features: [
      'Unlimited projects',
      'Unlimited subcontractors',
      'In-app job messaging',
      'Sub ratings & performance scores',
      'Job completion approval',
      'File attachments on jobs',
      'Priority support',
    ],
  },
  operator: {
    name: 'Operator',
    price: 49,
    features: [
      'Everything in Growth',
      'Up to 5 company workspaces',
      'Consolidated owner dashboard',
      'Dedicated onboarding support',
      'Early access to new features',
    ],
  },
}

// Paid plans only (used for Stripe checkout)
export const PLANS: Record<PlanId, { name: string; price: number; features: string[] }> = {
  growth: ALL_PLANS.growth,
  operator: ALL_PLANS.operator,
}
