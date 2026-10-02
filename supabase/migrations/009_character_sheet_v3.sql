-- Character sheet v3: structured fields from the D&D Beyond import
-- (docs/character-sheet-spec-v3.md §2).
--
-- All nullable with no defaults: homebrew-wizard characters and existing rows
-- don't have them, and the PDF renderer falls back to the older columns when
-- they're absent. New FeatureEntry / AttackEntry / ClassResource keys live
-- inside the existing jsonb columns and need no migration.

ALTER TABLE player_characters
  ADD COLUMN species TEXT,
  ADD COLUMN background TEXT,
  ADD COLUMN classes JSONB,
  ADD COLUMN spell_details JSONB,
  ADD COLUMN weapon_masteries JSONB,
  ADD COLUMN grapple_shove_dc INTEGER,
  ADD COLUMN feature_dc JSONB;
