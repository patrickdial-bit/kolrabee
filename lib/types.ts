export type AppUser = {
  id: string
  supabase_auth_id: string
  tenant_id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: 'admin' | 'subcontractor'
  status: 'active' | 'deleted'
  company_name: string | null
  crew_size: number | null
  address: string | null
  years_in_business: number | null
  insurance_provider: string | null
  insurance_expiration: string | null
  w9_file_url: string | null
  w9_uploaded_at: string | null
  coi_file_url: string | null
  coi_uploaded_at: string | null
  created_at: string
}

export type Tenant = {
  id: string
  name: string
  slug: string
  owner_user_id: string | null
  timezone: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: 'free' | 'trial' | 'starter' | 'pro' | 'cancelled'
  trial_ends_at: string | null
  billing_email: string | null
  max_projects: number
  max_subcontractors: number
  created_at: string
}

// Check if a tenant has an active subscription or is within trial period
export function isTenantActive(tenant: Tenant): boolean {
  if (tenant.plan === 'free' || tenant.plan === 'starter' || tenant.plan === 'pro') return true
  if (tenant.plan === 'trial' && tenant.trial_ends_at) {
    return new Date(tenant.trial_ends_at) > new Date()
  }
  return false
}

// Plan limits lookup
export const PLAN_LIMITS: Record<string, { max_projects: number; max_subcontractors: number }> = {
  free: { max_projects: 3, max_subcontractors: 1 },
  trial: { max_projects: 10, max_subcontractors: 5 },
  starter: { max_projects: 50, max_subcontractors: 20 },
  pro: { max_projects: 999999, max_subcontractors: 999999 },
}

export type Project = {
  id: string
  tenant_id: string
  created_by: string
  job_number: string | null
  customer_name: string
  address: string
  start_date: string | null
  start_time: string | null
  payout_amount: number
  estimated_labor_hours: number | null
  work_order_link: string | null
  status: 'available' | 'accepted' | 'completed' | 'paid' | 'cancelled'
  companycam_link: string | null
  notes: string | null
  admin_notes: string | null
  accepted_by: string | null
  accepted_at: string | null
  paid_at: string | null
  version: number
  created_at: string
}

export type ProjectInvitation = {
  id: string
  tenant_id: string
  project_id: string
  subcontractor_id: string
  status: 'invited' | 'accepted' | 'declined'
  invited_at: string
}

export type SubcontractorWithStats = AppUser & {
  ytdPaid: number
  activeJobs: number
}

// Helper to check if a sub is compliant (has current W-9 and non-expired COI)
export function isSubCompliant(sub: AppUser): boolean {
  const hasW9 = !!sub.w9_file_url
  const hasCoi = !!sub.coi_file_url
  const hasInsurance = !!sub.insurance_expiration
  const insuranceNotExpired = hasInsurance && new Date(sub.insurance_expiration!) >= new Date()
  return hasW9 && hasCoi && insuranceNotExpired
}
