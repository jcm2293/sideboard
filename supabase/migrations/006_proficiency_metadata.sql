-- Add proficiency metadata to player_characters.
--
-- Pre-calculated skill_modifiers and save_modifiers stay the source of truth
-- for what gets shown on the sheet (and exported in the PDF).
-- These two new columns track WHY each modifier is what it is —
-- whether the character is proficient, has expertise, etc.
-- Used by the edit view to show toggles; not used in PDF export.
--
-- Values: 'none' | 'half' | 'proficient' | 'expertise'
-- Saves only use 'none' | 'proficient' (5e doesn't have half/expertise on saves).

ALTER TABLE player_characters
  ADD COLUMN skill_proficiencies JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN save_proficiencies  JSONB NOT NULL DEFAULT '{}';
