-- Track admin-initiated reschedules on projects so the system can highlight
-- recent date/time changes and the subcontractor can be notified.
--
-- schedule_changed_at: when the admin most recently changed start_date or start_time.
-- previous_start_date / previous_start_time: the values right before that change,
--   so the UI can show "moved from X to Y".
-- schedule_change_acknowledged_at: set when the assigned sub has seen the highlight
--   on their project page (used to dismiss the banner without losing audit trail).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS schedule_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_start_date DATE,
  ADD COLUMN IF NOT EXISTS previous_start_time TIME,
  ADD COLUMN IF NOT EXISTS schedule_change_acknowledged_at TIMESTAMPTZ;
