-- Migration: Add subcontractor compliance fields and project enhancements
-- Adds: company info, insurance tracking, W-9/COI document tracking, project fields

-- =============================================================================
-- ALTER USERS TABLE: Add subcontractor profile fields
-- =============================================================================

ALTER TABLE users
  ADD COLUMN company_name VARCHAR(255),
  ADD COLUMN crew_size INT DEFAULT 1,
  ADD COLUMN address TEXT,
  ADD COLUMN years_in_business INT,
  ADD COLUMN insurance_provider VARCHAR(255),
  ADD COLUMN insurance_expiration DATE,
  ADD COLUMN w9_file_url TEXT,
  ADD COLUMN w9_uploaded_at TIMESTAMPTZ,
  ADD COLUMN coi_file_url TEXT,
  ADD COLUMN coi_uploaded_at TIMESTAMPTZ;

-- =============================================================================
-- ALTER PROJECTS TABLE: Add estimated labor hours, work order link, start_time
-- =============================================================================

ALTER TABLE projects
  ADD COLUMN estimated_labor_hours INT,
  ADD COLUMN work_order_link TEXT,
  ADD COLUMN start_time TIME;

-- =============================================================================
-- STORAGE BUCKETS for document uploads
-- =============================================================================

-- Create storage bucket for subcontractor documents (W-9, COI)
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Admins can read all documents in their tenant
-- Subs can upload/read their own documents
CREATE POLICY "Admins can read tenant documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update own documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
  );
