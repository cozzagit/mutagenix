-- ---------------------------------------------------------------------------
-- Migration 0010: Breeding System
-- Adds breeding requests, records, lineage, clans, memberships, relationships
-- and new columns on creatures + users tables.
-- ---------------------------------------------------------------------------

-- ===== New columns on existing tables =====

-- creatures: breeding / lineage fields
ALTER TABLE "creatures"
  ADD COLUMN "is_founder" boolean NOT NULL DEFAULT false,
  ADD COLUMN "is_dead" boolean NOT NULL DEFAULT false,
  ADD COLUMN "death_at" timestamp with time zone,
  ADD COLUMN "death_cause" text,
  ADD COLUMN "parent_a_creature_id" uuid,
  ADD COLUMN "parent_b_creature_id" uuid,
  ADD COLUMN "family_generation" integer NOT NULL DEFAULT 1;

-- users: breeding fields
ALTER TABLE "users"
  ADD COLUMN "active_creature_id" uuid,
  ADD COLUMN "energy" integer NOT NULL DEFAULT 100,
  ADD COLUMN "max_creatures" integer NOT NULL DEFAULT 1;

-- ===== New tables =====

CREATE TABLE IF NOT EXISTS "breeding_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requester_id" uuid NOT NULL REFERENCES "users"("id"),
  "target_id" uuid NOT NULL REFERENCES "users"("id"),
  "requester_creature_id" uuid NOT NULL REFERENCES "creatures"("id"),
  "target_creature_id" uuid NOT NULL REFERENCES "creatures"("id"),
  "status" text NOT NULL DEFAULT 'pending',
  "message" text,
  "energy_cost" integer NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "responded_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "breeding_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "parent_a_id" uuid NOT NULL REFERENCES "creatures"("id"),
  "parent_b_id" uuid NOT NULL REFERENCES "creatures"("id"),
  "player_a_id" uuid NOT NULL REFERENCES "users"("id"),
  "player_b_id" uuid NOT NULL REFERENCES "users"("id"),
  "offspring_a_id" uuid REFERENCES "creatures"("id"),
  "offspring_b_id" uuid REFERENCES "creatures"("id"),
  "energy_cost" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'completed',
  "genetics_seed" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "creature_lineage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "child_id" uuid NOT NULL REFERENCES "creatures"("id") ON DELETE CASCADE,
  "parent_id" uuid NOT NULL REFERENCES "creatures"("id"),
  "parent_role" text NOT NULL,
  "breeding_id" uuid NOT NULL REFERENCES "breeding_records"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "creature_lineage_child_role_unique" UNIQUE ("child_id", "parent_role")
);

CREATE TABLE IF NOT EXISTS "clans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "founder_id" uuid NOT NULL UNIQUE REFERENCES "creatures"("id"),
  "owner_id" uuid NOT NULL REFERENCES "users"("id"),
  "name" text NOT NULL,
  "motto" text,
  "clan_type" text NOT NULL DEFAULT 'open',
  "total_members" integer NOT NULL DEFAULT 1,
  "total_generations" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clan_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clan_id" uuid NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "creature_id" uuid NOT NULL UNIQUE REFERENCES "creatures"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "role" text NOT NULL DEFAULT 'member',
  "joined_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "player_relationships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "player_a_id" uuid NOT NULL REFERENCES "users"("id"),
  "player_b_id" uuid NOT NULL REFERENCES "users"("id"),
  "total_breedings" integer NOT NULL DEFAULT 0,
  "relationship_score" integer NOT NULL DEFAULT 0,
  "last_breeding_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- ===== Data migrations =====

-- All existing creatures are founders (generation 1)
UPDATE "creatures"
  SET "is_founder" = true,
      "family_generation" = 1;

-- Set active_creature_id for existing users based on their active (non-archived) creature
UPDATE "users" u
  SET "active_creature_id" = (
    SELECT c."id"
    FROM "creatures" c
    WHERE c."user_id" = u."id"
      AND c."is_archived" = false
    ORDER BY c."created_at" DESC
    LIMIT 1
  );
