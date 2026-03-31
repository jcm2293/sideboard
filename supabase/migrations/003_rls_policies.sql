-- Enable RLS on all tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE lore_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE plot_arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE builder_messages ENABLE ROW LEVEL SECURITY;

-- Campaigns: users can only access their own
CREATE POLICY "Users can manage their own campaigns"
  ON campaigns FOR ALL USING (auth.uid() = user_id);

-- All other tables: access gated through campaign ownership
CREATE POLICY "Users can manage world meta for their campaigns"
  ON world_meta FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage lore entries for their campaigns"
  ON lore_entries FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage plot arcs for their campaigns"
  ON plot_arcs FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage locations for their campaigns"
  ON locations FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage factions for their campaigns"
  ON factions FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage npcs for their campaigns"
  ON npcs FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage items for their campaigns"
  ON items FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage sessions for their campaigns"
  ON sessions FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage scenes for their sessions"
  ON scenes FOR ALL USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN campaigns c ON s.campaign_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage encounters for their scenes"
  ON encounters FOR ALL USING (
    scene_id IN (
      SELECT sc.id FROM scenes sc
      JOIN sessions s ON sc.session_id = s.id
      JOIN campaigns c ON s.campaign_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage stat blocks for their campaigns"
  ON stat_blocks FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage session logs for their sessions"
  ON session_logs FOR ALL USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN campaigns c ON s.campaign_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage player characters for their campaigns"
  ON player_characters FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage builder messages for their campaigns"
  ON builder_messages FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );
