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

// Prospect conversion-likelihood score — deterministic and explainable, so
// mail spend concentrates on the best parcels instead of blanketing the list.
export function scoreProspect(input: {
  owner_occupied?: boolean | null
  year_built?: number | null
  assessed_value?: number | null
  lot_acres?: number | null
  last_sale_date?: string | null
}): { score: number; reasons: LeadScoreReason[] } {
  const reasons: LeadScoreReason[] = [{ label: 'Base', points: 30 }]
  const nowYear = new Date().getFullYear()

  if (input.owner_occupied) reasons.push({ label: 'Owner-occupied', points: 25 })
  if (input.year_built != null) {
    const age = nowYear - input.year_built
    if (age >= 15 && age <= 60) reasons.push({ label: `Home age ${age}y — exterior renewal window`, points: 15 })
    else if (age > 60) reasons.push({ label: `Home age ${age}y`, points: 5 })
  }
  if (input.assessed_value != null && input.assessed_value >= 200000) {
    reasons.push({ label: 'Assessed value ≥ $200k', points: 10 })
  }
  if (input.lot_acres != null && input.lot_acres >= 0.25) {
    reasons.push({ label: 'Lot ≥ ¼ acre — landscape/hardscape opportunity', points: 10 })
  }
  if (input.last_sale_date) {
    const yearsSinceSale = (Date.now() - new Date(input.last_sale_date).getTime()) / (365 * 24 * 3600 * 1000)
    if (yearsSinceSale <= 2) reasons.push({ label: 'Purchased within 2 years — new-owner spend window', points: 10 })
  }

  const total = reasons.reduce((sum, r) => sum + r.points, 0)
  return { score: Math.min(100, total), reasons }
}

// Competitor prominence score — transparent inputs, no black box.
export function scoreCompetitor(input: {
  rating?: number | null
  review_count?: number | null
  ad_activity?: boolean
  website?: string | null
}): { score: number; reasons: LeadScoreReason[] } {
  const reasons: LeadScoreReason[] = []
  const reviews = input.review_count ?? 0
  if (reviews >= 200) reasons.push({ label: `${reviews} reviews`, points: 35 })
  else if (reviews >= 50) reasons.push({ label: `${reviews} reviews`, points: 25 })
  else if (reviews > 0) reasons.push({ label: `${reviews} reviews`, points: 10 })
  if (input.rating != null && input.rating >= 4.5) reasons.push({ label: `${input.rating}★ rating`, points: 20 })
  else if (input.rating != null && input.rating >= 4.0) reasons.push({ label: `${input.rating}★ rating`, points: 10 })
  if (input.ad_activity) reasons.push({ label: 'Actively advertising', points: 30 })
  if (input.website) reasons.push({ label: 'Has website', points: 5 })
  const total = reasons.reduce((sum, r) => sum + r.points, 0)
  return { score: Math.min(100, total), reasons }
}

// Budget → projected results, grounded in benchmark CPL with the assumptions
// stated (never an unlabeled promise).
export function projectCampaignResults(params: {
  monthlyBudget: number
  cplLow: number
  cplHigh: number
}): { leadsLow: number; leadsHigh: number; assumptions: string } {
  const leadsLow = params.cplHigh > 0 ? Math.floor(params.monthlyBudget / params.cplHigh) : 0
  const leadsHigh = params.cplLow > 0 ? Math.floor(params.monthlyBudget / params.cplLow) : 0
  return {
    leadsLow,
    leadsHigh,
    assumptions: `Assumes published CPL range $${params.cplLow}–$${params.cplHigh}; actuals depend on creative, offer, and seasonality. Projection is checked against real results as campaigns run.`,
  }
}
