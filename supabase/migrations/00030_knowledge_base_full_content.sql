-- Expand the knowledge base to cover the full product. Idempotent: categories
-- upsert by slug, articles insert ON CONFLICT (slug) DO NOTHING so re-runs and
-- the earlier seed (00029) coexist. Existing category names/order are refreshed.

-- 1) Categories ------------------------------------------------------------
INSERT INTO kb_categories (slug, name, description, position) VALUES
  ('getting-started', 'Getting Started', 'Set up your account and learn your way around Kolrabee.', 1),
  ('projects', 'Projects & Jobs', 'Create jobs and move them through the pipeline from available to paid.', 2),
  ('subcontractors', 'Subcontractors & Crews', 'Invite subs, track compliance and performance, and manage crews.', 3),
  ('photos', 'Photos & Documentation', 'Capture, organize, import, download, and share jobsite photos.', 4),
  ('time-tracking', 'Time Tracking', 'Clock crews in and out and review hours.', 5),
  ('backups', 'Backups & Storage', 'Keep copies of your job photos and documents.', 6),
  ('messaging', 'Messaging & Notifications', 'Talk to subs on a job and control email alerts.', 7),
  ('billing', 'Billing & Plans', 'Plans, limits, and managing your subscription.', 8),
  ('account', 'Account & Settings', 'Profiles, admin team, and language.', 9)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description, position = EXCLUDED.position;

-- 2) Articles --------------------------------------------------------------
INSERT INTO kb_articles (category_id, slug, title, excerpt, body, status, position)
SELECT c.id, v.slug, v.title, v.excerpt, v.body, 'published', v.position
FROM (VALUES

-- ===== Getting Started =====
('getting-started','admin-account-and-login','Create your admin account & sign in',
 'Sign up, log in at your company URL, and reset a forgotten password.',
 E'# Your admin account\n\nKolrabee gives each company its own URL (for example `app.kolrabee.com/your-company`).\n\n- **Sign up:** the first admin creates the company account from the admin signup page.\n- **Log in:** go to **/admin/login** and enter your email and password.\n- **Forgot password:** click **Forgot password** on the login screen to get a reset email.\n\nIf your company was suspended or your plan lapsed you''ll be returned to the login screen with a message — see Billing & Plans.',1),

('getting-started','admin-dashboard-overview','Understand your dashboard',
 'A CRM-style overview: KPIs, the job pipeline, things needing attention, and top subs.',
 E'# Dashboard overview\n\nThe **Dashboard** is your home base. It shows:\n\n- **KPI cards** — pipeline value, monthly revenue, active jobs, and crew count.\n- **Attention strip** — items that need action (for example jobs awaiting approval).\n- **Pipeline funnel** — counts by stage; click a stage to jump to a filtered Projects view.\n- **Recent projects** — your latest jobs at a glance.\n- **Plan usage** — how close you are to your plan limits.\n- **Top subcontractors** — your most active subs.\n- **Quick actions** — shortcuts to common tasks like creating a project.',2),

('getting-started','navigating-kolrabee','Find your way around',
 'What each section in the sidebar does.',
 E'# Navigating Kolrabee\n\nThe left sidebar groups everything:\n\n- **Dashboard** — your overview.\n- **Projects** — create and manage jobs.\n- **Subcontractors** — your roster, compliance, and ratings.\n- **Team** — your admin users.\n- **Time Tracking** — crew hours.\n- **Backup** — connect cloud storage.\n- **Help** — this knowledge base.\n- **Billing** — your plan.\n- **Photos** (Galleries, All Photos, Tags, Import) — jobsite documentation.\n\nUse the collapse control at the bottom to widen your workspace.',3),

('getting-started','guided-tours-and-tips','Guided tours & tooltips',
 'First-visit tours and the in-app tips you can toggle on or off.',
 E'# Guided tours & tips\n\nThe first time you visit key screens (dashboard, new project, subcontractor list) Kolrabee runs a short **guided tour** highlighting the important controls.\n\nThroughout the app, **tooltips** explain fields and buttons. You can turn tips on or off from the navigation menu at any time.',4),

-- ===== Projects & Jobs =====
('projects','understanding-project-statuses','Understand project statuses',
 'How a job moves from Available through Accepted, In Progress, Completed, and Paid.',
 E'# Project statuses\n\nJobs move through a pipeline:\n\n1. **Available** — posted, waiting for a sub to accept.\n2. **Accepted** — a sub has taken the job.\n3. **In Progress** — the sub has started work.\n4. **Pending Completion** — the sub requested completion (Growth plan approval step).\n5. **Completed** — work is done and approved.\n6. **Paid** — you''ve recorded payment.\n\n**Cancelled** returns a job out of the active flow. **Imported** is for CompanyCam documentation imports and stays out of the dispatch pipeline.',1),

('projects','editing-a-project','Edit a project',
 'Change customer, address, schedule, payout, links, and notes — and job-number rules.',
 E'# Editing a project\n\nOpen a project and choose **Edit** to change the customer, address, start date/time, payout, estimated labor hours, links, and notes.\n\n- **Job number** is optional but must be unique within your company.\n- **Admin notes** are internal and never shown to subcontractors.\n- Changing the start date/time on an assigned job triggers a reschedule notification — see *Reschedule a job*.',2),

('projects','rescheduling-a-job','Reschedule a job',
 'Move a job''s date/time and automatically notify the assigned subcontractor.',
 E'# Rescheduling\n\nUse **Reschedule** on a project to change its start date and time. If a sub is already assigned, saving will:\n\n- Email them the new schedule.\n- Flag the change on their dashboard until they acknowledge it.\n\nYou''ll see whether the sub has acknowledged the change on the project page. Always follow up directly for time-sensitive moves.',3),

('projects','marking-jobs-complete-and-paid','Complete and pay a job',
 'Mark work completed, approve completion on Growth, and record payment.',
 E'# Completing & paying\n\n- **Mark Completed** moves an accepted/in-progress job to Completed.\n- On the **Growth** plan, subs *request* completion and you **Approve Completion** — the sub is emailed when approved.\n- **Mark Paid** records payment, stamps the paid date, and notifies the sub. Paid jobs count toward the sub''s year-to-date earnings.\n\nYou can mark a job paid from Accepted, In Progress, Pending Completion, or Completed.',4),

('projects','cancelling-or-deleting-a-project','Cancel or delete a project',
 'When to cancel versus delete, and what happens to invitations.',
 E'# Cancelling vs deleting\n\n- **Cancel** takes a job out of the active pipeline and withdraws outstanding invitations so it disappears from every sub board. Use this once a job has been live.\n- **Delete** permanently removes a project and is only available for **available** or **cancelled** jobs that you no longer need.\n\nCancelling uses version checks to avoid conflicts if someone else is editing at the same time.',5),

('projects','job-documents','Attach job documents',
 'Upload up to three PDF/JPG/PNG files (max 10MB each) to a job.',
 E'# Job documents\n\nOn a project you can attach up to **3 files** (PDF, JPG, or PNG, up to **10MB** each) — scopes of work, permits, plans, etc.\n\nAdmins and the assigned subcontractor can download them from the project page. Remove a file anytime. For richer photo documentation, use the Photos module.',6),

('projects','work-order-and-photo-links','Work order & photo links',
 'Add external links to a work order and a photo repository on each job.',
 E'# Work order & photo links\n\nEach project has two optional link fields:\n\n- **Work Order Link** — a link to your external work order or estimate.\n- **Photo Repository Link** — a link to an external gallery (for example CompanyCam).\n\nThe photo link is only revealed to a subcontractor **after** they accept the job, along with the full address.',7),

('projects','projects-pipeline-view','Use the Projects pipeline',
 'Filter, search, and act on jobs from the status-aware Projects list.',
 E'# The Projects pipeline\n\nThe **Projects** page is a pipeline view of every job:\n\n- **Status tabs** (and an All tab) plus clickable stage cards filter the list.\n- **Search** filters across visible fields; **Assigned to** filters by subcontractor.\n- Schedule **urgency chips** flag jobs due today or overdue.\n- Each row has one status-aware primary action (Invite, Chat, Mark paid, Open) and a menu for the rest.',8),

-- ===== Subcontractors & Crews =====
('subcontractors','inviting-subcontractors-to-your-company','Invite subcontractors to your company',
 'Send a join link so a sub can create their account under your company.',
 E'# Inviting subcontractors\n\nInvite a sub to your company from the **Subcontractors** page. They receive an email with a link to your company''s join page (`/your-company/join`) where they create an account and verify their email.\n\nOnce they''ve joined they appear in your roster and can be invited to specific jobs. (Inviting a sub to your company is different from inviting them to a *job* — see *Invite subcontractors to a job*.)',1),

('subcontractors','subcontractor-list-and-profiles','Subcontractor list & profiles',
 'Read the roster: company name, YTD paid, active jobs, ratings, and history.',
 E'# Your roster\n\nThe **Subcontractors** list shows each sub by **company name** (with their contact name underneath), plus year-to-date paid, active jobs, average rating, and total jobs.\n\nOpen a sub to see their full profile and job history, compliance documents, ratings, and reliability stats. Use search and sorting to find people fast.',2),

('subcontractors','compliance-w9-and-coi','Track W-9 & insurance compliance',
 'Subs upload a W-9 and Certificate of Insurance; expirations gate compliance.',
 E'# Compliance (W-9 & COI)\n\nSubcontractors upload their **W-9** and **Certificate of Insurance (COI)** from their profile. On each sub you can view and download these documents and see the insurance provider and expiration date.\n\nA sub is considered **compliant** when they have a W-9, a COI, and non-expired insurance. Non-compliant subs are flagged so you can follow up before assigning work.',3),

('subcontractors','rating-subcontractors','Rate subs & track reliability',
 'Leave a 1–5 rating after a job and watch accept/completion rates.',
 E'# Ratings & reliability\n\nAfter a job is completed or paid you can leave a **1–5 star rating** with an optional note (a **Growth** feature). A sub''s **average rating** shows across your admin views.\n\nKolrabee also computes **reliability stats** automatically — invited, accepted, declined, completed, paid, cancelled — and surfaces **accept rate** and **completion rate** on the sub''s profile.',4),

('subcontractors','removing-a-subcontractor','Remove a subcontractor',
 'Soft delete blocks login but preserves history for accounting.',
 E'# Removing a sub\n\nDeleting a subcontractor is a **soft delete**: their status becomes deleted, they can no longer log in, and the same email can''t re-register for your company. Their name still appears on historical jobs and payment records so your accounting stays accurate.',5),

('subcontractors','crews-and-crew-members','Crews & crew members',
 'Crew leaders manage their own crew and clock them in on jobs.',
 E'# Crews\n\nA subcontractor can be a **crew leader** who manages a list of **crew members**. Crew leaders add and archive their crew from their account, and clock crew members in and out on the jobs they''ve accepted (when time tracking is enabled). Crew hours roll up alongside the leader''s on the Time Tracking screen.',6),

('subcontractors','how-subcontractors-use-kolrabee','What subcontractors see',
 'The sub experience: dashboard, accepting jobs, completing work, and profile.',
 E'# The subcontractor experience\n\nSubs sign in at your company URL and get their own dashboard:\n\n- A prominent **year-to-date earnings** card, plus **Available**, **My Jobs**, and **Paid** tabs.\n- **Before accepting**, a job shows the customer, city, date, payout, and notes — but not the full address or photo link.\n- **After accepting**, the full address and links appear. They can **Start Job**, **Mark Complete** (or request approval on Growth), or cancel.\n- Their **Profile** lets them edit contact info, change their password, upload W-9/COI, set notification preferences, and switch language.',7),

-- ===== Photos & Documentation =====
('photos','jobsite-photos','Jobsite photos',
 'Capture and upload photos to a job, with captions and capture data.',
 E'# Jobsite photos\n\nEvery project has a photo gallery. You and your crews can upload jobsite photos directly to a job; capture time and GPS are read from the image when available, and you can add a **caption**. Photos are stored per job and power the Galleries and All Photos views.',1),

('photos','photo-galleries-and-all-photos','Galleries & All Photos',
 'Browse photos by job (Galleries) or across every job (All Photos).',
 E'# Galleries & All Photos\n\n- **Galleries** shows one folder per job with recent thumbnails and a photo count — the documentation lens on your projects.\n- **All Photos** is a single grid of every photo across jobs, filterable by tag.\n\nOpen any photo in the lightbox to view it full size.',2),

('photos','tagging-photos','Tag & filter photos',
 'Use a shared tag vocabulary to organize and find photos.',
 E'# Tagging photos\n\nKolrabee keeps a tenant-wide **tag vocabulary** so your team tags consistently. Apply tags to photos (for example before, after, prep, damage, materials) and filter Galleries and All Photos by tag to find exactly what you need. Manage your tag list under **Photos → Tags**.',3),

('photos','importing-from-companycam','Import from CompanyCam',
 'Bring projects, photos, and tags over from CompanyCam.',
 E'# Importing from CompanyCam\n\nUnder **Photos → Import** you can connect CompanyCam and import your existing **projects, photos, and tags**. Imports are resilient — they retry transient errors and can be resumed — and are idempotent, so re-running won''t create duplicates. Imported documentation projects are kept out of the dispatch pipeline.',4),

('photos','downloading-and-sharing-photos','Download & share photos',
 'Download a single photo or a whole job, and create public share links.',
 E'# Downloading & sharing\n\n- **Download** a single photo from the lightbox, or **Download all** to get a job''s photos as a ZIP (zipped in your browser, so big galleries won''t time out).\n- **Share** a whole job gallery or a single photo with a public link at `/share/...` — no login required. Links **expire after 90 days** and can be revoked anytime.',5),

-- ===== Time Tracking =====
('time-tracking','enabling-time-tracking','Enable time tracking',
 'Turn on the crew time clock for a subcontractor (Growth feature).',
 E'# Enabling time tracking\n\nTime tracking is a **Growth** feature. Enable it per subcontractor from their detail page. Once on, that sub (and their crew leaders) can clock in and out on the jobs they''ve accepted.',1),

('time-tracking','crew-time-clock','Crew time clock',
 'How crews clock in and out on a job.',
 E'# The crew time clock\n\nOn an accepted job, a crew leader can **clock in** and **clock out** themselves and each crew member. Open entries (someone still on the clock) are shown clearly, and durations are totaled per person and per job. Entries are recorded with start and end times for review.',2),

('time-tracking','reviewing-time-entries','Review hours',
 'Filter time entries by sub and week, and resolve stale clock-ins.',
 E'# Reviewing hours\n\nThe **Time Tracking** screen lists all entries with clock-in, clock-out, duration, and notes. Filter by **subcontractor**, **job**, and **week**, and see weekly totals. If someone forgot to clock out, a **stale time entry** prompt helps you fix the open entry.',3),

-- ===== Backups & Storage =====
('backups','nightly-auto-backup','Nightly auto-backup',
 'Automatically back up jobs with new photos or documents every night.',
 E'# Nightly auto-backup\n\nWith Google Drive connected and **Nightly auto-backup** on, Kolrabee backs up jobs that have new photos or documents each night — no clicking required. Re-runs only upload **new** files (existing ones are skipped), so nothing is duplicated. Toggle this off on the **Backup** page if you prefer manual backups only.',3),

('backups','managing-your-drive-connection','Manage your Drive connection',
 'Disconnect, control auto-folder creation, and where files land.',
 E'# Managing your connection\n\nOn the **Backup** page you can:\n\n- **Disconnect** Google Drive (your already-backed-up files stay in your Drive).\n- Toggle **auto-create a folder for each new project**.\n- Toggle **nightly auto-backup**.\n\nBackups go into a **Kolrabee Backups** folder, with one subfolder per job containing `photos/`, `documents/`, and a README.',4),

-- ===== Messaging & Notifications =====
('messaging','job-messaging','Message subs on a job',
 'Chat with the assigned subcontractor right on the project (Growth).',
 E'# Job messaging\n\nOn the **Growth** plan you can message the assigned subcontractor directly on the job. Messages live on the project so the whole conversation stays attached to the work, and the other party can be emailed about new messages based on their preferences.',1),

('messaging','email-notifications','Email notifications',
 'The automatic emails Kolrabee sends as jobs move along.',
 E'# Email notifications\n\nKolrabee emails the right people at the right moments, including:\n\n- A sub invited to a job, and the admin when a sub **accepts**, **declines**, or **cancels**.\n- The admin when a sub marks a job **in progress** or **requests completion**.\n- The sub when completion is **approved**, when a job is **rescheduled**, when a **change order** is added, and when they''re **paid**.\n- New **message** alerts.',2),

('messaging','notification-preferences','Notification preferences',
 'Each person controls which emails they receive.',
 E'# Notification preferences\n\nEvery user can choose which emails they get from their profile — invites, updates, acceptances, cancellations, completion approvals, reschedules, change orders, and new messages. Defaults are on, so people stay informed until they opt out.',3),

-- ===== Billing & Plans =====
('billing','plans-and-pricing','Plans & pricing',
 'Free, Growth, and Operator — what each includes.',
 E'# Plans\n\n- **Free** — up to 5 projects, 3 subcontractors, 1 admin.\n- **Growth ($29/mo)** — unlimited projects and subs, in-app messaging, sub ratings, completion approval, file attachments, priority support.\n- **Operator ($49/mo)** — everything in Growth plus up to 5 company workspaces, a consolidated owner dashboard, and onboarding support.',1),

('billing','plan-limits','Plan limits',
 'What happens at the Free plan limits and during a trial.',
 E'# Plan limits\n\nThe **Free** plan caps you at 5 projects and 3 subcontractors; you''ll be prompted to upgrade when you hit a limit. Paid plans remove these caps. If a trial expires without an active subscription, creating new projects is blocked until you subscribe.',2),

('billing','upgrading-and-managing-billing','Upgrade & manage billing',
 'Subscribe, change plans, and use the billing portal.',
 E'# Managing billing\n\nGo to **Billing** to subscribe or change plans. Checkout and payment are handled securely by Stripe. Use the **billing portal** to update your card, view invoices, or cancel. Changes take effect against your plan immediately.',3),

-- ===== Account & Settings =====
('account','managing-your-admin-team','Manage your admin team',
 'Invite additional admins and see pending invites.',
 E'# Your admin team\n\nThe **Team** page lists your admin users and lets you **invite** more by email. Invitees get a link to create their admin account. You can see pending invites (with expirations) and who the account owner is. Admin seats may depend on your plan.',1),

('account','your-profile-and-password','Your profile & password',
 'Update your details and change your password.',
 E'# Profile & password\n\nUpdate your name, phone, and other contact details from your profile, and change your password there as well. Your login email is fixed to keep your account secure — contact support if it must change.',2),

('account','language-and-spanish','Language (English & Spanish)',
 'Subcontractor-facing screens support English and Spanish.',
 E'# Language\n\nKolrabee''s subcontractor-facing screens are fully available in **English and Spanish**. Subs can switch language from their account; the choice is remembered on their device so crews can work in the language they''re most comfortable with.',3)

) AS v(cat_slug, slug, title, excerpt, body, position)
JOIN kb_categories c ON c.slug = v.cat_slug
ON CONFLICT (slug) DO NOTHING;
