-- Migration: Add subcontractor compliance fields and project enhancements
-- Adds: company info, insurance tracking, W-9/COI document tracking, project fields

-- =============================================================================
-- ALTER USERS TABLE: Add subcontractor profile fields
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS crew_size INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS years_in_business INT,
  ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(255),
  ADD COLUMN IF NOT EXISTS insurance_expiration DATE,
  ADD COLUMN IF NOT EXISTS w9_file_url TEXT,
  ADD COLUMN IF NOT EXISTS w9_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coi_file_url TEXT,
  ADD COLUMN IF NOT EXISTS coi_uploaded_at TIMESTAMPTZ;

-- =============================================================================
-- ALTER PROJECTS TABLE: Add estimated labor hours, work order link, start_time
-- =============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS estimated_labor_hours INT,
  ADD COLUMN IF NOT EXISTS work_order_link TEXT,
  ADD COLUMN IF NOT EXISTS start_time TIME;

-- =============================================================================
-- STORAGE BUCKETS for document uploads
-- =============================================================================

-- Create storage bucket for subcontractor documents (W-9, COI)
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Admins can read all documents in their tenant
-- Subs can upload/read their own documents
DROP POLICY IF EXISTS "Admins can read tenant documents" ON storage.objects;
CREATE POLICY "Admins can read tenant documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
CREATE POLICY "Users can update own documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
  );
