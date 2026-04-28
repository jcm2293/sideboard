-- Persist multiclass detection so the spell-slot verification banner
-- shows even after the parsed character is saved.
-- True iff the D&D Beyond CLASS LEVEL field had multiple "/"-separated entries.

ALTER TABLE player_characters
  ADD COLUMN is_multiclass BOOLEAN NOT NULL DEFAULT false;
