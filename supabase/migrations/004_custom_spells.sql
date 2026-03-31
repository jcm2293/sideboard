-- Custom (homebrew) spells per campaign
CREATE TABLE custom_spells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  school TEXT NOT NULL DEFAULT '',
  casting_time TEXT NOT NULL DEFAULT '',
  range TEXT NOT NULL DEFAULT '',
  components_v BOOLEAN NOT NULL DEFAULT false,
  components_s BOOLEAN NOT NULL DEFAULT false,
  components_m BOOLEAN NOT NULL DEFAULT false,
  material_description TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  concentration BOOLEAN NOT NULL DEFAULT false,
  ritual BOOLEAN NOT NULL DEFAULT false,
  description TEXT NOT NULL DEFAULT '',
  higher_levels TEXT NOT NULL DEFAULT '',
  classes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_spells_campaign ON custom_spells(campaign_id);

-- RLS
ALTER TABLE custom_spells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage custom spells for their campaigns"
  ON custom_spells FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );
