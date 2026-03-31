-- Sideboard Phase 1 Schema
-- Run against Supabase when connected

CREATE TYPE lore_category AS ENUM ('history', 'geography', 'culture', 'religion', 'magic', 'politics', 'other');
CREATE TYPE plot_status AS ENUM ('active', 'resolved', 'abandoned');
CREATE TYPE session_status AS ENUM ('planning', 'upcoming', 'completed');
CREATE TYPE item_type AS ENUM ('weapon', 'armor', 'potion', 'quest_item', 'wondrous', 'other');

-- Campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);

-- World Meta (one per campaign)
CREATE TABLE world_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
  tone TEXT NOT NULL DEFAULT '',
  tech_level TEXT NOT NULL DEFAULT '',
  themes TEXT[] NOT NULL DEFAULT '{}',
  magic_system TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

-- Lore Entries
CREATE TABLE lore_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category lore_category NOT NULL DEFAULT 'other',
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lore_entries_campaign ON lore_entries(campaign_id);
CREATE INDEX idx_lore_entries_category ON lore_entries(campaign_id, category);

-- Plot Arcs
CREATE TABLE plot_arcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status plot_status NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plot_arcs_campaign ON plot_arcs(campaign_id);

-- Locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_campaign ON locations(campaign_id);
CREATE INDEX idx_locations_parent ON locations(parent_id);

-- Factions
CREATE TABLE factions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goals TEXT NOT NULL DEFAULT '',
  leader TEXT NOT NULL DEFAULT '',
  alignment TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_factions_campaign ON factions(campaign_id);

-- Stat Blocks (Bestiary)
CREATE TABLE stat_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT 'Medium',
  type TEXT NOT NULL DEFAULT '',
  alignment TEXT NOT NULL DEFAULT '',
  armor_class INTEGER NOT NULL DEFAULT 10,
  hit_points TEXT NOT NULL DEFAULT '',
  speed TEXT NOT NULL DEFAULT '30 ft.',
  str INTEGER NOT NULL DEFAULT 10,
  dex INTEGER NOT NULL DEFAULT 10,
  con INTEGER NOT NULL DEFAULT 10,
  int INTEGER NOT NULL DEFAULT 10,
  wis INTEGER NOT NULL DEFAULT 10,
  cha INTEGER NOT NULL DEFAULT 10,
  saving_throws TEXT NOT NULL DEFAULT '',
  skills TEXT NOT NULL DEFAULT '',
  damage_resistances TEXT NOT NULL DEFAULT '',
  damage_immunities TEXT NOT NULL DEFAULT '',
  condition_immunities TEXT NOT NULL DEFAULT '',
  senses TEXT NOT NULL DEFAULT '',
  languages TEXT NOT NULL DEFAULT '',
  challenge_rating TEXT NOT NULL DEFAULT '0',
  traits TEXT NOT NULL DEFAULT '',
  actions TEXT NOT NULL DEFAULT '',
  reactions TEXT NOT NULL DEFAULT '',
  legendary_actions TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stat_blocks_campaign ON stat_blocks(campaign_id);

-- NPCs
CREATE TABLE npcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  race TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  alignment TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  motivations TEXT NOT NULL DEFAULT '',
  secrets TEXT NOT NULL DEFAULT '',
  connections TEXT NOT NULL DEFAULT '',
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  faction_id UUID REFERENCES factions(id) ON DELETE SET NULL,
  stat_block_id UUID REFERENCES stat_blocks(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_npcs_campaign ON npcs(campaign_id);
CREATE INDEX idx_npcs_location ON npcs(location_id);
CREATE INDEX idx_npcs_faction ON npcs(faction_id);

-- Items
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type item_type NOT NULL DEFAULT 'other',
  rarity TEXT NOT NULL DEFAULT 'common',
  description TEXT NOT NULL DEFAULT '',
  properties TEXT NOT NULL DEFAULT '',
  attunement BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_campaign ON items(campaign_id);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  session_number INTEGER NOT NULL DEFAULT 1,
  status session_status NOT NULL DEFAULT 'planning',
  date DATE,
  summary TEXT NOT NULL DEFAULT '',
  prep_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_campaign ON sessions(campaign_id);

-- Scenes
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  dm_notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  npc_ids UUID[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_scenes_session ON scenes(session_id);

-- Encounters
CREATE TABLE encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  stat_block_ids UUID[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_encounters_scene ON encounters(scene_id);

-- Session Logs
CREATE TABLE session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_logs_session ON session_logs(session_id);

-- Player Characters
CREATE TABLE player_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  player_name TEXT NOT NULL DEFAULT '',
  race TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  armor_class INTEGER NOT NULL DEFAULT 10,
  hit_points INTEGER NOT NULL DEFAULT 10,
  backstory TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_characters_campaign ON player_characters(campaign_id);

-- RLS Policies (enable when Supabase is connected)
-- ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can only see their own campaigns"
--   ON campaigns FOR ALL USING (auth.uid() = user_id);
--
-- ALTER TABLE world_meta ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can manage world meta for their campaigns"
--   ON world_meta FOR ALL USING (
--     campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
--   );
--
-- Repeat similar policies for all other tables, checking campaign ownership.
