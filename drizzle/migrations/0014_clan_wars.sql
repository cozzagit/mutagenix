-- Clan Wars system
CREATE TABLE IF NOT EXISTS clan_wars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_clan_id UUID NOT NULL REFERENCES clans(id),
  defender_clan_id UUID NOT NULL REFERENCES clans(id),
  war_type TEXT NOT NULL DEFAULT 'sfida',
  format TEXT NOT NULL DEFAULT 'bo5',
  status TEXT NOT NULL DEFAULT 'pending',
  winner_clan_id UUID,
  challenger_elo_before INTEGER NOT NULL,
  defender_elo_before INTEGER NOT NULL,
  challenger_elo_after INTEGER,
  defender_elo_after INTEGER,
  prestige_stakes INTEGER NOT NULL DEFAULT 50,
  challenger_roster JSONB,
  defender_roster JSONB,
  challenger_wins INTEGER NOT NULL DEFAULT 0,
  defender_wins INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clan_wars_challenger ON clan_wars(challenger_clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_wars_defender ON clan_wars(defender_clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_wars_status ON clan_wars(status);

-- Clan War Matches
CREATE TABLE IF NOT EXISTS clan_war_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_war_id UUID NOT NULL REFERENCES clan_wars(id) ON DELETE CASCADE,
  match_index INTEGER NOT NULL,
  creature_1_id UUID NOT NULL REFERENCES creatures(id),
  creature_2_id UUID NOT NULL REFERENCES creatures(id),
  battle_id UUID REFERENCES battles(id),
  winner_creature_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  hp_percent_1 REAL,
  hp_percent_2 REAL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clan_war_matches_war ON clan_war_matches(clan_war_id);
