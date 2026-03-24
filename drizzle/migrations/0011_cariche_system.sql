-- Cariche del Laboratorio (Social Hierarchy System)

CREATE TABLE IF NOT EXISTS "cariche" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "carica_id" text NOT NULL,
  "creature_id" uuid NOT NULL REFERENCES "creatures"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "metric_value" real NOT NULL,
  "awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cariche_carica_id_unique" UNIQUE("carica_id")
);

CREATE TABLE IF NOT EXISTS "carica_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "carica_id" text NOT NULL,
  "creature_id" uuid NOT NULL REFERENCES "creatures"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "metric_value" real NOT NULL,
  "week_start" timestamp with time zone NOT NULL,
  "week_end" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "carica_history_carica_id_idx" ON "carica_history" ("carica_id");
CREATE INDEX IF NOT EXISTS "carica_history_creature_id_idx" ON "carica_history" ("creature_id");
CREATE INDEX IF NOT EXISTS "carica_history_user_id_idx" ON "carica_history" ("user_id");
CREATE INDEX IF NOT EXISTS "cariche_creature_id_idx" ON "cariche" ("creature_id");
CREATE INDEX IF NOT EXISTS "cariche_user_id_idx" ON "cariche" ("user_id");
