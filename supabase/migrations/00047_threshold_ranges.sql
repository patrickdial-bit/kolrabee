-- Guardrails become admin-configurable ranges: a floor AND a ceiling per
-- metric, instead of the fixed one-sided 30/14/50 rules.
--
-- Floors matter too: a bid with suspiciously low materials usually means
-- something was forgotten, not that it's extra profitable; a labor % far
-- under range suggests the hours are underestimated. Defaults (floor 0,
-- ceiling 100 where no bound existed) reproduce today's behavior exactly,
-- so nothing changes until an admin tightens them.
--
-- Column naming: the pre-existing labor_max_pct / materials_max_pct /
-- min_profit_margin_pct keep their names as the ceiling/floor of their
-- ranges; the new columns fill in the missing side.

ALTER TABLE profit_thresholds
  ADD COLUMN labor_min_pct NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN materials_min_pct NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN profit_max_pct NUMERIC NOT NULL DEFAULT 100;

ALTER TABLE profit_thresholds
  ADD CONSTRAINT profit_thresholds_ranges_valid CHECK (
    labor_min_pct >= 0 AND labor_max_pct <= 100 AND labor_min_pct <= labor_max_pct
    AND materials_min_pct >= 0 AND materials_max_pct <= 100 AND materials_min_pct <= materials_max_pct
    AND min_profit_margin_pct >= 0 AND profit_max_pct <= 100 AND min_profit_margin_pct <= profit_max_pct
  );
