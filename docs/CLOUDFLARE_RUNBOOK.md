# Cloudflare Operations And Recovery Runbook

This runbook describes the current Cloudflare Pages and D1 operating process.
Never place real secret values in this file.

## Production Components

- Cloudflare Pages project: `fokalview-resume-analyzer`
- GitHub repository: `fokalview/fokalview-resume-analyzer`
- Production branch: `main`
- Build command: `npm run build`
- Build output: `dist`
- D1 binding: `DB`
- D1 database: `fokalview-resume-analyzer`
- Public domains include `sagittaiq.com`, `sagittaiq.fokalview.com`, and
  `resume.fokalview.com`

## Required Secrets And Variables

Configured through Cloudflare Pages project settings:

- `ARTIFICIAL_INTELLIGENCE_API_KEY`
- `ARTIFICIAL_INTELLIGENCE_PROVIDER`
- `ARTIFICIAL_INTELLIGENCE_MODEL`
- `APPLICATION_SYNC_SALT`
- `BETA_ACCESS_CODE`
- `ADMIN_ACCESS_CODE`
- `OWNER_ACCESS_CODE`
- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_COOKIE_PASSWORD`

Use encrypted secrets for credentials and access codes. Redeploy after changing them.

## WorkOS AuthKit Deployment

Before deploying verified-account login:

1. Confirm the three WorkOS secrets above exist in the production Pages environment.
2. Apply `migrations/0016_workos_verified_identity.sql` to D1.
3. Confirm WorkOS redirect URIs and sign-out redirects include the production and
   localhost URLs recorded in the project journal.
4. Keep public sign-up disabled while SagittaIQ operates as an invite-only beta.
5. Deploy, then test login, callback, session refresh, identity linkage, and logout.

The temporary beta code and PIN flow remains available during migration. Do not
remove it until verified-account access has been tested against existing candidate
records.

## Standard Deployment

1. Confirm the working tree contains only intended changes.
2. Run the local build and available checks.
3. Commit and push to `main`.
4. Open Cloudflare Workers & Pages -> `fokalview-resume-analyzer` -> Deployments.
5. Confirm the deployment references the expected Git commit and reports success.
6. Verify `/api/health`.
7. Manually test the changed workflow on the production domain.
8. Add a journal entry with the commit, verification, and any required migration.

## D1 Migration Procedure

Preferred long-term method:

```bash
wrangler d1 migrations apply fokalview-resume-analyzer --remote
```

Current dashboard-console method:

1. Open Cloudflare D1 -> `fokalview-resume-analyzer` -> Console.
2. Open the required migration file locally.
3. Copy the SQL contents, not the migration filename.
4. Paste the SQL into the D1 Console and execute it once.
5. Verify the affected table with:

```sql
PRAGMA table_info(table_name);
```

6. Verify new tables with:

```text
/tables
```

7. Record the result in the project journal.

Important: the current migration history contains duplicate column additions. If
D1 reports `duplicate column name`, stop and verify the schema instead of repeatedly
running the same full migration.

## Production Verification Checklist

- `/api/health` reports expected provider configuration.
- Candidate beta access works.
- Resume analysis returns a result.
- Readiness score remains stable for identical inputs.
- Opportunity can be created, edited, and deleted.
- Job description and extracted qualifications persist.
- Candidate dashboard and report load.
- Waitlist and follow-up forms submit.
- Admin dashboard loads only after valid admin access.
- D1 receives expected rows without obvious duplication.

## Failure Recovery

### Cloudflare Build Failure

1. Open deployment details and read the first TypeScript or build error.
2. Reproduce with `npm run build` locally.
3. Fix the smallest relevant issue.
4. Commit and push the fix.
5. Confirm the new deployment succeeds.

Do not assume Cloudflare deployed merely because GitHub received the commit.

### Broken Database Change

1. Stop submitting writes from the affected workflow if possible.
2. Inspect D1 schema with `PRAGMA table_info`.
3. Use D1 Time Travel/bookmarks before destructive recovery.
4. Do not delete or recreate production tables without a verified backup and plan.
5. Document the incident and exact corrective SQL.

### Secret Exposure

1. Rotate the exposed secret immediately in the owning provider.
2. Update the Cloudflare encrypted secret.
3. Redeploy.
4. Review Git history and logs for exposure scope.
5. Record the incident without writing the secret value.

## Recovery Gaps To Close

- Create a clean, replayable database baseline migration.
- Add automated build/test checks before deployment.
- Document D1 backup and restore drills with evidence.
- Move from shared access codes to named verified accounts and RBAC.
- Establish a staging environment before institutional pilots.
