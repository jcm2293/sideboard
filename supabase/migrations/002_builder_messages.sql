-- Builder Messages for Campaign Builder AI chat
CREATE TABLE IF NOT EXISTS builder_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  proposed_elements JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_builder_messages_campaign ON builder_messages(campaign_id);
CREATE INDEX idx_builder_messages_created ON builder_messages(campaign_id, created_at);
