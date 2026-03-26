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
  notification_preferences: {
    project_invites: boolean
    project_updates: boolean
    project_accepted: boolean
    project_cancelled: boolean
  } | null
  created_at: string
}

export type NotificationPreferences = {
  project_invites: boolean
  project_updates: boolean
  project_accepted: boolean
  project_cancelled: boolean
  project_completion_requested: boolean
  project_completion_approved: boolean
  new_message: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  project_invites: true,
  project_updates: true,
  project_accepted: true,
  project_cancelled: true,
  project_completion_requested: true,
  project_completion_approved: true,
  new_message: true,
}

export function getNotificationPrefs(user: { notification_preferences: NotificationPreferences | null }): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...user.notification_preferences }
}

export type Tenant = {
  id: string
  name: string
  slug: string
  owner_user_id: string | null
  timezone: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: 'active' | 'suspended' | 'deleted'
  plan: 'free' | 'trial' | 'growth' | 'operator' | 'cancelled'
  trial_ends_at: string | null
  billing_email: string | null
  notification_email: string | null
  max_projects: number
  max_subcontractors: number
  created_at: string
}

// Check if a tenant has an active subscription or is within trial period
export function isTenantActive(tenant: Tenant): boolean {
  if (tenant.plan === 'free' || tenant.plan === 'growth' || tenant.plan === 'operator') return true
  if (tenant.plan === 'trial' && tenant.trial_ends_at) {
    return new Date(tenant.trial_ends_at) > new Date()
  }
  return false
}

// Plan limits lookup
export const PLAN_LIMITS: Record<string, { max_projects: number; max_subcontractors: number }> = {
  free: { max_projects: 5, max_subcontractors: 3 },
  growth: { max_projects: -1, max_subcontractors: -1 },
  operator: { max_projects: -1, max_subcontractors: -1 },
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
  status: 'available' | 'accepted' | 'in_progress' | 'pending_completion' | 'completed' | 'paid' | 'cancelled'
  companycam_link: string | null
  notes: string | null
  admin_notes: string | null
  accepted_by: string | null
  accepted_at: string | null
  paid_at: string | null
  completion_requested_by: string | null
  completion_requested_at: string | null
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
  avgRating: number | null
  totalJobs: number
}

export type SubRating = {
  id: string
  tenant_id: string
  project_id: string
  subcontractor_id: string
  rated_by: string
  rating: number
  note: string | null
  created_at: string
}

export type ProjectAttachment = {
  id: string
  tenant_id: string
  project_id: string
  file_name: string
  file_url: string
  file_size: number | null
  file_type: string | null
  uploaded_by: string
  created_at: string
}

export type JobMessage = {
  id: string
  tenant_id: string
  project_id: string
  sender_id: string
  body: string
  created_at: string
}

// Check if a tenant has Growth+ features (messaging, ratings, completion approval)
export function hasGrowthFeatures(tenant: Tenant): boolean {
  return tenant.plan === 'growth' || tenant.plan === 'operator'
}

export type ReliabilityStats = {
  totalInvited: number
  totalAccepted: number
  totalDeclined: number
  totalCompleted: number
  totalPaid: number
  totalCancelled: number
  acceptRate: number
  completionRate: number
}

// Helper to check if a sub is compliant (has current W-9 and non-expired COI)
export function isSubCompliant(sub: AppUser): boolean {
  const hasW9 = !!sub.w9_file_url
  const hasCoi = !!sub.coi_file_url
  const hasInsurance = !!sub.insurance_expiration
  const insuranceNotExpired = hasInsurance && new Date(sub.insurance_expiration!) >= new Date()
  return hasW9 && hasCoi && insuranceNotExpired
}
