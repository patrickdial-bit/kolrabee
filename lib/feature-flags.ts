// ---------------------------------------------------------------------------
// Feature flags — global, deploy-level kill switches.
//
// These sit ABOVE the per-tenant flags in the database. A per-tenant flag says
// "this company is allowed to use X"; a flag here says "X is part of the
// product right now at all". Both must be on for a feature to appear.
//
// Client-safe: no server-only imports, and every switch is read from a
// NEXT_PUBLIC_ env var so the same answer is reached on the server and in the
// browser (a mismatch would hydrate the nav twice with different items).
// ---------------------------------------------------------------------------

/**
 * Marketing Engine — Leads, Prospects and Market Intel.
 *
 * Parked while the product focuses on its core job: dispatching subcontractors
 * to jobs. The routes, server actions and tables all still exist; they are
 * simply unreachable from the UI and refuse to render. Set
 * NEXT_PUBLIC_MARKETING_ENGINE=on to bring the module back, then flip
 * tenants.marketing_enabled for the companies that should see it.
 */
export const MARKETING_ENGINE_ENABLED =
  process.env.NEXT_PUBLIC_MARKETING_ENGINE === 'on'
