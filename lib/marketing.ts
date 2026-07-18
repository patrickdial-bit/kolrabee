// Marketing engine helpers — Phase 1 (see docs/MARKETING_ENGINE_V1_SPEC.md).
//
// Lead scoring is deliberately deterministic and transparent: every point has
// a labeled reason the operator can read ("why did this lead score 82?").
// Model-assisted signals (radius check, property signals, engagement depth)
// come later; they add reasons to the same structure rather than replacing it.

export type LeadScoreInput = {
  phone?: string | null
  email?: string | null
  address?: string | null
  service_requested?: string | null
  message?: string | null
  /** Name matches a customer already in this tenant's job history. */
  isRepeatCustomer?: boolean
}

export type LeadScoreReason = { label: string; points: number }

export function scoreLead(input: LeadScoreInput): { score: number; reasons: LeadScoreReason[] } {
  const reasons: LeadScoreReason[] = [{ label: 'Base', points: 40 }]

  if (input.phone?.trim()) reasons.push({ label: 'Phone number provided', points: 20 })
  if (input.email?.trim()) reasons.push({ label: 'Email provided', points: 10 })
  if (input.address?.trim()) reasons.push({ label: 'Property address provided', points: 15 })
  if (input.service_requested?.trim()) reasons.push({ label: 'Named a specific service', points: 10 })
  if ((input.message?.trim().length ?? 0) >= 20) {
    reasons.push({ label: 'Described the job in detail', points: 5 })
  }
  if (input.isRepeatCustomer) reasons.push({ label: 'Existing customer match', points: 20 })

  const total = reasons.reduce((sum, r) => sum + r.points, 0)
  return { score: Math.min(100, total), reasons }
}
