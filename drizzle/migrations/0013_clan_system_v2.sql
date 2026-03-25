-- Extend clans table
ALTER TABLE clans ADD COLUMN IF NOT EXISTS clan_elo INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS clan_elo_peak INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS prestige INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS emblem_color TEXT;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'forming';
ALTER TABLE clans ADD COLUMN IF NOT EXISTS clan_wins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS clan_losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS max_members INTEGER NOT NULL DEFAULT 15;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS energy_vault INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS description TEXT;

-- Extend clan_memberships
ALTER TABLE clan_memberships ADD COLUMN IF NOT EXISTS is_traitor BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clan_memberships ADD COLUMN IF NOT EXISTS contribution_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clan_memberships ADD COLUMN IF NOT EXISTS vulnerability_until TIMESTAMPTZ;

-- Update existing roles
UPDATE clan_memberships SET role = 'boss' WHERE role = 'founder';
UPDATE clan_memberships SET role = 'soldato' WHERE role = 'member';

-- Add traitor fields to creatures
ALTER TABLE creatures ADD COLUMN IF NOT EXISTS is_traitor BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE creatures ADD COLUMN IF NOT EXISTS betrayed_clan_name TEXT;

-- Clan invitations table
CREATE TABLE IF NOT EXISTS clan_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  creature_id UUID NOT NULL REFERENCES creatures(id),
  inviter_user_id UUID NOT NULL REFERENCES users(id),
  target_user_id UUID NOT NULL REFERENCES users(id),
  direction TEXT NOT NULL DEFAULT 'invite',
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clan_invitations_clan ON clan_invitations(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_invitations_target ON clan_invitations(target_user_id);
