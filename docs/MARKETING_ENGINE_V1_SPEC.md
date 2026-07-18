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
```

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

**Phase 1 — Prove the loop (target: 4–6 weeks)**
M4 lead capture → M5 booking/dispatch handoff → M6 attribution.
Run against the existing 1st Impressions Meta campaign. Goal: one lead traced end-to-end to collected revenue. Nothing else ships until this works.

**Phase 2 — Generate demand**
M2 campaign generator + M3 landing pages. Launch one campaign per Midwest company.

**Phase 3 — Govern it**
M8 capacity governor. This is where the product becomes defensible.

**Phase 4 — Mine the base**
M7 reactivation. Fastest revenue payback of any module.

**Phase 5 — Intelligence**
M1 market intelligence. Deliberately last: it is the best *demo* and the least important *function*. Building it first is the classic trap.

---

## 15. Compliance Guardrails

Non-negotiable, enforced in code:

1. Public data sources only. No authenticated scraping, no anti-bot circumvention. See C1.
2. SMS requires documented opt-in. TCPA exposure is real and expensive.
3. AI agent identifies itself as an assistant on request.
4. Meta and Google ad policy pre-checks before submission — auto-generated creative gets accounts banned.
5. No storage of personal data beyond what the job requires.
6. All competitor data limited to publicly disclosed advertiser information. No individual profiling.

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
