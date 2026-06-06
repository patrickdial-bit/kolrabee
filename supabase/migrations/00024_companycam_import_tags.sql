-- CompanyCam import: tag-import phase. Adds progress columns for the two extra
-- phases (tag_vocab → tag_links) appended after the photos phase.
ALTER TABLE companycam_import_jobs ADD COLUMN IF NOT EXISTS tag_index INT NOT NULL DEFAULT 0;
ALTER TABLE companycam_import_jobs ADD COLUMN IF NOT EXISTS tags_done  INT NOT NULL DEFAULT 0;
