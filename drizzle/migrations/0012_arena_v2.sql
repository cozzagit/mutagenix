-- Arena V2 Phase 1 — Squads, Tournaments, and battle mode extensions

-- Squads table (one per user)
CREATE TABLE IF NOT EXISTS "squads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") UNIQUE,
  "slot1_id" uuid REFERENCES "creatures"("id"),
  "slot2_id" uuid REFERENCES "creatures"("id"),
  "slot3_id" uuid REFERENCES "creatures"("id"),
  "reserve1_id" uuid REFERENCES "creatures"("id"),
  "reserve2_id" uuid REFERENCES "creatures"("id"),
  "reserve3_id" uuid REFERENCES "creatures"("id"),
  "auto_rotate" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Tournaments table
CREATE TABLE IF NOT EXISTS "tournaments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "tournament_type" text NOT NULL DEFAULT 'knockout',
  "status" text NOT NULL DEFAULT 'draft',
  "battle_format" text NOT NULL DEFAULT '3v3',
  "max_participants" integer,
  "min_participants" integer NOT NULL DEFAULT 4,
  "entry_fee" integer NOT NULL DEFAULT 0,
  "rules" jsonb DEFAULT '{}',
  "prizes" jsonb DEFAULT '[]',
  "schedule" jsonb DEFAULT '{}',
  "current_round" integer NOT NULL DEFAULT 0,
  "total_rounds" integer,
  "enrollment_start" timestamp with time zone,
  "enrollment_end" timestamp with time zone,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Tournament participants
CREATE TABLE IF NOT EXISTS "tournament_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "squad_snapshot" jsonb NOT NULL,
  "accumulated_damage" jsonb DEFAULT '{}',
  "matches_played" integer NOT NULL DEFAULT 0,
  "matches_won" integer NOT NULL DEFAULT 0,
  "matches_lost" integer NOT NULL DEFAULT 0,
  "matches_drawn" integer NOT NULL DEFAULT 0,
  "points" integer NOT NULL DEFAULT 0,
  "is_eliminated" boolean NOT NULL DEFAULT false,
  "seed" integer,
  "status" text NOT NULL DEFAULT 'active',
  "enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tournament_participants_tournament_user_unique" UNIQUE("tournament_id", "user_id")
);

-- Tournament matches
CREATE TABLE IF NOT EXISTS "tournament_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE CASCADE,
  "round_number" integer NOT NULL,
  "participant1_id" uuid NOT NULL REFERENCES "tournament_participants"("id"),
  "participant2_id" uuid NOT NULL REFERENCES "tournament_participants"("id"),
  "match_format" text NOT NULL DEFAULT '3v3',
  "status" text NOT NULL DEFAULT 'pending',
  "scheduled_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "winner_id" uuid REFERENCES "tournament_participants"("id"),
  "duel_results" jsonb,
  "participant1_damage" jsonb,
  "participant2_damage" jsonb,
  "kinship_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Tournament results
CREATE TABLE IF NOT EXISTS "tournament_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE CASCADE,
  "participant_id" uuid NOT NULL REFERENCES "tournament_participants"("id"),
  "final_rank" integer NOT NULL,
  "final_points" integer NOT NULL DEFAULT 0,
  "total_damage_taken" real NOT NULL DEFAULT 0,
  "creature_deaths" jsonb DEFAULT '[]',
  "prizes_awarded" jsonb DEFAULT '[]',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tournament_results_tournament_participant_unique" UNIQUE("tournament_id", "participant_id")
);

-- Extend battles table with arena v2 columns
ALTER TABLE "battles" ADD COLUMN IF NOT EXISTS "battle_mode" text NOT NULL DEFAULT 'ranked';
ALTER TABLE "battles" ADD COLUMN IF NOT EXISTS "tournament_match_id" uuid;
ALTER TABLE "battles" ADD COLUMN IF NOT EXISTS "squad_battle_id" uuid;
ALTER TABLE "battles" ADD COLUMN IF NOT EXISTS "duel_index" integer;
ALTER TABLE "battles" ADD COLUMN IF NOT EXISTS "kinship_malus" real NOT NULL DEFAULT 0;
ALTER TABLE "battles" ADD COLUMN IF NOT EXISTS "team_bonus" real NOT NULL DEFAULT 0;

-- Extend creature_rankings with farming/tournament stats
ALTER TABLE "creature_rankings" ADD COLUMN IF NOT EXISTS "farming_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "creature_rankings" ADD COLUMN IF NOT EXISTS "farming_losses" integer NOT NULL DEFAULT 0;
ALTER TABLE "creature_rankings" ADD COLUMN IF NOT EXISTS "farming_draws" integer NOT NULL DEFAULT 0;
ALTER TABLE "creature_rankings" ADD COLUMN IF NOT EXISTS "tournament_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "creature_rankings" ADD COLUMN IF NOT EXISTS "tournament_losses" integer NOT NULL DEFAULT 0;
ALTER TABLE "creature_rankings" ADD COLUMN IF NOT EXISTS "farming_axp" integer NOT NULL DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_squads_user ON squads(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_battles_squad_battle ON battles(squad_battle_id) WHERE squad_battle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_battles_mode ON battles(battle_mode);
