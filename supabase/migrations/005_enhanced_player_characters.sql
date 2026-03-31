-- Enhanced player_characters table
-- Drop old table and recreate with full character sheet model

DROP TABLE IF EXISTS player_characters;

CREATE TABLE player_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- IDENTITY
  name TEXT NOT NULL,
  player_name TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  subclass TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,

  -- COMBAT STATS
  armor_class INTEGER NOT NULL DEFAULT 10,
  ac_source TEXT NOT NULL DEFAULT '',
  initiative_modifier INTEGER NOT NULL DEFAULT 0,
  speeds JSONB NOT NULL DEFAULT '{"walking":"30 ft."}',
  hp_max INTEGER NOT NULL DEFAULT 10,
  hit_dice_total TEXT NOT NULL DEFAULT '',
  proficiency_bonus INTEGER NOT NULL DEFAULT 2,

  -- PASSIVES & SENSES
  passive_perception INTEGER NOT NULL DEFAULT 10,
  passive_insight INTEGER,
  passive_investigation INTEGER,
  senses TEXT NOT NULL DEFAULT '',

  -- ABILITY SCORES
  str_score INTEGER NOT NULL DEFAULT 10,
  dex_score INTEGER NOT NULL DEFAULT 10,
  con_score INTEGER NOT NULL DEFAULT 10,
  int_score INTEGER NOT NULL DEFAULT 10,
  wis_score INTEGER NOT NULL DEFAULT 10,
  cha_score INTEGER NOT NULL DEFAULT 10,

  -- SKILL MODIFIERS (pre-calculated totals)
  skill_modifiers JSONB NOT NULL DEFAULT '{}',

  -- SAVING THROW MODIFIERS (pre-calculated totals)
  save_modifiers JSONB NOT NULL DEFAULT '{}',

  -- ATTACKS
  attacks JSONB NOT NULL DEFAULT '[]',

  -- DEFENSES
  damage_resistances TEXT NOT NULL DEFAULT '',
  damage_immunities TEXT NOT NULL DEFAULT '',
  condition_immunities TEXT NOT NULL DEFAULT '',

  -- PROFICIENCIES
  armor_proficiencies JSONB NOT NULL DEFAULT '{"light":false,"medium":false,"heavy":false,"shields":false}',
  weapon_proficiencies JSONB NOT NULL DEFAULT '{"simple":false,"martial":false}',
  languages TEXT NOT NULL DEFAULT '',
  tool_proficiencies TEXT NOT NULL DEFAULT '',

  -- SPELLCASTING
  is_spellcaster BOOLEAN NOT NULL DEFAULT false,
  spell_attack_bonus INTEGER,
  spell_save_dc INTEGER,
  spellcasting_ability TEXT,
  spell_slots JSONB,
  pact_slot_level INTEGER,
  pact_slot_count INTEGER,
  spells JSONB,
  is_prepared_caster BOOLEAN NOT NULL DEFAULT false,
  prepared_spells JSONB,

  -- CLASS RESOURCES
  class_resources JSONB,

  -- CLASS FEATURES
  class_features JSONB NOT NULL DEFAULT '[]',

  -- RACIAL/SPECIES TRAITS
  racial_traits JSONB,

  -- FEATS
  feats JSONB,

  -- INVENTORY
  equipment JSONB NOT NULL DEFAULT '[]',

  -- CURRENCY
  cp INTEGER NOT NULL DEFAULT 0,
  sp INTEGER NOT NULL DEFAULT 0,
  ep INTEGER NOT NULL DEFAULT 0,
  gp INTEGER NOT NULL DEFAULT 0,
  pp INTEGER NOT NULL DEFAULT 0,

  -- SOURCE PDF
  pdf_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_characters_campaign ON player_characters(campaign_id);

-- RLS
ALTER TABLE player_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage player characters for their campaigns"
  ON player_characters FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );
