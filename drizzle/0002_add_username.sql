-- Add unique username column to users table
-- Uses a generated default from display_name so existing rows are not null-violated
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "username" varchar(32);

-- Backfill existing users with a unique username derived from display_name + short ID
UPDATE "users"
SET "username" = LOWER(REGEXP_REPLACE(SUBSTRING(display_name, 1, 20), '[^a-zA-Z0-9_]', '', 'g'))
              || '_' || SUBSTRING(id::text, 1, 6)
WHERE "username" IS NULL;

-- Now lock it in as NOT NULL and UNIQUE
ALTER TABLE "users"
  ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");
