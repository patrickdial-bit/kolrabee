# Supabase migrations — how to run them against prod

This repo treats `supabase/migrations/*.sql` as the single source of truth for the Kolrabee production database schema. Keep them in order and don't edit a migration that's already been applied.

## Project ref

Production Supabase project ref: `qjejzoyyulzbancykpad`
(Find it in the dashboard URL: `https://supabase.com/dashboard/project/<PROJECT_REF>`.)

## Normal workflow — adding a new migration

1. Create a new file under `supabase/migrations/` with the next version prefix. Current highest is `00015`, so the next would be `00016_your_change.sql`.
2. Write the migration. Prefer `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, and `ON CONFLICT DO NOTHING` so re-runs are safe.
3. Commit the file.
4. Push to prod via CLI:
   ```bash
   cd ~/Desktop/kolrabee
   SUPABASE_ACCESS_TOKEN=<your-token> npx supabase db push
   ```
   You'll need a personal access token from https://supabase.com/dashboard/account/tokens. Tokens should be revoked after use.

## If you had to apply a migration directly via the SQL Editor

Sometimes it's faster or safer to paste SQL into the dashboard SQL Editor than to run the CLI. When you do that, the CLI's tracking table (`supabase_migrations.schema_migrations`) won't know the migration ran, and the next `supabase db push` will try to apply it again.

To tell the CLI "this is already applied":
```bash
SUPABASE_ACCESS_TOKEN=<your-token> npx supabase migration repair --status applied <version>
```

If the CLI route fails (it needs direct DB access for repair in some cases), you can insert the tracking row directly from the SQL Editor:
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('<version>', '<name-without-prefix-and-extension>')
ON CONFLICT DO NOTHING;
```
For example, for `00011_invitation_expiration_and_notification_prefs.sql`, version is `00011` and name is `invitation_expiration_and_notification_prefs`.

## Never reuse a version prefix

Two files with the same version prefix (e.g. two files starting with `00002_`) confuse the CLI — only one version number can be tracked. If you notice a collision, rename one file to use a disambiguating suffix (`00002a_...`) and repair it as applied.

## What's already tracked on prod

As of the initial sync (2026-04-22), every migration in this folder from `00000` through `00015a` is marked applied on prod. Two older rows from an unrelated "Fieldy" project exist in the tracking table and are intentionally left alone.

## Access token hygiene

Personal access tokens grant full account access. Create a token per task, revoke it immediately after. Never commit a token to the repo.
