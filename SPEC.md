# TradeTap MVP — Simplified Specification
## Build this first. Add everything else later.
---
## WHAT THIS APP DOES (One Sentence)
A home services company posts jobs, invites subcontractors, tracks who accepted, and records when they're paid.
---
## TECH STACK
- **Claude Code** → builds the app from plain English instructions
- **Next.js + TypeScript + Tailwind CSS** → the actual app framework
- **Supabase** → database, auth, file storage (one platform, one dashboard)
- **Resend** → sends invitation emails (free tier: 3,000/month)
- **Vercel** → hosts and deploys automatically from GitHub
That's it. No Stripe, no Sentry, no Prisma, no separate backend server.
---
## DATABASE — 4 TABLES (down from 8)
```sql
-- TENANTS (each company using TradeTap)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_user_id UUID,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- USERS (admins and subcontractors)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_auth_id UUID UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'subcontractor')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);
-- PROJECTS (jobs posted by admin)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_by UUID NOT NULL REFERENCES users(id),
  job_number VARCHAR(50),
  customer_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  start_date DATE,
  payout_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN (
    'available',
    'accepted',
    'completed',
    'paid',
    'cancelled'
  )),
  companycam_link TEXT,
  notes TEXT,
  admin_notes TEXT,
  accepted_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- PROJECT INVITATIONS
CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  subcontractor_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, subcontractor_id)
);
-- ROW LEVEL SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
-- INDEXES
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_projects_tenant_status ON projects(tenant_id, status);
CREATE INDEX idx_invitations_sub ON project_invitations(subcontractor_id);
CREATE INDEX idx_invitations_project ON project_invitations(project_id);
```
### What got cut from the database:
- `activity_log` table — you have 5 customers, you don't need audit trails yet
- `notifications` table — just send emails, don't track them in a database
- `daily_reports` table — add this in v2 after you have paying customers
- `report_media` table — goes with daily reports
- All tenant branding fields (logo_url, primary_color) — every company sees the same TradeTap branding
- All Stripe fields — invoice your first 5 customers manually
- All plan limit fields — you manage 5 tenants yourself
- Notification preferences — everyone gets emails, period
- Invitation expiration — keep it simple, invitations stay until accepted or admin cancels
- Report locking fields — no reports in v1
---
## PROJECT STATUSES — 5 (down from 8)
```
Available → Accepted → Completed → Paid
                                  ↘ Cancelled (returns to Available)
```
### What got cut:
- **Draft** — just create it as available. If you're not ready, don't create it yet.
- **In Progress** — unnecessary distinction from "Accepted." The sub accepted it and is working on it. That's the same thing.
- **Removed** — just cancel it. If you need it back, create a new one.
---
## USER ROLES — 2 (down from 3)
- **Admin** — does everything (creates projects, invites subs, marks paid)
- **Subcontractor** — views invitations, accepts jobs, sees payment history
### What got cut:
- **Owner** role — for 5 customers, every admin is the owner. Add role separation when you have companies with multiple managers.
---
## SCREENS TO BUILD
### Admin Side (6 screens)
**1. Admin Dashboard**
- Tab bar: Available | Accepted | Completed | Paid
- Each tab shows a list/table of projects in that status
- Sorted by start date (soonest first)
- Search bar at top filters across all visible fields
- Click a project → opens detail view
**2. Create/Edit Project**
- Form: Job Number, Customer Name, Address, Start Date, Payout, CompanyCam Link, Notes, Admin Notes
- Save → project appears in Available tab
**3. Project Detail**
- Shows all project info
- If Available: "Invite Subs" button
- If Accepted: shows which sub, "Mark Completed" button
- If Completed: "Mark Paid" button
- "Cancel" button (returns to Available regardless of current status)
**4. Invite Subs Modal**
- Opens from Project Detail
- Shows list of all active subs with checkboxes
- "Select All" option
- "Send Invitations" → sends email to each selected sub
**5. Subcontractor List**
- Table: Name, Email, Phone, Status, YTD Paid, Active Jobs
- Click a sub → shows their project history
- "Delete" option (soft delete — blocks login and re-registration, preserves history)
**6. Admin Login / Forgot Password**
### Subcontractor Side (4 screens)
**1. Sub Dashboard**
- Large YTD earnings card at top (calculated dynamically — not stored)
- Tab bar: Available | My Jobs | Paid
- Available = projects they've been invited to
- My Jobs = accepted projects (shows full address + CompanyCam link)
- Paid = completed and paid projects
**2. Project Detail (Sub View)**
- Shows: Job Number, Customer Name, City only (not full address), Start Date, Payout
- "Accept" button with confirmation
- After acceptance: shows full address and CompanyCam link
**3. Sub Profile**
- Name, email, phone (editable)
- Password change
**4. Sub Signup / Login / Forgot Password**
- Signup at tenant-specific URL: `app.tradetap.com/[slug]/join`
- Email verification required
### Total: 10 screens (down from ~25+)
---
## EMAIL NOTIFICATIONS — 3 (down from 10+)
1. **Sub invited to project** → email with job number, customer name, city, start date, payout, login link
2. **Sub accepts project** → email to admin with sub name, job details
3. **Sub cancels accepted project** → email to admin
That's it. No invitation expiration emails, no payment confirmation emails, no trial warnings, no daily report notifications. Those are all nice-to-haves for later.
### Email setup:
- One Resend account, one email template per notification type
- From: `notifications@tradetap.com`
- No customizable templates — every tenant gets the same email with their company name inserted
- No unsubscribe link needed yet (CAN-SPAM applies at scale, not for 5 customers sending 20 emails/month)
---
## WHAT THE SUB SEES vs WHAT THEY DON'T
**Before accepting a project:**
- Job Number, Customer Name, City (NOT full address), Start Date, Payout, Notes
- No CompanyCam link, no full address
**After accepting:**
- Everything above PLUS full address and CompanyCam link
This is the same behavior as your Bubble app. It prevents subs from going directly to the customer.
---
## RACE CONDITION PROTECTION (Keep This)
This is one piece of complexity worth keeping. When two subs click "Accept" on the same project simultaneously, only one wins:
```sql
UPDATE projects
SET status = 'accepted', accepted_by = :sub_id, version = version + 1
WHERE id = :project_id AND status = 'available' AND version = :expected_version
RETURNING *;
```
If the update affects 0 rows → "This project was just accepted by another subcontractor."
---
## SOFT DELETE (Keep This)
When admin deletes a sub:
- Status → 'deleted'
- Sub can't log in
- Same email can't re-register for that tenant
- Sub's name still shows on historical projects and payment records
This is critical for accounting accuracy and was a specific design decision in your Bubble app.
---
## YTD EARNINGS (Keep This — But Simplified)
Always calculated, never stored:
```sql
SELECT COALESCE(SUM(payout_amount), 0)
FROM projects
WHERE accepted_by = :sub_id AND status = 'paid'
  AND paid_at >= date_trunc('year', NOW())
```
Displayed prominently on the sub's dashboard. This is motivational and was a specific feature request during Bubble development.
---
## FEATURE STATUS TRACKER

_Last verified against `main` on 2026-08-24._

### Built (shipped beyond the original MVP spec)

| Feature | Notes |
|---|---|
| Stripe billing | Checkout, portal, webhooks, 4 plan tiers (free/trial/growth/operator) |
| Super admin panel | Platform stats, tenant management, impersonation, tenant detail |
| W-9 / COI uploads | Subs upload from profile, admins view/download, compliance gating |
| Spanish / i18n | Full English + Spanish on sub-facing pages, localStorage toggle |
| Guided tours + tooltips | First-visit tours and per-screen tooltips, toggle in nav |
| Notification preferences | Per-user JSONB toggles for email notifications |
| Plan limit enforcement | `max_projects` and `max_subcontractors` enforced per plan |
| **Job file attachments** | `project_attachments`, max 3 per job, admin + sub views |
| **Time tracking** | Clock in/out, crew clock, daily hours digest, stale-entry guardrails, CSV export |
| **Photo module** | Galleries, tags, CompanyCam import, public share links, EXIF |
| **Job messaging** | Per-job chat for admin and sub, with email notifications |
| **Change orders** | Added against a job, with notification |
| **Job map** | Geocoded job locations with stage filters, admin and sub views |
| **Crew members** | Crew leaders manage a roster and clock their crew in |
| **Sub ratings** | Star ratings and reliability stats |
| **Cloud backup** | Google Drive integration plus a nightly cron |
| **Knowledge base / Help** | In-app help pages |
| **Structured addresses** | Street/city/state/zip on create and edit; city-only stays city-only pre-acceptance |
| **Sub deactivation** | `inactive` status keeps history but stops dispatch |

### Parked

| Feature | Status |
|---|---|
| Marketing Engine (Leads / Prospects / Market Intel) | Built, then parked product-wide behind `NEXT_PUBLIC_MARKETING_ENGINE` (default off) plus the per-tenant `marketing_enabled` flag. Focus is the core dispatch job. |
| Bid board | ~3,700 lines on `feature/bid-board-v1`, never merged. Bidding is a different product from dispatch. |
| Ads Agent | AI ad-creative add-on on `claude/brave-cori-MyzGc`. PR closed. |

### Partially built

| Feature | What's missing |
|---|---|
| Multi-company workspaces | DB supports multiple tenants per owner. No workspace switcher, no "create workspace" flow. Pricing advertises up to 5 for Operator. |
| Multiple admin users per tenant | DB allows multiple admins. No enforcement of admin count limits, no billing UI for extra admins. |

### Not yet built

| Feature | Priority |
|---|---|
| Activity / audit log | V2 |
| In-app notification bell | V2 |
| CSV export beyond time tracking (projects, subs, payments) | V2 |
| Daily progress reports + photos | V2 |
| Data export / GDPR | V2 |
| Self-serve account deletion | V2 |
| Consolidated owner dashboard | V2 — requires multi-workspace |
| Custom branding per tenant | V3 |
| Custom email templates | V3 |
| Multi-company sub login | V3 |
| Native mobile app / offline / push | V3 |

---

## V2 TRIGGER: When To Build More

Add daily reports when: 3+ customers ask for it
Add multi-workspace switcher when: first Operator plan subscriber signs up
Add admin count enforcement when: Stripe billing is live and plans are enforced
Add branding when: a customer specifically asks to white-label it
Add native mobile when: subs complain the responsive web isn't good enough
Un-park the bid board when: bidding, not dispatch, is the job to be done

**Don't build features because they'd be cool. Build them because a customer is asking for them or you physically can't operate without them.**
