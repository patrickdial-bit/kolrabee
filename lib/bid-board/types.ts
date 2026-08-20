// Bid Board domain types (spec: docs/bid-board-spec.md §3)

export type BidRequestStatus = 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled'
export type VisibilityMode = 'blind' | 'blind_with_count' | 'open_low'
export type GroupType = 'base_bid' | 'option' | 'add_item' | 'add_option'
export type Uom = 'SY' | 'LF' | 'TON' | 'EA' | 'LS' | 'HR'
export type AttachmentKind = 'upload' | 'external_link'
export type AttachmentRole =
  | 'takeoff_internal'
  | 'takeoff_proposal'
  | 'site_photo'
  | 'plan'
  | 'existing_conditions_doc'
  | 'other'

export const UOMS: Uom[] = ['SY', 'LF', 'TON', 'EA', 'LS', 'HR']

export type BidRequest = {
  id: string
  tenant_id: string
  opportunity_id: string | null
  title: string
  site_address: string | null
  site_lat: number | null
  site_lng: number | null
  trade: string | null
  scope_narrative: string | null
  bids_due_at: string | null
  target_start: string | null
  target_end: string | null
  visibility_mode: VisibilityMode
  status: BidRequestStatus
  internal_budget: number | null
  customer_price: number | null
  awarded_submission_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type BidScopeGroup = {
  id: string
  bid_request_id: string
  tenant_id: string
  group_type: GroupType
  label: string
  ordinal: number | null
  parent_group_id: string | null
  scope_code: string | null
  description: string | null
  sort_order: number
  source_ref: string | null
}

export type BidScopeItem = {
  id: string
  bid_scope_group_id: string
  bid_request_id: string
  tenant_id: string
  sort_order: number
  description: string
  qty: number | null
  uom: Uom | null
  notes: string | null
  source_ref: string | null
}

export type BidAttachment = {
  id: string
  bid_request_id: string
  tenant_id: string
  kind: AttachmentKind
  attachment_role: AttachmentRole
  storage_path: string | null
  external_url: string | null
  label: string | null
  mime_type: string | null
  size_bytes: number | null
  sort_order: number
  visible_to_subs: boolean
  created_at: string
}

export type ScopeCodeMaterial = {
  id: string
  tenant_id: string | null
  letter: string
  ordinal: number
  material_name: string
  default_spec: string | null
}

export const ATTACHMENT_ROLE_LABELS: Record<AttachmentRole, string> = {
  takeoff_internal: 'Takeoff (internal)',
  takeoff_proposal: 'Takeoff (proposal)',
  site_photo: 'Site photo',
  plan: 'Plan / drawing',
  existing_conditions_doc: 'Existing conditions',
  other: 'Other',
}
