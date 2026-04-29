-- Spell save DC and spell attack bonus are deterministic from
-- (proficiency_bonus + spellcasting ability modifier) and should NOT be stored.
--
-- Rename the existing columns to *_override so they keep their values but become
-- explicit "override the calculation" knobs (mostly used when a magic item or
-- feature pushes these numbers off the standard formula).
--
-- App reads the override if non-null, otherwise computes from PB + ability mod.

ALTER TABLE player_characters
  RENAME COLUMN spell_attack_bonus TO spell_attack_bonus_override;

ALTER TABLE player_characters
  RENAME COLUMN spell_save_dc TO spell_save_dc_override;
