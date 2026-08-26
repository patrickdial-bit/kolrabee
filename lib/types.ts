import { MARKETING_ENGINE_ENABLED } from '@/lib/feature-flags'

// 'inactive' takes a subcontractor off the roster without deleting them: their
// profile, documents and job history are kept, but they are excluded from
// dispatch lists so they can't be sent a job invite. Reversible at any time.
export type UserStatus = 'active' | 'inactive' | 'deleted'

export type AppUser = {
  id: string
  supabase_auth_id: string
  tenant_id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: 'admin' | 'subcontractor' | 'estimator'
  status: UserStatus
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

// Only active subs appear in dispatch lists and may be sent job invites.
export function canReceiveInvites(user: Pick<AppUser, 'role' | 'status'>): boolean {
  return user.role === 'subcontractor' && user.status === 'active'
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  deleted: 'Deleted',
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
  daily_hours_summary: boolean
  new_lead: boolean
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
  daily_hours_summary: true,
  new_lead: true,
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
  // Home market, e.g. "Columbus, OH" — geocoding hint for zip-less addresses
  // and the map fallback area for jobs that can't be pinpointed.
  service_area: string | null
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
  // 'door_to_door' jobs pay hourly (hourly_rate × clocked hours) instead of
  // the fixed payout_amount; reps log door outcomes against them.
  project_type: 'standard' | 'door_to_door'
  hourly_rate: number | null
  // Customer-side revenue on the job (what the customer pays the tenant).
  // Counted as collected by marketing attribution once status is 'paid'.
  revenue_amount: number | null
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
  latitude: number | null
  longitude: number | null
  geocoded_at: string | null
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

// ---------------------------------------------------------------------------
// Marketing engine (Phase 1) — see docs/MARKETING_ENGINE_V1_SPEC.md
// ---------------------------------------------------------------------------

export type MkCampaign = {
  id: string
  tenant_id: string
  name: string
  channel: 'meta' | 'google' | 'other'
  status: 'draft' | 'active' | 'paused' | 'ended'
  monthly_budget: number | null
  spend_to_date: number
  utm_campaign: string | null
  external_campaign_id: string | null
  created_at: string
  updated_at: string
}

export type MkLeadSource =
  | 'landing_form'
  | 'meta_lead_form'
  | 'google'
  | 'sms'
  | 'call'
  | 'chat'
  | 'referral'
  | 'manual'

export type MkLeadStatus = 'new' | 'contacted' | 'qualified' | 'booked' | 'lost'

export type MkLead = {
  id: string
  tenant_id: string
  campaign_id: string | null
  source: MkLeadSource
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  service_requested: string | null
  message: string | null
  fbclid: string | null
  gclid: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  score: number | null
  score_reasons: Array<{ label: string; points: number }> | null
  status: MkLeadStatus
  project_id: string | null
  created_at: string
  updated_at: string
}

export type MkLeadEvent = {
  id: string
  tenant_id: string
  lead_id: string
  event_type: string
  detail: string | null
  created_by: string | null
  created_at: string
}

export const MK_LEAD_STATUS_LABELS: Record<MkLeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  booked: 'Booked',
  lost: 'Lost',
}

export const MK_LEAD_SOURCE_LABELS: Record<MkLeadSource, string> = {
  landing_form: 'Landing page',
  meta_lead_form: 'Meta lead form',
  google: 'Google',
  sms: 'SMS',
  call: 'Phone call',
  chat: 'Chat',
  referral: 'Referral',
  manual: 'Manual',
}

export function mkLeadName(lead: Pick<MkLead, 'first_name' | 'last_name'>): string {
  return `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'Unknown'
}

export type DoorKnockOutcome =
  | 'not_home'
  | 'not_interested'
  | 'callback'
  | 'lead'
  | 'appointment'
  | 'sale'
  | 'do_not_knock'

export type DoorKnock = {
  id: string
  tenant_id: string
  project_id: string
  subcontractor_id: string
  outcome: DoorKnockOutcome
  address: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  knocked_at: string
  created_at: string
}

// Industry-standard door dispositions (the SalesRabbit/SPOTIO convention),
// each with a pin color for maps and button/badge classes for the logging UI.
export const DOOR_KNOCK_OUTCOMES: {
  value: DoorKnockOutcome
  label: string
  pinColor: string
  buttonClass: string
}[] = [
  { value: 'not_home', label: 'Not Home', pinColor: '#9ca3af', buttonClass: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  { value: 'not_interested', label: 'Not Interested', pinColor: '#ef4444', buttonClass: 'bg-red-100 text-red-700 hover:bg-red-200' },
  { value: 'callback', label: 'Callback', pinColor: '#f59e0b', buttonClass: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
  { value: 'lead', label: 'Lead', pinColor: '#10b981', buttonClass: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
  { value: 'appointment', label: 'Appointment', pinColor: '#0ea5e9', buttonClass: 'bg-sky-100 text-sky-700 hover:bg-sky-200' },
  { value: 'sale', label: 'Sale', pinColor: '#8b5cf6', buttonClass: 'bg-violet-100 text-violet-700 hover:bg-violet-200' },
  { value: 'do_not_knock', label: 'Do Not Knock', pinColor: '#111827', buttonClass: 'bg-gray-800 text-white hover:bg-gray-900' },
]

export function doorKnockOutcomeMeta(outcome: DoorKnockOutcome) {
  return DOOR_KNOCK_OUTCOMES.find((o) => o.value === outcome) ?? DOOR_KNOCK_OUTCOMES[0]
}

// A "contact" is any door that answered — everything except Not Home. Contact
// rate (contacts ÷ knocks) is the standard canvassing health metric.
export function isDoorContact(outcome: DoorKnockOutcome): boolean {
  return outcome !== 'not_home'
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

// ---------------------------------------------------------------------------
// Knowledge base — platform help center (global, authored by super admin).
// ---------------------------------------------------------------------------
export type KbCategory = {
  id: string
  slug: string
  name: string
  description: string | null
  position: number
  created_at: string
}

export type KbArticle = {
  id: string
  category_id: string | null
  slug: string
  title: string
  excerpt: string | null
  body: string
  status: 'draft' | 'published'
  position: number
  created_at: string
  updated_at: string
}

// A category with its published articles, for the Help Center browse view.
export type CategoryWithArticles = KbCategory & {
  articles: Pick<KbArticle, 'id' | 'slug' | 'title' | 'excerpt' | 'position'>[]
}

// A ranked search hit with a highlighted snippet. `headline` uses «/» markers
// around matched terms (the UI escapes the text, then swaps in <mark>).
export type KbSearchResult = {
  id: string
  slug: string
  title: string
  category_name: string | null
  category_slug: string | null
  headline: string
  rank: number
}

// Check if a tenant has Growth+ features (messaging, ratings, completion approval)
export function hasGrowthFeatures(tenant: Tenant): boolean {
  return tenant.plan === 'growth' || tenant.plan === 'operator'
}

// Time-clock tracking is a Growth+ feature.
export function hasTimeTracking(tenant: Tenant): boolean {
  return tenant.plan === 'growth' || tenant.plan === 'operator'
}

// Marketing engine (Leads / Prospects / Market Intel) is a separate rollout,
// enabled per tenant only by the platform owner. Default off.
//
// It is also parked product-wide behind MARKETING_ENGINE_ENABLED while the
// focus is on the core dispatch job, so a tenant row left with the flag set
// does not resurrect the module on its own.
export function hasMarketingEngine(tenant: Tenant): boolean {
  return MARKETING_ENGINE_ENABLED && (tenant as any).marketing_enabled === true
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

// Profit margin guardrails for estimating and post-job tracking

export type ProfitThresholds = {
  id: string
  tenant_id: string
  labor_max_pct: number
  materials_max_pct: number
  min_profit_margin_pct: number
  created_at: string
  updated_at: string
}

export type ProjectEstimate = {
  id: string
  // Null while the quote is pre-sale; set when the admin links it to the
  // project created after the customer signs.
  project_id: string | null
  customer_name: string | null
  customer_address: string | null
  paintscout_quote_id: string | null
  total_price: number
  estimated_hours: number
  crew_count: number
  crew_rate_per_hour: number
  material_cost_estimate: number
  referral_fee: number | null
  material_pct: number
  labor_pct: number
  projected_profit_pct: number
  status: 'estimating' | 'approved' | 'rejected'
  approval_reason: string | null
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export type ProjectLedgerEntry = {
  id: string
  project_id: string
  total_price: number
  actual_material_cost: number
  actual_crew_hours: number
  actual_crew_pay: number
  referral_fee: number | null
  total_cogs: number
  actual_gross_profit: number
  actual_margin_pct: number
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string
}

export type MarginCheck = {
  id: string
  project_id: string
  check_type: 'estimate' | 'final'
  labor_pct: number
  materials_pct: number
  profit_margin_pct: number
  labor_threshold: number
  materials_threshold: number
  profit_threshold: number
  status: 'pass' | 'warning' | 'fail'
  checked_at: string
  checked_by: string
}

// Margin check status determination. A guardrail that's off target but within
// a small tolerance band is a "warning" (flag for review); past that band
// it's a hard "fail". The tolerance is a starting point — tune it if it
// doesn't match how much slack the business wants to allow.
const LABOR_WARNING_TOLERANCE_PCT = 3
const MATERIALS_WARNING_TOLERANCE_PCT = 2
const PROFIT_WARNING_TOLERANCE_PCT = 5

export function getMarginStatus(
  material_pct: number,
  labor_pct: number,
  profit_pct: number,
  thresholds: Pick<ProfitThresholds, 'labor_max_pct' | 'materials_max_pct' | 'min_profit_margin_pct'>
): 'pass' | 'warning' | 'fail' {
  const laborOk = labor_pct <= thresholds.labor_max_pct
  const materialsOk = material_pct < thresholds.materials_max_pct
  const profitOk = profit_pct >= thresholds.min_profit_margin_pct

  if (laborOk && materialsOk && profitOk) return 'pass'

  const laborWithinTolerance = labor_pct <= thresholds.labor_max_pct + LABOR_WARNING_TOLERANCE_PCT
  const materialsWithinTolerance = material_pct < thresholds.materials_max_pct + MATERIALS_WARNING_TOLERANCE_PCT
  const profitWithinTolerance = profit_pct >= thresholds.min_profit_margin_pct - PROFIT_WARNING_TOLERANCE_PCT

  if (laborWithinTolerance && materialsWithinTolerance && profitWithinTolerance) return 'warning'
  return 'fail'
}
