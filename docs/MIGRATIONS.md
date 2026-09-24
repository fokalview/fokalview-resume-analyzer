# Migration preparation

The checked-in baseline already contains `application_captures.salary` and the
three user metadata columns that 0003/0004 attempt to add again. Keep historical
SQL and migration names unchanged. The planner omits only these known duplicate
TEXT additions after inspecting the schema; indexes and other statements remain.
Unexpected column types abort preparation. Wrangler maintains `d1_migrations`.

## Local development

```sh
npm ci
npm run db:migrate
```

This command uses only local D1 in `.wrangler/state`, with `wrangler.local.toml`.
It supports fresh databases, older schemas missing those columns, and current
schemas. Rerunning uses the migration ledger and is a no-op. It has no remote
write mode. SQLite tests cover each schema shape and preservation of existing data.

## Production preparation (operator runbook)

No production migrations were run as part of this repair. Before deployment:

1. Back up the target D1 database and establish a tested restoration path.
2. Inspect the target schema and migration ledger. Replace `DB` below with the
   intended configured binding if different. These commands are read-only:

   ```sh
   npx wrangler d1 execute DB --remote --command "PRAGMA table_info(application_captures)" --json > applications-schema.json
   npx wrangler d1 execute DB --remote --command "PRAGMA table_info(users)" --json > users-schema.json
   npx wrangler d1 migrations list DB --remote
   ```

   Use a shell that writes UTF-8 output (PowerShell 7 or a POSIX shell). If SQL was
   previously applied manually, reconcile the migration ledger against the actual
   schema first. The planner does not guess which unrelated migrations ran.

3. Generate a new directory of staged migrations, offline:

   ```sh
   node scripts/prepare-migrations.mjs applications-schema.json users-schema.json .wrangler/production-migrations
   ```

   The output directory must not already exist. Review the diff against
   `migrations/`: only the known duplicate additions in 0003/0004 should change.
   Test against a restored staging copy before any production write.

4. Make a temporary copy of `wrangler.toml` called `wrangler.migrations.toml` in
   the repository root. Add `migrations_dir = ".wrangler/production-migrations"`
   inside its `[[d1_databases]]` block. Verify the database ID targets the intended
   database. After review, the operator can apply the staged migrations:

   ```sh
   npx wrangler d1 migrations apply DB --remote --config wrangler.migrations.toml
   ```

5. Verify the migration ledger, record counts, candidate identity links, and a
   verified sign-in before releasing the application. Preserve the existing
   `APPLICATION_SYNC_SALT` (or the previous fallback beta code if no salt was set).
   Changing it can change legacy email-derived user IDs.

These steps preserve original migration names so already-recorded migrations are
skipped. Do not reset a production database, skip arbitrary errors, or mark
unapplied migrations complete to bypass a failure.
