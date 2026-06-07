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
  project_change_order: boolean
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
  project_change_order: true,
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
  // 'imported' = CompanyCam documentation import; kept out of the dispatch
  // pipeline (no tab, not counted toward plan limits).
  status: 'available' | 'accepted' | 'in_progress' | 'pending_completion' | 'completed' | 'paid' | 'cancelled' | 'imported'
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
  drive_folder_id: string | null
  drive_folder_url: string | null
  last_backup_at: string | null
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

// Jobsite photos (Phase 1 photo module). Tags are an open-ended jsonb list so
// Phase 3 AI can write before/after tags + captions without a schema change.
export const PHOTO_TAGS = ['before', 'after', 'prep', 'damage', 'materials'] as const
export type PhotoTag = (typeof PHOTO_TAGS)[number]

export type Photo = {
  id: string
  tenant_id: string
  project_id: string
  uploaded_by: string
  storage_path: string
  thumb_path: string
  taken_at: string | null
  lat: number | null
  lng: number | null
  caption: string | null
  tags: string[]
  width: number | null
  height: number | null
  bytes: number | null
  created_at: string
}

// A photo enriched for gallery rendering: short-TTL signed thumbnail URL plus
// the uploader's display name. Full-size URLs are fetched on demand (lightbox).
export type PhotoWithUrl = Photo & {
  thumb_url: string | null
  uploader_name: string
}

// ---------------------------------------------------------------------------
// Normalized tags (Phase 2) — canonical, tenant-scoped vocabulary that powers
// the Tags dropdown and is the search spine for both Galleries and Photos.
// ---------------------------------------------------------------------------
export type Tag = {
  id: string
  tenant_id: string
  name: string
  color: string | null
  created_at: string
}

// Lightweight tag shape attached to a project/photo for chip rendering.
export type TagRef = {
  id: string
  name: string
  color: string | null
}

// A project as shown in the Galleries (documentation lens) list.
export type GalleryProject = {
  id: string
  customer_name: string
  address: string
  photo_count: number
  tags: TagRef[]
  recent_thumb_urls: string[] // up to 4 signed thumbnail URLs, newest first
  last_activity: string // ISO — latest photo time, falling back to project created_at
}

// A photo as shown in the All Photos grid / per-project lens. The jsonb `tags`
// string[] is replaced by the normalized TagRef[] (photo_tags).
export type PhotoListItem = Omit<PhotoWithUrl, 'tags'> & {
  project_name: string
  tags: TagRef[]
}

// A change order — a dated, attributed adjustment to a project's scope and pay.
// `amount` is the signed delta; `new_payout` is the project's resulting total.
export type ChangeOrder = {
  id: string
  tenant_id: string
  project_id: string
  amount: number
  description: string
  previous_payout: number
  new_payout: number
  created_by: string
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

// Primary display name for a subcontractor. Subcontractors represent the
// business they operate as, so we lead with the company name and fall back to
// their personal name only when no company is on file. Used everywhere a sub is
// named to an admin: lists, dropdowns, search, project assignments, etc.
export function subDisplayName(
  sub: { company_name?: string | null; first_name?: string | null; last_name?: string | null }
): string {
  const company = sub.company_name?.trim()
  if (company) return company
  const personal = `${sub.first_name ?? ''} ${sub.last_name ?? ''}`.trim()
  return personal || 'Unknown'
}

// Personal (contact) name for a subcontractor — first + last. Use as a
// secondary line alongside subDisplayName, or where a human contact is meant.
export function subPersonName(
  sub: { first_name?: string | null; last_name?: string | null }
): string {
  return `${sub.first_name ?? ''} ${sub.last_name ?? ''}`.trim()
}

// Helper to check if a sub is compliant (has current W-9 and non-expired COI)
export function isSubCompliant(sub: AppUser): boolean {
  const hasW9 = !!sub.w9_file_url
  const hasCoi = !!sub.coi_file_url
  const hasInsurance = !!sub.insurance_expiration
  const insuranceNotExpired = hasInsurance && new Date(sub.insurance_expiration!) >= new Date()
  return hasW9 && hasCoi && insuranceNotExpired
}
