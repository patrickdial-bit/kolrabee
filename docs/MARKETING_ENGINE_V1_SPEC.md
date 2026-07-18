# KOLRABEE MARKETING ENGINE — V1 SPEC

**Status:** Draft for build
**Supersedes:** `KOLRABEE_ADS_AGENT_V1_SPEC.md` v1.1
**Stack:** Next.js (App Router) · Supabase (Postgres + RLS + Edge Functions) · Vercel
**Owner:** Patrick Dial
**Build agent:** Claude Code

> **Implementation note (added at Phase 1 build):** this spec references
> `jobs`, `customers`, `crews`, `services`, and `schedule` tables. Kolrabee's
> actual system of record is `projects` (the job unit, with `customer_name`
> and `address` inline), `users` (role `subcontractor`), `crew_members`, and
> `time_entries`. Phase 1 maps: lead → `mk_leads`; booked job → `projects`
> row (`mk_leads.project_id`); collected revenue → new
> `projects.revenue_amount` at status `paid`. There is no separate services
> catalog or schedule table yet; capacity signals derive from projects and
> time tracking when M8 is built.

---

## 0. Provenance Statement

This specification is derived exclusively from:

- Public APIs and datasets (Meta Ad Library API, Google Ads Transparency Center, Google Places API, Google Business Profile API)
- Publicly published industry CPL/CPC benchmarks
- Midwest Investments' own first-party campaign, CRM and job data (Painter1, Bruck, 1st Impressions)
- Kolrabee's existing schema and dispatch domain model

No third-party proprietary architecture, interface design, workflow sequence, pricing structure, or roadmap informed this document. All design decisions trace to Kolrabee's existing data model and to the constraints in Section 2.

**Build rule for Claude Code:** if a feature cannot be traced to a public data source or to Kolrabee's own tables, it does not get built.

---

## 1. Positioning

Standalone marketing tools generate leads and stop. They have no idea whether the contractor can service the work, what the job actually costs, or whether it was profitable.

Kolrabee already holds the operational truth: crews, capacity, job costs, service history, margins. **The marketing engine is a demand generator governed by operational reality.**

The one-line pitch: *marketing that knows whether you can actually do the work.*

This is not a bolt-on. It is the natural extension of a dispatch platform, and it is structurally unavailable to any marketing-only competitor.

---

## 2. Core Design Constraints

| # | Constraint | Consequence |
|---|---|---|
| C1 | Public data sources only | No authenticated scraping, no bypassing anti-bot measures, no logged-in extraction. Meta Ad Library API and Google Transparency Center only. |
| C2 | Capacity-governed | No campaign may run that generates demand exceeding available crew capacity. |
| C3 | Closed-loop attribution | Every lead must be traceable to collected revenue on a job, not just to a form fill. |
| C4 | Multi-tenant from day one | Every table RLS-scoped by `tenant_id`. No exceptions. |
| C5 | Trade-agnostic | Must work for landscaping, painting, and paving. Vertical logic lives in config, not code. |
| C6 | Non-technical operator | Every screen must be usable by a GM with no marketing background. |

---

## 3. Module Map

```
M1  Market Intelligence      → what's happening in this market
M2  Campaign Generator       → AI builds the campaign
M3  Landing Page Engine      → AI builds the destination
M4  Lead Capture & Response  → catch and qualify
M5  Booking → Dispatch       → convert to a scheduled job
M6  Attribution & ROI        → prove it worked
M7  Reactivation Engine      → mine existing customers
M8  Capacity Governor        → cross-cutting control layer
```

---

## 4. M1 — Market Intelligence

**Purpose.** Answer: who else is advertising in my service area, what are they saying, what does it cost to compete, and where is demand.

**Data sources (all public):**

| Source | Provides | Access |
|---|---|---|
| Meta Ad Library API | Active ad creative, copy, run duration, page identity | Official API, free, requires app review |
| Google Ads Transparency Center | Advertiser identity, ad formats, date ranges | Public web interface |
| Google Places API | Competitor locations, ratings, review counts, categories | Paid API, licensed use |
| Google Business Profile API | Own listing metrics, review velocity | Official API |
| Published benchmarks | CPL/CPC/CTR by trade and geography | Public reports, stored as reference data |

**Explicitly out of scope:** BBB, Houzz, Nextdoor, Angi, Thumbtack, or any source requiring authentication or anti-bot circumvention. This is a compliance boundary, not a preference.

**Outputs:**

- **Market Board** — competitors within radius, mapped, with review counts, rating trend, ad activity flag
- **Creative Themes** — LLM clusters observed ad copy into themes (e.g. "financing offer," "seasonal urgency," "free estimate") with frequency and run-duration signals. Run duration is the proxy for what works: ads running 60+ days are presumed converting.
- **Gap Report** — themes competitors are running that this tenant is not; services with local demand and thin advertiser coverage
- **Cost Baseline** — expected CPL range for this trade and metro, from benchmarks plus tenant's own historical data

**Refresh cadence:** weekly per tenant, scheduled Supabase cron. Not real-time. Nobody needs hourly competitor data and it multiplies cost for no decision value.

---

## 5. M2 — Campaign Generator

**Purpose.** Turn a service + budget + goal into a launch-ready campaign without marketing expertise.

**Input (operator provides four things):**

1. Service to promote (from tenant's own service catalog — Kolrabee already has this)
2. Monthly budget
3. Service radius
4. Goal: fill capacity / launch new service / seasonal push

**Everything else is derived:**

| Derived field | Source |
|---|---|
| Target audience | Geo radius + service history demographics from existing customer table |
| Suggested budget | Capacity Governor (M8) — how many jobs can actually be absorbed × target CPL |
| Ad copy variants | LLM, conditioned on M1 creative themes + tenant's actual service descriptions and pricing |
| Creative direction | LLM brief; tenant photo library where available |
| Offer construction | Tenant's real margin data — never suggest a discount that breaks the job's target margin |
| Expected results | Benchmark CPL × budget, with historical adjustment once tenant has data |

**The margin guardrail is important.** The generator has access to job cost data, so it must refuse to generate an offer that prices below the tenant's floor. Present as: *"A 15% off offer on spring cleanup puts your margin at 11%. Your floor is 25%. Suggested alternative: bundle offer at full price."*

**Channels V1:** Meta (Facebook + Instagram) and Google Search. Both have mature APIs. Nothing else until these are proven.

**Human approval required before launch.** Always. No autonomous spend.

---

## 6. M3 — Landing Page Engine

**Purpose.** Every campaign needs a destination that converts. Contractors don't have one.

**Approach:** generated static pages served from the Kolrabee domain under a tenant subpath or a custom domain via Vercel. Next.js static generation, revalidated on edit.

**Composition:**

- Headline and body: LLM-generated from the service, offer, and tenant voice profile
- Social proof: pulled live from Google Business Profile reviews (API, licensed)
- Service area map: tenant's actual dispatch radius
- Trust markers: license numbers, insurance, years in business — from tenant profile
- Form: M4 lead capture component
- Tracking: server-side event to attribution pipeline

**Requirement:** page load under 2s, mobile-first, Core Web Vitals green. Ad quality scores depend on it and it directly affects CPC.

**Voice profile.** Per-tenant config: tone, reading level, banned phrases, key differentiators. Set once at onboarding, applied to every generated asset. This is what keeps a Bruck paving page from sounding like a garden center.

---

## 7. M4 — Lead Capture & Response

**Purpose.** Catch every inbound lead and qualify it before a human touches it.

**Channels:** landing page form, Meta lead form (webhook), inbound SMS, inbound call (transcription via telephony provider), website chat.

**Response agent.** LLM-driven, operating under strict scope:

- Acknowledge within 60 seconds, 24/7
- Ask qualifying questions from a per-service script (property size, service needed, timing, address for radius check)
- Score the lead (see below)
- Offer booking slots **only from real dispatch availability** (M8)
- Escalate to human on: pricing negotiation, complaint, complex scope, explicit request for a person

**Hard constraints on the agent:**

- Never quote a final price. Ranges only, from the tenant's published pricing.
- Never commit to a date not confirmed available by the Capacity Governor.
- Always identify itself as an assistant when asked.
- Full transcript logged against the lead record.

**Lead scoring (transparent, not a black box):**

| Signal | Weight |
|---|---|
| Inside service radius | Pass/fail gate |
| Service matches tenant's high-margin catalog | High |
| Requested timing within available capacity window | High |
| Property signals (from Places/public assessor where available) | Medium |
| Response latency and engagement depth | Medium |
| Repeat or referred customer (existing customer table) | High |

Score displayed with reasons. Operators must be able to see *why* a lead scored 82.

---

## 8. M5 — Booking → Dispatch Handoff

**This is the module no marketing-only tool can build.**

Qualified lead converts to a scheduled job in Kolrabee's existing dispatch system. Not a calendar invite — an actual job record with crew assignment, service, address, and estimated duration.

**Flow:** lead qualified → available slots queried from live dispatch → customer selects → job record created → crew notified → confirmation sent → job appears on the board.

**Estimate path.** Where the trade requires a site visit (paving, most hardscape), booking creates an *estimate appointment* assigned to the sales role, not a work order. Configurable per service.

Existing Kolrabee dispatch, crew, and scheduling tables are the system of record. The marketing engine writes to them; it does not maintain a parallel schedule.

---

## 9. M6 — Attribution & ROI

**Purpose.** Answer the only question that matters: did the ad spend produce profit?

**The chain, persisted end to end:**

```
ad impression → click → landing page session → lead → qualified →
booked job → completed job → invoiced → collected → margin
```

**Implementation notes:**

- Click IDs (`fbclid`, `gclid`) captured on landing and stored on the lead record
- Server-side conversion events sent back to Meta CAPI and Google Enhanced Conversions — improves optimization and survives browser tracking loss
- Job revenue and cost pulled from Kolrabee's existing job records
- QuickBooks reconciliation on collected revenue where connected

**Metrics surfaced:**

| Metric | Definition |
|---|---|
| CPL | Spend ÷ leads |
| Cost per booked job | Spend ÷ jobs booked |
| Close rate | Booked ÷ qualified leads |
| Revenue per lead | Collected revenue ÷ leads |
| **ROAS on collected revenue** | The headline number. Not "conversions." |
| **Margin-adjusted ROAS** | Profit ÷ spend. The real number. |

**Monthly report artifact.** Auto-generated PDF/HTML: what ran, what it cost, what it produced, what changed, what's recommended next month. This is the deliverable that replaces the agency's monthly call and it is a first-class feature, not an export.

---

## 10. M7 — Reactivation Engine

**Purpose.** The cheapest revenue is from customers already in the database. No competitor intelligence required.

**Logic:** segment existing customers by service history, elapsed time since last job, lifetime value, and margin. Generate targeted outreach for predictable next actions — spring cleanup customers who haven't booked mulch, paving customers approaching sealcoat interval, painting customers at repaint horizon.

**Channels:** email, SMS (consent-gated), and Meta Custom Audiences built from hashed first-party lists.

**Why this matters commercially:** it runs entirely on first-party data, converts far above cold traffic, and is available on day one before any ad spend. It is also the strongest retention hook — the tenant's own customer list becomes more valuable inside Kolrabee than outside it.

---

## 11. M8 — Capacity Governor

**The differentiating control layer. Cross-cutting, not a screen.**

Reads live from dispatch: crew count, scheduled hours, backlog, average job duration by service.

**Functions:**

1. **Budget ceiling.** Computes maximum sensible spend: `(available crew hours ÷ avg job hours) × target CPL ÷ close rate`. Warns when requested budget would generate demand exceeding capacity.
2. **Auto-throttle.** When backlog exceeds threshold, reduces or pauses spend automatically. Configurable per tenant.
3. **Auto-resume.** When capacity frees up, resumes.
4. **Service steering.** Shifts budget toward services with available capacity and higher margin.
5. **Booking truth.** Supplies real availability to M4 so the agent never promises a slot that doesn't exist.

**Operator-facing message pattern:** *"You're booked 3 weeks out on cleanups. I've paused that campaign and shifted $400 to hardscape, where you have capacity and a better margin. Resume anytime."*

That sentence is the product.

---

## 11a. M9 — Property & Homeowner Graph

**Purpose.** Search every property around a dropped pin and return an addressable, owner-occupied target list.

**Query pattern:** drop pin (e.g. Sunbury, OH) → radius or polygon → filtered property set.

**Data sources, in order of preference:**

| Tier | Source | Provides | Notes |
|---|---|---|---|
| 1 | County auditor/assessor bulk data (Delaware, Franklin, Licking, Union) | Parcel ID, owner name, mailing address, owner-occupancy flag, year built, sq ft, lot size, last sale date/price, assessed value | Public record. Free bulk download. Ohio counties publish this. **Start here.** |
| 2 | Regrid / ATTOM / CoreLogic | Normalized nationwide parcel data, standardized schema | Paid, licensed, clean. Use when expanding beyond home counties. |
| 3 | Melissa / Versium / similar append | Phone and email append to a name+address | Paid per record. **Consent status not included — see M12.** |
| 4 | Kolrabee first-party | Prior jobs at address, prior quotes, service history | Highest value. Already owned. |

**Filters exposed to the operator:**

- Radius or hand-drawn polygon
- **Owner-occupied only** (default ON — a renter cannot buy a driveway)
- Year built range (proxy for driveway/paint/landscape age)
- Assessed value range (affordability screen)
- Last sale date (recent buyers convert well on exterior improvement)
- Lot size (landscape/hardscape opportunity)
- Suppression: existing customers, prior mail within N days, DNC-flagged, bad addresses

**Explicitly prohibited data source:** voter registration files. Ohio's voter file carries commercial-use restrictions, and using political data for home-services targeting is a reputational and legal risk with no offsetting benefit. Do not ingest it.

---

## 11b. M10 — Proximity & Trigger Automation *(highest ROI, build first)*

**The insight:** Kolrabee already knows every address where a job was booked, started, and completed. The highest-converting mail in home services is *"we just finished your neighbor's driveway at 123 Oak Street"* — proof, proximity, and social pressure in one piece. Competing tools (Dope, SendJim) are built almost entirely on this mechanic. Kolrabee can do it better because the job data is native, not synced in over an integration.

### Trigger library

Every trigger fires off a Kolrabee job-state change or an external signal. No manual list building.

| Trigger | Action | Notes |
|---|---|---|
| **Job booked** | Postcard to N closest neighbors: "we're coming to your street" | Builds anticipation before trucks appear |
| **Job started** | Second card: "work underway at [street]" | Physical trucks + card = reinforcement |
| **Job complete** | Third card with the real before/after photo | The money card. Highest response of the three. |
| **Job complete** | Handwritten thank-you note to the customer | Retention + review driver |
| **Job complete** | Review-request card to customer with QR to Google Business Profile | Bruck reviews are at zero. This fixes it. |
| **Job paid** | Cross-brand introduction card (see 11f) | Bruck driveway → 1st Impressions curb appeal |
| **Estimate not closed, 14 days** | Win-back card with the rendering attached | |
| **No service in 12 months** | Reactivation card | Feeds M7 |
| **Weather threshold** | Seasonal trigger — see M14 | Sealcoat after heat run, cleanup after first frost |
| **New mover at address** | Welcome sequence, full service menu | New owners spend heavily on exteriors in year one |
| **Commercial variant** | Card drip to N closest *businesses* on a commercial job | Bruck's commercial mix target is ~33% |

**Standard neighbor drip:** 3 pieces, 15 closest addresses, triggered by booked → started → complete. Configurable per brand and per job value threshold.

### Format spec

- **6x9 double-sided, full color, card stock.** Not 4x6. The larger format is the industry standard for a reason — it survives the mail pile.
- Handwritten notes for customer-facing thank-yous (real pen-and-ink service, not a font)
- Optional gift/goody box on high-value job completion

### Cost benchmark

Competing services deliver postcards at roughly **$0.69 all-in** including print, addressing, and postage. That is the price to beat or match. At 15 neighbors × 3 cards per job, a single job costs about **$31 in mail** to convert into neighborhood awareness. Against a $6K driveway, one conversion per 20 jobs pays for the program many times over — but the system must *measure* that, not assume it.

### Why this beats cold targeting

Zero data acquisition cost, real photography (no AI disclosure needed), verifiable social proof, and native job triggers. **This ships before anything else in this group.**

---

## 11c. M11 — Direct Mail Engine

**Purpose.** Turn a target list into physical mail without anyone touching a print shop.

**Provider:** print-and-mail API (Lob, PostGrid, or equivalent). Programmatic postcard creation, USPS handoff, address verification, delivery tracking, NCOA move-update processing.

**Two mail modes:**

1. **Targeted** — specific parcels from M9. Higher cost per piece, full personalization, required for before/after imagery.
2. **EDDM (Every Door Direct Mail)** — carrier-route saturation, no address list needed, materially cheaper per piece. Correct choice for a new service launch or a dense neighborhood after a completed job.

**Mandatory on every piece — attribution or it didn't happen:**

- Unique QR code per parcel resolving to a personalized landing page
- Unique or pooled tracking phone number per campaign
- Short PURL (e.g. `1stimp.co/1234-oak`)

Without per-piece tracking, direct mail is unmeasurable and the whole attribution chain (M6) breaks.

**Frequency governance.** Config per brand and global cap per household. Address-level, not brand-level.

---

## 11d. M12 — Visualization Studio (AI Before/After)

**Purpose.** Show the homeowner their own property improved. This is the conversion mechanism for the whole mail program.

**Per brand:**

| Brand | Transformation |
|---|---|
| Painter1 | Exterior color change, trim, shutters, front door |
| 1st Impressions | Curb appeal — beds, plantings, hardscape, walkway, patio |
| Bruck | New asphalt driveway, sealcoat refresh, new concrete flatwork |

### Source imagery — the critical decision

**Do not build on Google Street View.** Google's Maps Platform terms restrict creating derivative works from Street View imagery. Generating a modified "after" image from a Street View "before" is a derivative work, and at postcard scale it is a visible, systematic violation. It would also make the program dependent on a permission that can be revoked overnight.

**Approved sources, in order:**

1. **Own photography.** A canvasser or crew member photographs the property from the public right-of-way. Fully owned, no licensing question, and it doubles as a canvassing route. Highest quality input.
2. **Homeowner-submitted.** Landing page or SMS upload: "send a photo of your driveway, get a free rendering." Consent is explicit and it is itself a lead-capture mechanism.
3. **Licensed aerial imagery** (Nearmap, EagleView) under a commercial license permitting derivative works. Verify the license terms specifically permit modification before purchase.
4. **Generic archetype rendering.** No property photo at all — generate a representative home matching the parcel's year built, style, and size from assessor data. Labeled as illustrative. Legally clean, lower conversion, good fallback for cold lists.

**Generation:** Higgsfield and Adobe Firefly are both already connected and available. Firefly is commercially indemnified for generated output, which is the safer default for advertising use.

### Mandatory disclosure

Every rendered image carries, legibly on the piece:

> *Digital rendering for illustration. Actual results vary.*

FTC deceptive-advertising rules apply to home improvement imagery. A rendering that a homeowner reasonably reads as a photograph of achievable results, without disclosure, is an enforcement risk and a consumer-complaint magnet. Non-negotiable, enforced at render time, not left to the designer.

**Additional guardrail:** the rendering must be consistent with what the brand will actually quote. Do not render a $40K hardscape on a home the system will quote at $6K. Bind renderings to the service tier being advertised.

### Three deployment surfaces

The rendering engine is not just a postcard input. It is the same asset used three ways:

**1. Outbound (postcard).** Rendered "after" on the mail piece. Cold or neighbor-triggered.

**2. Inbound lead magnet — the highest-value use.** Public page: *"Upload a photo of your home, see it repainted / landscaped / with a new driveway — free."* The homeowner supplies the photo (clean consent), gets an instant rendering, and enters as a lead with intent already demonstrated. This converts far better than a "free estimate" form because the visitor gets something before giving anything. It also solves the imagery-licensing problem permanently — every image is volunteered.

**3. In-person sales tool.** Estimator on-site photographs the property, generates options live on a tablet, and closes against a visual. Painter1 color selection, 1st Impressions bed/hardscape layouts, Bruck driveway replacement vs. sealcoat comparison. This shortens the decision cycle more than any marketing tactic in this spec.

**Per-brand option sets** (pre-configured, not free-text prompting):

- Painter1 — curated palettes with real paint codes (Sherwin-Williams / Benjamin Moore), trim, shutters, door
- 1st Impressions — plant packages by sun exposure and zone, bed shapes, hardscape material and paver patterns, walkway, patio
- Bruck — new asphalt, sealcoat refresh, concrete flatwork, apron and edging options

**Quote linkage.** Every rendered option maps to a service SKU and price band in Kolrabee. The homeowner sees the visual *and* a range in the same view. This is the whole conversion mechanism — visualization without a price is a toy.

**Known accuracy ceiling.** AI exterior renders run roughly 80–85% accurate, with artifacts most likely on complex rooflines and unusual architectural detail. Design for it: generate multiple variants, let the operator reject bad ones before anything is mailed or shown, and never auto-mail an unreviewed render.

---

## 11e. M13 — Outbound Contact Compliance *(gating layer, not a feature)*

**This is the module that protects the business. Build it before any call or text ships.**

Fieldy record shows outbound calling already running at Bruck (Letizia working historical lists, 100 calls/week policy) with data-quality failures — wrong contact names on records. Scaling that to cold homeowner lists without a compliance layer is the largest single risk in this spec.

**Requirements:**

| Control | Rule |
|---|---|
| National DNC scrub | Every phone number, before every campaign. Subscribe to the registry. Re-scrub every 31 days. |
| Ohio state DNC | Scrub in addition to federal. |
| Internal DNC | Permanent, honored across all three brands. One opt-out suppresses everywhere. |
| SMS | **Prior express written consent required.** No cold texting appended numbers. Ever. |
| Autodialer / prerecorded | Not without consent. Manual dial only for cold lists. |
| Calling hours | 8am–9pm recipient local time. |
| Identification | Company name and callback number stated on every call. |
| Record retention | Consent records, opt-outs, and scrub logs retained 5 years. |

**Channel risk ranking, and it should drive strategy:**

- **Direct mail — no TCPA exposure.** Safe at any scale. This is why mail leads the program.
- **Manual outbound calling — moderate.** Manageable with disciplined DNC scrubbing.
- **Cold SMS to appended numbers — severe.** Statutory damages run $500–$1,500 *per message*. A 5,000-record text blast is a bet-the-company event. The engine must make this technically impossible on non-consented numbers, not merely discouraged.

**Design consequence:** phone and SMS fields on a cold-sourced record are locked until a consent event exists. Mail and the QR/PURL response path are the only channels available on cold data. Once the homeowner responds, consent is captured and the other channels unlock.

---

## 11f. Cross-Brand Orchestration

Three companies serve overlapping geography in Delaware County. Without coordination, one household receives three postcards from three companies in the same week — which reads as spam and burns the address for all three.

**Rules:**

- Household-level frequency cap across all brands, not per brand
- Sequencing logic: a completed Bruck driveway makes that address a qualified 1st Impressions curb-appeal target 60–90 days later, and a Painter1 target the following season
- Shared suppression: an opt-out from any brand suppresses all
- Attribution credits the originating brand, but the household record is shared

This is a structural advantage no single-trade competitor has: one acquisition cost, three services, sequenced over years.

---

## 11g. M14 — Campaign Strategy Engine

**Purpose.** The operator should never face a blank page. The system proposes what to run, to whom, and why — then the operator approves.

### Three campaign generators

**1. Competitor-derived.** From M1: themes competitors are running with long run-durations (the proxy for what converts), and themes with local demand but thin advertiser coverage. Output: *"Three competitors are running financing offers on hardscape. Nobody in your radius is advertising fall cleanup. Here are two campaigns."*

**2. Seasonal / weather-triggered.** Home services demand is driven by calendar and weather more than by anything else. This is the generator no horizontal marketing tool understands and no contractor executes well manually.

| Signal | Brand | Campaign |
|---|---|---|
| Sustained heat run | Bruck | Sealcoat — asphalt cures and seals best in heat |
| First frost forecast | 1st Impressions | Leaf cleanup, winterization |
| Pre-spring thaw | Bruck | Pothole/patch repair after freeze-thaw damage |
| Early spring | 1st Impressions | Pre-emergent, mulch, cleanup |
| Late spring | Painter1 | Exterior repaint season opens |
| Pre-winter | Bruck / 1st Impressions | Snow contracts |
| Post-storm | All | Damage assessment offers |

Weather API drives the trigger; the Capacity Governor (M8) decides whether to actually fire it. Build the seasonal calendar per brand as config, seeded from your own historical job data — you already know when each service sells.

**3. Product / service campaigns.** Driven by margin and inventory, not guesswork. Pull from Kolrabee's service catalog and the 1st Impressions retail inventory: push high-margin services with open capacity, move slow retail stock, launch new offerings. *"Hardscape has your best margin and three weeks of open crew time. Mulch inventory is 40% above plan. Here are campaigns for both."*

### Campaign brief output

Every generated campaign arrives as a reviewable brief, not a launched campaign:

- Objective and target service
- Audience: pin/radius/polygon + M9 filters
- Channel mix and budget split
- Creative concept + generated copy + rendering direction
- Expected results (from benchmarks + your own history)
- Capacity check: pass/fail from M8
- Cost and projected margin impact

Operator approves, edits, or rejects. Nothing spends without a human.

---

## 11h. Channel Matrix — Everything Around a Pin

The engine must cover every legitimate way to reach a homeowner at a known address. Channel selection is governed by consent state (M13), not by preference.

| Channel | Cold-list eligible | Mechanism |
|---|---|---|
| **Direct mail — targeted** | ✅ Yes | M9 list → M11 print API, per-piece QR/PURL |
| **Direct mail — EDDM** | ✅ Yes | Carrier-route saturation, cheapest per piece |
| **Handwritten note** | ✅ Yes | Customer/retention use primarily |
| **Door hanger / canvass** | ✅ Yes | Route generated from M9; canvasser also captures property photos for M12 |
| **Meta / Instagram ads** | ✅ Yes | Geo-radius + Custom Audience from hashed first-party list |
| **Google Search / PMax** | ✅ Yes | Local intent capture |
| **Google Local Services Ads** | ✅ Yes | Pay-per-lead, high intent, underused in the trades |
| **YouTube / Display retargeting** | ✅ Yes | Retarget landing page visitors |
| **Nextdoor / local social** | ✅ Yes | Organic + paid; strong for neighbor proof |
| **Google Business Profile posts** | ✅ Yes | Free. Also: resolve the duplicate Sunbury GBP listings — they are competing with each other. |
| **Outbound calling** | ⚠️ DNC-scrubbed only | Manual dial, M13 gating |
| **SMS** | ❌ Consent required | Locked until consent event |
| **Email** | ⚠️ CAN-SPAM compliant | Opt-out honored, physical address on every send |
| **Retargeting from QR/PURL** | ✅ Yes | Mail responders become a digital audience — this is the mail-to-digital bridge most tools miss |

**The bridge that matters:** every mail piece drives to a PURL. Every PURL visit drops a pixel. Mail responders who don't convert immediately become a retargeting audience across Meta and Google. That converts direct mail from a one-shot channel into the top of a multi-touch sequence, and it is the single biggest efficiency gain available in the whole system.

---

## 12. Data Model (Supabase)

All tables carry `tenant_id uuid not null` with RLS enabled.

```
mk_market_snapshots      weekly M1 pull per tenant
mk_competitors           observed advertisers, public identity only
mk_creative_themes       clustered themes with frequency + run duration
mk_benchmarks            reference CPL/CPC by trade + metro (global, not tenant-scoped)
mk_campaigns             campaign definition, status, budget, channel
mk_campaign_variants     ad copy + creative variants, performance
mk_landing_pages         generated pages, slug, revision history
mk_voice_profiles        per-tenant tone/style config
mk_leads                 lead record, source, click ids, score, transcript ref
mk_lead_events           append-only event log (contacted, qualified, booked, lost)
mk_conversations         agent transcripts
mk_attribution           spend ↔ lead ↔ job ↔ revenue join table
mk_reports               generated monthly report artifacts
mk_reactivation_segments segment definitions + last run
mk_capacity_snapshots    periodic capacity reads for governor decisions
mk_properties            parcel record: apn, address, geo, owner name/mailing,
                         owner_occupied, year_built, sqft, lot_size, last_sale,
                         assessed_value, source, refreshed_at
mk_property_lists        saved pin/polygon queries + filter criteria
mk_mail_campaigns        campaign def, mode (targeted|eddm), brand, creative ref
mk_mail_pieces           one row per physical piece: property_id, purl, qr_token,
                         tracking_number, mailed_at, delivered_at, responded_at
mk_renderings            source image ref, prompt, output, brand, service tier,
                         disclosure_applied (bool, enforced)
mk_contact_consent       per phone/email: consent type, source, timestamp, proof ref
mk_suppression           global cross-brand: DNC, internal opt-out, bad address,
                         do-not-mail. Address AND phone keyed.
mk_household_touches     cross-brand frequency ledger, keyed by normalized address
```

**Note:** `mk_suppression` and `mk_household_touches` are the only tables intentionally **not** tenant-scoped within the Midwest group — they are shared across Painter1, Bruck and 1st Impressions so an opt-out honors everywhere. For external tenants they remain tenant-scoped. Implement as a `suppression_scope` column, not as separate tables.

**Foreign keys into existing Kolrabee tables:** `projects` (jobs), `users`, `crew_members`, `time_entries`. The marketing engine reads and writes these; it does not duplicate them. This coupling is the moat — do not build a parallel CRM.

---

## 13. AI Layer

| Task | Model tier | Notes |
|---|---|---|
| Ad copy / landing page generation | Frontier | Quality matters, low volume |
| Creative theme clustering | Mid | Batch, weekly |
| Lead response agent | Fast/cheap | Latency-critical, high volume, tight scope |
| Lead scoring | Deterministic rules + model assist | Must be explainable |
| Monthly report narrative | Frontier | Low volume, high visibility |

**Cost control:** cache aggressively, batch the weekly intelligence pull, use the cheapest model that clears the quality bar for each task. Track token spend per tenant — it is a real COGS line and must appear in unit economics from day one.

---

## 14. Build Order

**Phase 0 — Compliance floor (blocking, ~1 week)**
M13. DNC subscription, suppression tables, consent model, channel locks. Nothing that contacts a human ships before this exists.

**Phase 1 — Prove the loop (4–6 weeks)**
M4 lead capture → M5 booking/dispatch handoff → M6 attribution.
Run against the existing 1st Impressions Meta campaign. Goal: one lead traced end-to-end to collected revenue. Nothing else ships until this works.

**Phase 2 — Neighbor radius mail (fastest payback)**
M9 property lookup (Delaware County only) + M10 neighbor radius + M11 mail engine, using **real job photos, no AI rendering**. Trigger off completed Bruck and 1st Impressions jobs. Measure response rate per 1,000 pieces. This is the cheapest possible test of whether mail works for you at all, and it uses data you already own.

**Phase 3 — Generate demand**
M2 campaign generator + M3 landing pages.

**Phase 4 — Visualization**
M12. Only after Phase 2 proves mail responds. Start with homeowner-submitted photos (clean consent, doubles as lead capture) before investing in canvasser photography.

**Phase 5 — Govern it**
M8 capacity governor. Note: mail has a 5–10 day delivery lag, so capacity forecasting must be forward-looking, not real-time. Do not mail into a full schedule three weeks out.

**Phase 6 — Mine the base**
M7 reactivation.

**Phase 7 — Intelligence**
M1 market intelligence. Deliberately last: it is the best *demo* and the least important *function*. Building it first is the classic trap.

---

## 15. Compliance Guardrails

Non-negotiable, enforced in code:

1. Public data sources only. No authenticated scraping, no anti-bot circumvention. See C1.
2. **No cold SMS.** Prior express written consent required, enforced by channel lock in M13. Statutory damages of $500–$1,500 per message make this the single largest financial risk in the system.
3. DNC scrub (federal + Ohio + internal) before every calling campaign, re-scrubbed every 31 days.
4. **No Google Street View imagery as a base for AI renderings.** Derivative-work restriction. Use owned, submitted, or licensed imagery only.
5. **Every rendering carries a visible "digital rendering, actual results vary" disclosure**, applied at render time and not removable by the operator.
6. **No voter registration data.** Commercial-use restrictions plus reputational risk, no offsetting benefit.
7. AI agent identifies itself as an assistant on request.
8. Meta and Google ad policy pre-checks before submission — auto-generated creative gets accounts banned.
9. Owner-occupancy verified before any exterior-improvement offer is mailed.
10. Ohio Home Solicitation Sales Act: 3-day right of rescission applies to in-home sales. Any contract flow originating from a mail or canvass lead must include it.
11. All competitor data limited to publicly disclosed advertiser information. No individual profiling.

---

## 16. Success Metrics

**Product:** lead-to-booked-job rate; % of spend with complete attribution to collected revenue; time from lead to first response.

**Business:** margin-adjusted ROAS per tenant; % of tenant revenue originated by the engine; reactivation revenue per 1,000 existing customers.

**V1 acceptance:** one Midwest company runs a full campaign cycle — generated, launched, leads captured, jobs booked, revenue collected — with the entire chain visible in the attribution view and the monthly report generated automatically.

---

## 17. Open Questions

1. Telephony provider for inbound call capture and transcription — build or integrate?
2. Custom domain strategy for landing pages: tenant subdomain vs. mapped domain?
3. Does Bruck's commercial/prevailing-wage work belong in V1 at all, or is this residential-first? Recommend residential-first; the commercial buyer is a different motion entirely.
4. Meta Ad Library API app review timeline — start the application now, it gates M1.
5. Pricing model for external tenants once proven — deferred until after V1 acceptance.
