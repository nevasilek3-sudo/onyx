CREATE TABLE IF NOT EXISTS user_icons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  icon_data TEXT NOT NULL,          -- base64 encoded image data
  mime_type VARCHAR(32) NOT NULL DEFAULT 'image/png',
  selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_icons_user_id ON user_icons(user_id);
