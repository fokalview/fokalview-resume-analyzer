# Security and reliability repair validation

Validated on Windows with Node 24.21.0, using synthetic users and records only.

## Changes and regression evidence

| Area | Regression and result |
| --- | --- |
| Candidate authorization | Beta code plus claimed email/device headers no longer establishes identity. All candidate CRUD, `/me`, and analysis reject missing, invalid, unavailable, and unverified sessions. |
| Ownership | Alice and Bob saving the same external job receive separate storage IDs. Forged IDs, email headers, PATCH, and DELETE cannot change another owner's job. Resume list/delete are owner-scoped. |
| Compatibility | Existing owned application IDs remain stable. Verified sign-in links an existing email-derived user without changing user/candidate IDs or losing saved jobs. Keep the identity salt stable. |
| Consent | Resume saves require current consent; raw text is absent when retention is false. |
| Scoring | Go, R, C#, AI, SQL, and Python match complete terms, with negative substring controls. Deterministic results remain bounded and repeatable; new reviews are tagged `sagittaiq-readiness-v1.4`. |
| Analysis | Synthetic provider responses flow through real scoring and quota SQL. The quota rejects the next request without another provider call. Optional Workers AI stage failures preserve evaluation. |
| Migrations | SQLite fixtures cover fresh, older, and current schemas and preserve existing users. Incompatible column types reject preparation. All 18 migrations applied through local Wrangler; subsequent runs report no pending migrations. Original SQL files are unchanged. |
| Browser | Real local Pages endpoints reject unauthenticated identity claims; stale beta storage does not reveal the app. Mocked invitation responses/errors render correctly. Extension popup and dashboard preserve local jobs and website handoff. |

## Test-first checkpoints

- `4a7a03c`: authorization, ownership, and short-skill regressions captured before fixes.
- `746ac8e` / `f0de79e`: migration expectations and a pass-through planner reproduced duplicate-column failures before the repair.
- `9ec7ed8`: server, scoring, build, and migration fixes made the initial 23 tests pass.
- Follow-up integration/browser checks exposed and resolved local Wrangler config discovery and expanded regression coverage.

## Final local checks

| Command | Result |
| --- | --- |
| `npm ci` | Clean lockfile install succeeds; npm audit reports zero known vulnerabilities. |
| `npm run test:coverage` | 28 passing, none skipped. Loaded server-module coverage: 83.49% lines, 74.08% branches, 85.61% functions. This is not whole-application/UI coverage. |
| `npm run build` | TypeScript checks and Vite production build pass. Existing large-bundle warning remains. |
| `npm run pages:check` | Pages Functions bundle compiles. |
| `npm run db:migrate` | Fresh apply succeeded; repeated execution is a no-op. Local database only. |
| `npm run test:e2e` | 5 Chromium tests pass against the Wrangler runtime and extension fixtures. |

GitHub Actions installs the locked dependencies and repeats the tests, build,
Functions bundle, local migration/rerun, and browser checks on pull requests.

## Limits and rollout notes

- WorkOS service results and AI responses are mocked in integration tests; real
  hosted sign-in, refresh, invitation delivery, and paid AI evaluation need staging
  validation with the deployment's credentials and callback URLs.
- Docker's executable is installed, but its daemon was unavailable. The container
  build/run was not verified; its npm commands were verified directly on Windows.
- Direct extension cloud sync is intentionally unavailable pending verified
  extension authentication. Existing local jobs, export/import, and handoff remain.
- Device-only legacy accounts are not automatically merged into verified accounts;
  doing so from a caller-supplied device ID would reintroduce impersonation.
- Production migration ledger/schema reconciliation and a backup are required
  before rollout. See [MIGRATIONS.md](MIGRATIONS.md).
- No production data was changed, no deployment was initiated, and no PR was merged.
