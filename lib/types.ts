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
  is_crew_leader: boolean
  created_at: string
}

export type CrewMember = {
  id: string
  tenant_id: string
  crew_leader_id: string
  first_name: string
  last_name: string
  phone: string | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export function isCrewLeader(user: Pick<AppUser, 'role' | 'is_crew_leader'>): boolean {
  return user.role === 'subcontractor' && user.is_crew_leader === true
}

export type NotificationPreferences = {
  project_invites: boolean
  project_updates: boolean
  project_accepted: boolean
  project_cancelled: boolean
  project_completion_requested: boolean
  project_completion_approved: boolean
  project_rescheduled: boolean
  new_message: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  project_invites: true,
  project_updates: true,
  project_accepted: true,
  project_cancelled: true,
  project_completion_requested: true,
  project_completion_approved: true,
  project_rescheduled: true,
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
  schedule_changed_at: string | null
  previous_start_date: string | null
  previous_start_time: string | null
  schedule_change_acknowledged_at: string | null
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
  timeClockEnabled?: boolean
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

// Time-clock tracking is a Growth+ feature.
export function hasTimeTracking(tenant: Tenant): boolean {
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

// =============================================================================
// Ads Agent (creative-generation add-on)
// =============================================================================

export type AdComplianceStatus = 'testing_only' | 'cleared_for_paid'

export type AdAddonSettings = {
  id: string
  tenant_id: string
  enabled: boolean
  enabled_at: string | null
  enabled_by: string | null
  compliance_status: AdComplianceStatus
  monthly_run_limit: number
  runs_this_month: number
  created_at: string
  updated_at: string
}

export type AdSeedImageSource = {
  url: string
  source: 'scraped' | 'uploaded'
  original_url?: string
  uploaded_at: string
}

export type AdBrandKit = {
  id: string
  tenant_id: string
  brand_name: string
  service_line: string
  brand_website_url: string | null
  primary_color_hex: string
  secondary_color_hex: string
  accent_color_hex: string | null
  font_family: string
  brand_voice: string
  value_props: string[]
  target_geo: string
  target_audience: string
  seed_image_urls: string[]
  seed_image_sources: AdSeedImageSource[]
  logo_url: string | null
  competitor_page_urls: string[]
  created_at: string
  updated_at: string
}

export type AdRunStatus =
  | 'queued'
  | 'scraping'
  | 'synthesizing'
  | 'generating_images'
  | 'writing_copy'
  | 'ready_for_review'
  | 'failed'

// Ordered pipeline steps for rendering a progress indicator.
export const AD_RUN_STEPS: { status: AdRunStatus; label: string }[] = [
  { status: 'scraping', label: 'Researching competitors' },
  { status: 'synthesizing', label: 'Synthesizing ad angles' },
  { status: 'generating_images', label: 'Generating imagery' },
  { status: 'writing_copy', label: 'Writing ad copy' },
  { status: 'ready_for_review', label: 'Ready for review' },
]

export type AdAngle = {
  name: string
  hook: string
  emotional_driver: 'price' | 'speed' | 'trust' | 'quality' | 'transformation'
  visual_direction: string
}

export type AdGenerationRun = {
  id: string
  tenant_id: string
  brand_kit_id: string | null
  status: AdRunStatus
  error_message: string | null
  triggered_by: string | null
  competitor_scrape_summary: unknown | null
  synthesized_angles: AdAngle[] | null
  total_cost_cents: number
  concepts_generated: number
  concepts_approved: number
  concepts_exported: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export type AdVariantType = 'lifestyle' | 'studio' | 'testimonial_style' | 'before_after'

export const AD_VARIANT_TYPES: AdVariantType[] = [
  'lifestyle',
  'studio',
  'testimonial_style',
  'before_after',
]

export const AD_VARIANT_LABELS: Record<AdVariantType, string> = {
  lifestyle: 'Lifestyle',
  studio: 'Studio',
  testimonial_style: 'Testimonial',
  before_after: 'Before / After',
}

export type AdConceptStatus = 'draft' | 'approved' | 'rejected'

export type AdConcept = {
  id: string
  tenant_id: string
  run_id: string
  angle: string
  variant_index: number
  variant_type: AdVariantType
  headline: string
  primary_text: string
  image_url: string | null
  image_prompt: string
  status: AdConceptStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

// Meta ad copy limits used for client-side validation hints.
export const AD_HEADLINE_MAX = 40
export const AD_PRIMARY_TEXT_MAX = 125

// Helper to check if a sub is compliant (has current W-9 and non-expired COI)
export function isSubCompliant(sub: AppUser): boolean {
  const hasW9 = !!sub.w9_file_url
  const hasCoi = !!sub.coi_file_url
  const hasInsurance = !!sub.insurance_expiration
  const insuranceNotExpired = hasInsurance && new Date(sub.insurance_expiration!) >= new Date()
  return hasW9 && hasCoi && insuranceNotExpired
}
