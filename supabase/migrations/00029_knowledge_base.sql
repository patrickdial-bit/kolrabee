-- Knowledge base — a platform help center authored by Kolrabee (super admin)
-- documenting how admins use the app. Global (not tenant-scoped): every admin
-- reads the same library. Search is native Postgres full-text (tsvector + GIN).

CREATE TABLE IF NOT EXISTS kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES kb_categories(id) ON DELETE SET NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  excerpt TEXT,
  body TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  position INT NOT NULL DEFAULT 0,
  -- Weighted full-text vector: title (A) ranks above body (B). Generated +
  -- stored so it stays in sync with no app-side bookkeeping.
  search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_search ON kb_articles USING GIN (search);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);

ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;

-- Reads: help content is the same for everyone signed in. Categories are public
-- to read; only PUBLISHED articles are readable. Writes happen via the
-- service-role client (super-admin authoring), which bypasses RLS — so there are
-- deliberately no write policies.
DROP POLICY IF EXISTS "Anyone can read kb categories" ON kb_categories;
CREATE POLICY "Anyone can read kb categories"
  ON kb_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read published kb articles" ON kb_articles;
CREATE POLICY "Anyone can read published kb articles"
  ON kb_articles FOR SELECT USING (status = 'published');

-- Ranked full-text search over published articles. Returns a highlighted
-- snippet using non-HTML markers («/») so the app can escape first, then swap
-- in <mark> safely. plpgsql so the body is parsed at call time. Service-role
-- only (the app calls it through the service-role client).
CREATE OR REPLACE FUNCTION search_kb(q TEXT, max_results INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  category_name TEXT,
  category_slug TEXT,
  headline TEXT,
  rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tsq tsquery := websearch_to_tsquery('english', q);
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.slug::text,
    a.title::text,
    c.name::text,
    c.slug::text,
    ts_headline(
      'english',
      coalesce(nullif(a.excerpt, ''), a.body),
      tsq,
      'StartSel=«, StopSel=», MaxFragments=2, MaxWords=28, MinWords=8, FragmentDelimiter=" … "'
    ),
    ts_rank(a.search, tsq)
  FROM kb_articles a
  LEFT JOIN kb_categories c ON c.id = a.category_id
  WHERE a.status = 'published' AND a.search @@ tsq
  ORDER BY ts_rank(a.search, tsq) DESC
  LIMIT max_results;
END;
$$;

REVOKE ALL ON FUNCTION search_kb(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION search_kb(TEXT, INT) FROM anon;
REVOKE ALL ON FUNCTION search_kb(TEXT, INT) FROM authenticated;

-- ---------------------------------------------------------------------------
-- Seed starter content so the KB is useful (and searchable) on day one.
-- ---------------------------------------------------------------------------
INSERT INTO kb_categories (slug, name, description, position) VALUES
  ('getting-started', 'Getting Started', 'The basics of running your jobs in Kolrabee.', 1),
  ('projects', 'Projects & Subcontractors', 'Create jobs, invite subs, and move work through the pipeline.', 2),
  ('backups', 'Backups & Storage', 'Keep copies of your job photos and documents.', 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO kb_articles (category_id, slug, title, excerpt, body, status, position)
SELECT c.id, v.slug, v.title, v.excerpt, v.body, 'published', v.position
FROM (VALUES
  (
    'getting-started',
    'create-your-first-project',
    'Create your first project',
    'Post a job with customer, address, schedule, and payout so subcontractors can be invited.',
    E'# Create your first project\n\nGo to **Projects → New Project**. Fill in the customer name, address, start date, and payout amount. Optional fields include job number, estimated labor hours, a work-order link, a photo-repository link, and notes.\n\nSave the project and it appears in the **Available** stage, ready for you to invite subcontractors.',
    1
  ),
  (
    'projects',
    'invite-subcontractors',
    'Invite subcontractors to a job',
    'Send a job to one or more subs; the first to accept is assigned and others are notified.',
    E'# Invite subcontractors\n\nOpen a project and choose **Invite Subs**. Select the subcontractors to invite and send. Each invited sub gets an email and sees the job on their dashboard.\n\nWhen a sub accepts, the job moves to **Accepted** and is assigned to them. Other invitees can no longer take it.',
    1
  ),
  (
    'projects',
    'change-orders',
    'Adjust scope and pay with change orders',
    'Record a dated, signed adjustment to a job''s payout instead of silently editing the amount.',
    E'# Change orders\n\nNeed to add or reduce scope after a job is posted? On the project page, open **Change Orders → Add Change Order**. Enter a positive amount to add pay or a negative amount to reduce it, plus a short description of what changed.\n\nThe change rolls into the job''s running payout and is logged as an audit trail (original payout + change orders = current total). The assigned subcontractor is emailed about the change.',
    2
  ),
  (
    'backups',
    'download-a-job-backup-zip',
    'Download a job backup (ZIP)',
    'Get a local ZIP of a job''s photos and documents from the project page or photo gallery.',
    E'# Download a job backup\n\nOn a project''s detail page (or its photo gallery), click **Download Backup**. Kolrabee bundles the job''s photos and documents into a single ZIP organized as `photos/`, `documents/`, and a `README.txt` manifest.\n\nThis works with no setup and is a quick way to hand a full job archive to someone or keep an offline copy.',
    1
  ),
  (
    'backups',
    'connect-google-drive',
    'Back up jobs to Google Drive',
    'Connect your Google Drive so each job gets a folder and its files are backed up automatically.',
    E'# Back up to Google Drive\n\nGo to **Backup** and choose **Connect Google Drive**, then approve access. Once connected:\n\n- A folder is created for each new project under your **Kolrabee Backups** folder.\n- Use **Back up to Drive** on a job to push its photos and documents (re-running only uploads new files).\n- With **Nightly auto-backup** on, jobs with new photos or documents are backed up automatically each night.\n\nYou can disconnect or turn off auto-backup anytime on the Backup page.',
    2
  )
) AS v(cat_slug, slug, title, excerpt, body, position)
JOIN kb_categories c ON c.slug = v.cat_slug
ON CONFLICT (slug) DO NOTHING;
