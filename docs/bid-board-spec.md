# Kolrabee — Subcontractor Bid Board (V1 Build Spec)

**Stack:** Next.js (App Router) / Supabase (Postgres + RLS + Storage) / Vercel
**Author:** Patrick Dial — Midwest Investments
**Status:** V1 spec, ready for Claude Code

---

## 1. Why this exists

Kolrabee today is **price-out**: we set the price, the sub accepts or declines. This module is **price-in**: our salesperson scopes a job, we broadcast it to one or many subs, and they come back with numbers we compare side by side, negotiate, and award. The award converts into a normal Kolrabee job/dispatch record so nothing downstream changes.

Two distinct flows must coexist in the same app. Do **not** refactor the existing accept/decline flow — add a `sourcing_mode` enum (`assigned` | `bid`) on the job and branch.

---

## 2. Core objects

```
Opportunity (internal, created by sales from scope system)
  └── BidRequest (a round of bidding on that opportunity)
        ├── BidPackage       (attachments: files, Drive links, photo uploads)
        ├── ScopeItem[]      (from the scoping system — what subs price)
        ├── BidInvitation[]  (one per sub, tokenized, revocable)
        │     └── BidSubmission[]  (rev 1 = original, rev 2+ = counter rounds)
        │           └── BidLineItem[]  (one per ScopeItem, + sub-added extras)
        └── Award            (one winning submission → creates Job)
```

Key rule: **BidRequest is versioned by round, BidSubmission is versioned by revision.** A counter-offer creates revision 2 on the same invitation, never a new invitation.

---

## 3. Schema

All tables carry `org_id uuid not null` (multi-tenant) + `created_at`, `updated_at`, `created_by`.

### `bid_requests`
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid | tenant |
| opportunity_id | uuid | FK to your scoping system's opportunity |
| title | text | e.g. "Westerville HOA — 42,000 sf mill & overlay" |
| site_address | text | |
| site_lat / site_lng | numeric | for future proximity matching |
| trade | text | asphalt, concrete, landscape, paint… drives default sub list |
| scope_narrative | text | rich text, the written scope |
| bids_due_at | timestamptz | hard deadline |
| target_start / target_end | date | schedule window subs must confirm |
| visibility_mode | enum | `blind` \| `blind_with_count` \| `open_low` — **per request, admin toggle** |
| status | enum | `draft`, `open`, `closed`, `awarded`, `cancelled` |
| internal_budget | numeric | our target sub cost — never exposed |
| customer_price | numeric | for margin view — never exposed |
| awarded_submission_id | uuid null | |
| created_by | uuid | salesperson/admin |

### `bid_scope_groups` — the proposal hierarchy

Per the Bidding Essentials SOP, scope has four levels with real dependency rules. Model it, don't flatten it.

| col | type | notes |
|---|---|---|
| id, bid_request_id, org_id | | |
| group_type | enum | `base_bid`, `option`, `add_item`, `add_option` |
| label | text | "BASE BID", "OPTION 1", "ADD ITEM 2: Stripe" |
| ordinal | int | the 1, 2, 3 in OPTION 1 |
| parent_group_id | uuid null | **required** for `add_item` and `add_option`, **must be null** for `base_bid` and `option` |
| scope_code | text null | e.g. `E6S4A2`, `OLA2`, `MPAA` |
| description | text | plain-language, sub-facing |
| sort_order | int | |
| source_ref | text | MeasureMap/Pipedrive id for round-trip sync |

**DB constraints — enforce, don't trust the UI:**
- `base_bid`: exactly one per bid request, `parent_group_id IS NULL`
- `option`: `parent_group_id IS NULL` (stands alone by definition)
- `add_item`: `parent_group_id NOT NULL`, parent must be `base_bid` or `option`
- `add_option`: `parent_group_id NOT NULL`, parent may be any of the other three

**Bid math follows from this:**
- Base bid total = the sub's number for the required work. Always priced.
- Options priced independently — a sub may bid Option 1 and skip Option 2.
- Add items are only valid if their parent is priced. Grey out and zero them in the UI if the parent is skipped.
- Add options are modifiers — capture as a **delta** (`+$X` or `+$X/unit`), not an absolute, since they alter existing scope.

Award selection is therefore a *set*: base bid + chosen option(s) + chosen add items/options. The award RPC takes an array of `bid_scope_group_id`s and sums only those.

### `bid_scope_items` — measured quantities inside a group

| col | type | notes |
|---|---|---|
| id, bid_scope_group_id, bid_request_id, org_id | | |
| sort_order | int | |
| description | text | |
| qty | numeric | |
| uom | enum | `SY`, `LF`, `TON`, `EA`, `LS`, `HR` |
| notes | text | field conditions: water holds, heavy truck turning, low spot |
| source_ref | text | |

**UOM validation, from the Takeoff SOP:** all area quantities are square yards and all linear quantities are feet. Reject `SF` on import with a clear error rather than silently converting — a square-feet number that sneaks through prices the job 9x wrong. If the source system ever hands you SF, fail loudly.

### Scope code parser

Store `scope_code` as text, but parse it on import into a structured layer stack for display. Grammar:

```
CODE  := SEGMENT+
SEGMENT := LETTERS DEPTH?
LETTERS := E | S | A | O | I | OL | M | P | FG
DEPTH := number (inches, may be decimal)
```

Repeated letters mean *different materials in sequence*, not repeated lifts — second `S` is a different stone, second `A` a different mix. Defaults: bare `S` = #304, bare `A` = 448 Type 1, `OLA` = 448 Type 1.

`E10S2S4A2.5A1.5` decodes to:

| # | material | depth |
|---|---|---|
| 1 | Excavate existing | 10" |
| 2 | #2 stone | 2" |
| 3 | #304 stone | 4" |
| 4 | 301 asphalt | 2.5" |
| 5 | 448 Type 1 surface | 1.5" |

**Render the decoded stack to subs, not the raw code.** A paving sub should never have to know our internal shorthand to bid our work — every minute of decoding is a minute of "call me to explain," and ambiguity is where change orders are born. Show the code as a small monospace badge for our own people, the plain-language layer table for theirs.

Seed the material lookup as a table (`scope_code_materials`: letter, ordinal, material_name, default_spec) so Jason can add mixes without a code deploy.

> **Integration point:** groups + items are *imported* from the scoping system, not authored here. Build `POST /api/bid-requests/:id/scope/import` accepting the full nested structure; keep `source_ref` at both levels so re-import updates in place rather than duplicating. Re-import after bids exist must be blocked unless the admin explicitly opens a new bid round — silently changing scope under a live bid is how you get sued.

### `bid_attachments`
| col | type |
|---|---|
| id, bid_request_id, org_id | |
| kind | enum `upload` \| `external_link` |
| storage_path | text null (Supabase Storage, bucket `bid-packages`) |
| external_url | text null (Google Drive folder, Dropbox, etc.) |
| label, mime_type, size_bytes, sort_order | |
| visible_to_subs | bool default true |

**Attachment roles.** `attachment_role` enum, distinct storage treatment per role:

| role | source | sub-visible | notes |
|---|---|---|---|
| `takeoff_internal` | MeasureMap `.jpg` — labels, scope codes, field notes visible | **yes** | the authoritative scope record |
| `takeoff_proposal` | MeasureMap `.jpg` — clean outlines/fill only | no | sales asset; tells a bidder nothing |
| `site_photo` | phone photos of existing conditions | yes | many per job, gallery view |
| `plan` | customer-supplied drawings, civil plans | yes | |
| `existing_conditions_doc` | core samples, prior repair history | yes | |
| `other` | | admin choice | |

Auto-detect `takeoff_internal` / `takeoff_proposal` from the SOP filename convention (`JobName - InternalTakeoff.png`, `JobName - ProposalTakeoff.png`); everything else defaults to `site_photo` with the admin able to retag. Default `takeoff_proposal` to `visible_to_subs = false`.

**Why they can't share a bucket with site photos:** the takeoff is legal evidence of what you asked a sub to price. Site photos are context. The takeoff needs immutability (no overwrite, versioned on replace), inclusion in the scope content hash, and a hard block on sending a bid request without one. Site photos need none of that and are freely added and deleted. Treat a takeoff replacement as an addendum event, not an edit.

**Drive folder ingest.** Since the package lives in a Drive folder, build `POST /api/bid-requests/:id/attachments/import-drive` that takes the folder URL, lists its contents, and presents a tagging table — filename, thumbnail, detected role, visible-to-subs toggle. Copy the bytes into Supabase Storage rather than linking; a Drive permission change six months from now shouldn't break the record of what a sub was shown. Keep the original Drive URL on the row for provenance.

**Takeoff viewer.** The sub-facing page needs a real image viewer for the takeoff, not an `<img>` in a card: pinch-zoom, pan, double-tap to fit, full-screen, and a download-original link. A bidder is reading small dimension labels on a phone. If they can't zoom cleanly they will either call you or guess, and one of those is expensive.

Subs must be able to view attachments **without a Google login**. For `external_link`, we cannot control that — so the UI must warn the admin: *"Confirm this Drive folder is set to 'Anyone with the link — Viewer' before sending."* Add a one-click "Test as outsider" that opens the link in a fresh context.

### `subcontractors`
| col | type | notes |
|---|---|---|
| id, org_id | | |
| company_name, contact_name, email, phone | | |
| trades | text[] | |
| service_area_zips | text[] | |
| is_preferred | bool | |
| status | enum `active`, `paused`, `blocked` | |
| notes | text | |

### `sub_compliance_docs` — **gating, V1**
| col | type | notes |
|---|---|---|
| id, subcontractor_id, org_id | | |
| doc_type | enum `coi_gl`, `coi_auto`, `coi_wc`, `w9`, `license`, `mou` |
| storage_path | text |
| issued_on, expires_on | date |
| coverage_amount | numeric null |
| verified_by, verified_at | |
| status | derived: `valid` / `expiring_soon` (≤30d) / `expired` / `missing` |

**Gating rules (configurable per org, defaults):**
- `w9` required, no expiry.
- `coi_gl` required, must be valid **through `target_end` of the bid request**, not just today.
- `coi_wc` required unless sub is flagged sole-proprietor-exempt.
- `license` required only for trades in `org_settings.license_required_trades`.

Enforcement is **two-tier**, and this matters:
- **Invite-time (soft):** compliance failures show a red badge in the sub picker; admin can still invite with a reason. Sub gets a "please update your COI" prompt with an upload link alongside the bid.
- **Award-time (hard):** cannot award to a sub with any `expired` or `missing` required doc. Blocked at the DB level with a constraint check in the award RPC, not just in the UI. Admin override requires typing a reason, which is written to `audit_log`.

### `bid_invitations`
| col | type | notes |
|---|---|---|
| id, bid_request_id, subcontractor_id, org_id | | |
| token | text unique | 32-byte urlsafe, this is the auth |
| token_expires_at | timestamptz | = `bids_due_at` + 7d grace |
| status | enum | `sent`, `viewed`, `declined`, `submitted`, `countered`, `awarded`, `lost`, `revoked`, `expired` |
| sent_at, first_viewed_at, last_viewed_at | | |
| view_count | int | |
| decline_reason | text null | |
| reminder_count | int | |

### `bid_submissions`
| col | type | notes |
|---|---|---|
| id, bid_invitation_id, org_id | | |
| revision | int | 1 = original, 2+ = counter rounds |
| submitted_by | enum `sub` \| `admin_on_behalf` | phone-in bids happen — support entry by admin |
| base_total | numeric | computed from line items, stored |
| alternates_total | numeric | |
| exclusions | text | |
| inclusions | text | |
| lead_time_days | int | |
| can_meet_window | bool + `proposed_start`, `proposed_end` | |
| mobilizations | int | how many trips they've priced |
| validity_days | int default 30 | |
| notes | text | |
| attachment_paths | text[] | sub's own PDF/photos |
| is_current | bool | only one true per invitation |
| submitted_at | timestamptz | |

### `bid_line_items`
`id, bid_submission_id, bid_scope_item_id (nullable for sub-added), description, qty, uom, unit_price, extended_price (generated), is_alternate, is_excluded, note`

### `bid_negotiations` — **counter rounds, V1**
| col | type |
|---|---|
| id, bid_invitation_id, org_id |
| direction | enum `to_sub` \| `from_sub` |
| message | text |
| target_total | numeric null (our ask) |
| scope_changes | text null |
| new_due_at | timestamptz null |
| created_by, created_at |

A `to_sub` counter sets invitation status → `countered`, reopens the submission form at `revision + 1`, and fires a notification. Prior revisions stay immutable and visible in the comparison view as a price history sparkline.

### `bid_events` (append-only audit)
`id, org_id, bid_request_id, invitation_id null, actor_type (admin|sub|system), actor_id null, event_type, payload jsonb, ip, user_agent, created_at`

Log: sent, viewed, downloaded_attachment, submitted, revised, countered, declined, reminded, awarded, lost_notice_sent, revoked, compliance_override.

---

## 4. Visibility modes (the per-request toggle)

Implement as a single server-side function `getSubFacingContext(invitation)` — never compute this client-side.

| mode | sub sees |
|---|---|
| `blind` | nothing about others. Default. |
| `blind_with_count` | "You are one of 4 invited contractors." No prices. |
| `open_low` | "Current low base bid: $X" — refreshed on load only, no sub identities, and **suppressed until ≥3 bids are in** so the first bidder can't reverse-engineer. |

Never expose `internal_budget`, `customer_price`, other subs' names, or bid counts below the suppression threshold. Write a test asserting the sub-facing API payload contains none of these fields under any mode.

---

## 5. Margin view (internal only)

On the comparison board, per submission:
- **Sub cost** = base_total (+ selected alternates)
- **Gross margin $** = `customer_price − sub cost`
- **Gross margin %** = margin $ / customer_price
- Color bands, org-configurable: <20% red, 20–34% amber, ≥35% green.
- **Budget delta** = sub cost − internal_budget, shown as ±$ and ±%.
- Sortable by margin, not just by price. The cheapest bid is not always the right award and the UI should make that obvious.

A "what price do I need to hit 35%?" reverse calculator on the request header: `customer_price = sub_cost / (1 − target_margin)`.

---

## 6. Sub-facing experience (no login)

Route: `/bid/[token]` — public, rate-limited, no Supabase auth session.

1. **Landing:** job title, address w/ map, scope narrative, due countdown, attachments (inline image gallery + file list + external link buttons), scope item table.
2. **Actions:** Submit Bid · Decline (with reason picker: too busy / out of area / scope unclear / price won't work / other) · Ask a Question (posts to `bid_negotiations` as `from_sub`, notifies admin, does not require a bid).
3. **Bid form:** unit price per scope item with running extended totals, alternates in a separate block, add-your-own line, exclusions/inclusions free text, schedule confirm, file upload, validity days.
4. **Compliance block:** if any required doc is expiring/missing, show inline uploader. Sub can submit a bid without it, but sees "This must be resolved before we can award."
5. **Save draft** — autosave to the invitation record every 20s so a sub on a phone in a truck doesn't lose work.
6. **Confirmation** — on-screen summary + email copy of exactly what they submitted. This kills 90% of "that's not what I bid" disputes.
7. **After deadline:** form locks, shows "Bidding closed." Token still resolves so they can view what they submitted.

Mobile-first. Assume a foreman on an iPhone with one bar. Big tap targets, no modals for the bid form, works at 360px.

---

## 7. Admin experience

**Bid Request builder** — 4 steps: Details → Scope (import from scoping system) → Package (attachments) → Invite.

**Sub picker:** filtered by trade + service area, sorted preferred-first, each row showing compliance badge, last 5 bids' win rate, and avg variance vs. award. Multi-select with "select all in trade." Bulk-invite and single-invite are the same code path with N=1.

**Bid Board (the comparison view)** — the centerpiece:
- Columns = subs, rows = scope items **grouped by base bid / option / add item / add option**, cells = unit price.
- Collapsible group headers with group subtotals. Base bid group always expanded.
- **Coverage row per group:** "3 of 5 subs priced this." A sub who skipped Option 2 shows as a struck-through cell, not a $0 — never let a skipped scope look like a free one.
- Row-level low bid highlighted; outlier detection (>40% off median) flagged amber — that's usually a scope misread, not a deal.
- Unit price shown alongside extended, since $/SY is how you sanity-check a paving bid against your own history.
- **Scenario selector** in the header: toggle which options/add items are "in," and every column's total, margin, and ranking recomputes live. The winner on base bid alone is frequently not the winner on the scope you'll actually sell.
- Footer rows: base bid total, selected scenario total, margin $, margin %, schedule fit, compliance status.
- Sticky first column, horizontal scroll, print/PDF export for the owner meeting.
- Per-column actions: Counter · Award · Reject.
- "No bid yet" columns show status + last-viewed timestamp + one-click reminder.

**Award flow:** select submission → confirm modal showing margin, compliance check, and schedule → on confirm: create Job with `sourcing_mode='bid'` and the winning line items as the sub's cost basis, set request `awarded`, mark other invitations `lost`, queue courtesy "not selected this time" emails (admin can skip). Award must be a **single Postgres RPC in a transaction** — never a sequence of client calls.

---

## 8. Notifications

Resend or Postmark. Every email is also an SMS-able short version (Twilio, phase 2 — but write the message templates channel-agnostic now).

| trigger | to | content |
|---|---|---|
| invitation sent | sub | job summary, due date, bid link |
| T-48h, T-12h, no submission | sub | reminder |
| submission received | admin + creator | sub name, total, margin flag |
| counter sent | sub | our ask + new deadline |
| counter answered | admin | |
| declined | admin | reason |
| all invited subs responded | admin | "ready to review" |
| deadline passed | admin | who never responded |
| compliance doc expiring ≤30d | admin + sub | |
| awarded | winner + losers | |

Idempotency keys on every send. Nothing worse than blasting a sub six reminder emails.

---

## 9. RLS

- `subcontractors`, `bid_*`: admin access scoped by `org_id` via JWT claim.
- Sub-facing routes use **no user session**. All sub reads/writes go through server-side route handlers using the service key, after validating the token, its expiry, and the invitation status. The token is the only credential — treat it like a bearer token: constant-time compare, hashed at rest (`token_hash`), full value shown once at send time and never stored in logs.
- Rate limit `/bid/[token]`: 60 req/min per token, 300/hr per IP.

---

## 10. Scope integrity — validation gates

Bad scope out is the most expensive failure mode in this system. A unit error prices a job 9x wrong; a scope-code/line-item mismatch produces change orders; a silent post-send edit produces a dispute you lose. Four gates, each cheap.

### Gate 0 — Transcription (the takeoff is an image, so this is where errors are born)

MeasureMap outputs a `.jpg`, not a data file. Every quantity is typed by a human reading a picture, which means transposition and unit errors enter here and nowhere else. Two mitigations, both cheap:

1. **Side-by-side entry.** The scope entry screen puts the takeoff image on the left with zoom/pan and the quantity form on the right. Never make someone tab between a Drive tab and a form — that's where digits get dropped. The takeoff must be attached before scope entry unlocks.
2. **Vision cross-check.** On save, send the takeoff image to the Anthropic API and ask it to read the visible area/linear labels and scope codes, returning JSON. Diff against what was keyed and surface mismatches: *"Image shows 1,240 SY on the north lot; you entered 1,420 SY."* Treat this strictly as a **second reader, never a source of truth** — it does not auto-fill and it cannot block a save, because a confident wrong OCR that silently populates a field is worse than no check at all. Its job is to make a human look twice at a specific number.

This substitutes for the second-set-of-eyes review on smaller jobs and runs in about two seconds. On jobs above the review threshold, do both.

### Gate 1 — Import-time (hard blocks)

Run on `POST /scope/import`. These reject the payload outright.

1. **UOM whitelist.** Area = `SY`, linear = `LF` only. `SF` is rejected with the message "MeasureMap defaults to square feet — change the project setting and re-export." Never auto-convert. A silent /9 hides the fact that someone's settings are wrong and it'll happen again next job.
2. **Depth balance.** For any code with excavation, the excavation depth must equal the sum of replacement layer depths. `E6S4A2` → 4+2=6 ✓. `E6S4A2.5` → 6.5 ≠ 6, reject. This is the single highest-value check in the list — it's pure arithmetic on our own data, no judgment required, and it catches typos in the code that would otherwise ship straight to a sub.
3. **Code/item consistency.** If the code contains `E` there must be an excavation line item; `A` → asphalt item; `S` → stone item. A code and its items that disagree means one of them is stale.
4. **Hierarchy constraints.** Add items and add options must resolve to a live parent (already enforced at DB level — surface the error legibly here).
5. **Positive quantities.** No zero, no negative, no null on a priced item.

### Gate 2 — Pre-send (soft warnings, admin must acknowledge)

These are judgment calls, so they warn rather than block. Each requires a click and logs who acknowledged it to `bid_events`.

1. **Tonnage reconciliation.** Compacted asphalt runs ≈110 lb per SY per inch, so `tons ≈ SY × inches × 0.055`. Compute the implied tonnage from area and depth and compare to any tonnage line item. Off by more than 10% means the area, the depth, or the tonnage is wrong. Off by ~9x means someone typed square feet.
2. **Magnitude bands per trade.** Seed from your own history: a commercial lot is typically 500–20,000 SY. Anything over 50,000 SY is more than ten acres — possible, but it should make somebody look. Anything under 50 SY is probably a patch mis-scoped.
3. **Parcel sanity.** Optional but high value: compare takeoff area to the county auditor parcel footprint. A takeoff larger than the parcel it sits on is definitionally wrong. Franklin and Delaware County both expose this.
4. **Historical $/SY band.** Once `internal_budget` is set, compute budget ÷ SY and compare to your trailing median for that scope code. A mill-and-overlay budgeting at $2/SY means the area is inflated 9x.
5. **Add item vs. parent quantity.** An add item quantity exceeding its parent's is usually a copy-paste error.
6. **Attachment presence.** No internal takeoff attached = warn. Subs bidding blind on narrative alone is how you get 40% spreads.

### Gate 3 — Human verification before send (the one that actually works)

Automation catches arithmetic; it does not catch "we scoped the wrong lot." Two requirements:

1. **Preview as sub.** The Send button is disabled until the admin has opened the sub-facing view at least once, tracked on the request record. It takes fifteen seconds and it's the highest-yield check in the whole system — you see the decoded layer stack, the quantities, and the attachments exactly as a bidder does.
2. **Second-set-of-eyes on threshold jobs.** Any bid request over an org-configurable dollar threshold (suggest $50k) requires a reviewer other than the creator to mark it verified. Store `verified_by`, `verified_at`. On a small team this is Jason reviewing a salesperson's takeoff, which is a control you want anyway.

### Gate 4 — Bid-time reverse checks (the subs audit you for free)

Your bidders are the best error detector you have — they lose money on mistakes, so they read carefully. Instrument that.

1. **Quantity confirmation.** Every submission requires a checkbox: "I have verified quantities against the takeoff." Add an optional per-item "my measured qty" field. Any sub-reported quantity varying more than 5% from ours raises an internal flag on the bid board.
2. **Cluster detection.** When 3+ bids are in, compute the coefficient of variation on base bid totals. Tight cluster = scope was clear. A wide spread (>35%) means the scope was ambiguous, not that you found a bargain — flag the request for review before awarding rather than celebrating the low number.
3. **The "too good" flag.** A bid more than 40% below the median gets a hard confirm at award: "This bid is 47% below median. Confirm the sub priced the full scope." That sub read square feet, or missed the excavation, and the difference will arrive later as a change order or a walked job.
4. **Questions are signal.** Two or more subs asking about the same scope item auto-flags that item as ambiguous on the admin board.

### Scope immutability and addenda

Once a bid request moves to `open`, scope is frozen. Any change creates an **addendum**:

- New `bid_addenda` row: `id, bid_request_id, addendum_no, summary, changed_group_ids[], issued_at, issued_by`.
- All invitations revert to `addendum_pending`, notification fires, deadline auto-extends by an org-default (suggest 48h).
- Existing submissions are marked `superseded` but retained — never deleted.
- Subs must acknowledge the addendum before their submission counts as current; unacknowledged bids display with a warning badge and cannot be awarded.
- Store a **content hash** of the scope tree at send time and at submission time. When a sub says "that's not what you sent me," you have a cryptographic answer in two seconds instead of an argument.

### Build note

Gates 1 and 3 are cheap and belong in the MVP. Gate 2 needs historical data you won't have on day one; ship the framework with the bands configurable and empty, and populate them after twenty jobs. Gate 4 lands with the comparison board.

---

## 11. Build order for Claude Code

1. Migrations + RLS + seed data (3 fake subs, 1 request with base bid + 2 options + 1 add item, 8 scope items).
2. Attachment upload + Drive folder ingest + role tagging + takeoff viewer.
3. Side-by-side scope entry (image + form) + scope code parser + **Gate 1 validators**. Get the data model and its guardrails right before anything is pretty.
4. `getSubFacingContext()` + token validation + the sub-facing read page with decoded layer stacks and the takeoff viewer.
5. Bid submission form + line items + autosave + quantity confirmation + confirmation email.
6. Admin request builder + **Gate 3 preview-as-sub gate**.
7. Sub picker + invitation fan-out + notification queue.
8. Bid Board comparison view + scenario selector + margin + **Gate 4 reverse checks**.
9. Counter/negotiation rounds + addenda/immutability.
10. Compliance docs + gating + award RPC.
11. Reminders cron (Vercel cron, hourly).
12. **Gate 0 vision cross-check** + Gate 2 warning bands + PDF export + audit log viewer.

Ship 1–8 as the usable MVP. 9–10 make it defensible. Gate 0's vision check is deliberately last — it's the highest-leverage *addition* but the system must be correct without it.

---

## 12. Open items

- Do subs upload COIs themselves, or does Alissa collect them? (Affects whether the compliance uploader is public-token-accessible.)
- Retainage / payment terms — displayed on the bid request as a term subs accept, or negotiated? Recommend: display as fixed terms with an "I accept these terms" checkbox on submission. Cheaper than negotiating each time.
- Does a won bid need to write back to the scoping system, or is the Job record sufficient?
- **~~What is the export format out of MeasureMap Pro?~~ Resolved: there isn't one.** MeasureMap emits a `.jpg`. Scope is hand-keyed against the image, so Gate 0 (side-by-side entry + vision cross-check) replaces the import contract entirely. No integration work needed, and no integration to wait on.
- Do subs price by unit rate or lump sum per group? Recommend requiring unit rates on measured groups (SY/LF) so you can compare against historicals and re-price if quantities move on final measure, with lump sum allowed only on `LS` items.
- Is Bruck bidding these out, or is this for Painter1 and 1st Impressions too? The scope-code grammar above is asphalt-specific — landscape and paint need their own material key in `scope_code_materials`, or the parser needs to no-op when `scope_code` is null.
