# SagittaIQ

AI Resume Analyzer is a Vite/React app with a server-side artificial intelligence API boundary. It analyzes resume text against a target role and optional job tracker context, then returns ATS-focused scoring, matched/missing keywords, section health, strengths, and prioritized improvements.

Planned production URL: `https://resume.fokalview.com`

## Project Memory

Start with [`docs/README.md`](docs/README.md) for the dated project journal,
architecture, database reference, Cloudflare recovery runbook, product roadmap,
and major architecture decisions. These documents are the durable operating
memory for SagittaIQ and should be updated alongside meaningful product changes.

## Features

- Resume analyzer UI with upload/paste workflow
- Job tracker handoff support from the companion Edge extension
- Server-side API key handling through environment variables
- Provider-neutral AI config names
- OpenAI Responses API support with strict JSON schema output
- Cloudflare Pages Functions for deployable `/api/health` and `/api/analyze`
- Cloudflare Workers AI orchestration for job structuring and independent score audits
- Edge extension source for saving jobs and sending them into the analyzer
- Optional Cloudflare D1 sync for saved job/application context
- Cloudflare D1 storage for structured resume workforce profiles and retained resume text under the beta usage terms
- Admin-only `/admin` dashboard protected by a second-level access code
- Verified WorkOS identity for candidate data across devices
- Invite-only beta welcome screen backed by server-side access-code enforcement
- Beta terms and privacy notice with de-identified analytics disclosure

## Local Setup

Use Node.js 24 LTS (24.13 or later; CI uses 24.21.0).

```sh
npm ci
```

Copy `.dev.vars.example` to `.dev.vars` and supply WorkOS **test** credentials,
a cookie password of at least 32 random characters, a beta invitation code, and
a stable `APPLICATION_SYNC_SALT`. Register
`http://localhost:8788/api/auth/callback` in the WorkOS test application. If using
127.0.0.1, register that origin instead and use it consistently.

```sh
npm run dev
```

Open `http://localhost:8788`. This builds the frontend, upgrades an isolated local
D1 database, and serves the actual Pages Functions. Without credentials the public
pages work and candidate APIs reject access. A beta code admits a user to the
invitation flow; a verified WorkOS session is required to use the candidate app.
Local state is in `.wrangler/state`. The launcher stages a local configuration
under `.wrangler/local`; it never changes the production configuration.

For frontend hot reload, leave `npm run dev:api` running after the initial build
and migration, then run `npm run dev:web` in another terminal. Vite proxies `/api`
to port 8788. Register `http://localhost:5173/api/auth/callback` in WorkOS for this
mode. Restart the API after changing `.dev.vars`.

Local development has no Workers AI binding. Setting a real external AI key makes
analysis requests billable. Tests use synthetic provider responses and do not send
invitations or call paid AI services.

## Checks

```sh
npm run test:coverage
npm run build
npm run pages:check
npm run db:migrate
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs these checks on pull requests. See
[repair validation](docs/REPAIR_VALIDATION.md) and the
[migration guide](docs/MIGRATIONS.md).

## Cloudflare Pages

This repo includes Pages Functions under `functions/api`.

Build settings:

```text
Build command: npm run build
Build output directory: dist
```

Add `ARTIFICIAL_INTELLIGENCE_API_KEY`, `BETA_ACCESS_CODE`, and `ADMIN_ACCESS_CODE` as encrypted secrets in Cloudflare Pages. See `DEPLOY_CLOUDFLARE.md` for the full checklist.

To enable cloud storage, create a Cloudflare D1 database, bind it as `DB`, and follow `docs/MIGRATIONS.md` to prepare migrations. Candidate endpoints require a verified WorkOS session cookie; beta codes and client-supplied email or device headers never authorize data access. Job tracker sync stores job/application context. Resume storage saves a structured workforce profile, analysis, and raw resume text under the beta usage terms. User beta PINs are stored as salted hashes in the `users` table after migration `0009_user_security_pin.sql`.

Production AI analysis is protected by a global daily budget. Run migration
`0017_daily_analysis_limit.sql`, then optionally set the Cloudflare Pages variable
`DAILY_ANALYSIS_LIMIT`. It defaults to `10` analysis requests per UTC day (each may run multiple AI stages). Requests
that reach the AI provider count toward the budget, including provider failures,
so repeated failures cannot create uncontrolled spend.

Cloudflare Workers AI is bound as `AI` through `wrangler.toml`. By default it
acts as a control layer around the configured resume evaluator:

1. A job-structure agent extracts opportunity details and qualifications.
2. The configured resume evaluator produces evidence and feedback.
3. SagittaIQ code calculates the official deterministic readiness score.
4. A score-audit agent checks whether the score is directionally reasonable
   against its categories and prior runs without changing the official score.

Set `CLOUDFLARE_AI_MODEL` to change the Workers AI model. To run the resume
evaluation itself through Workers AI, set:

```text
ARTIFICIAL_INTELLIGENCE_PROVIDER=cloudflare-workers-ai
```

## Docker

The container runs the same local Wrangler development server; production is
Cloudflare Pages. It is not a production container deployment.

```sh
docker build -t sagittaiq-dev .
docker run --rm -p 8788:8788 --mount type=bind,source="$(pwd)/.dev.vars",target=/app/.dev.vars,readonly --mount type=volume,source=sagittaiq-local,target=/app/.wrangler/state sagittaiq-dev
```

The mount example uses a POSIX shell. In PowerShell use the full Windows path for
`source`. Open `http://localhost:8788`.

## Chrome Job Capture

The new `chrome-extension` folder contains a Manifest V3 extension for capturing
an individual job posting, reviewing its details, and importing a draft into
SagittaIQ. It captures the full description, requirements, preferred qualifications,
responsibilities, employer, location, pay, benefits, and other explicit details.

Use `npm run extension:package` to create the Chrome Web Store ZIP. See
[installation and release instructions](docs/CHROME_EXTENSION.md) and the
[store listing draft](docs/CHROME_STORE_LISTING.md). Deploy the companion website
import flow before publishing the extension.

## Legacy Edge Extension

Local capture, export/import, and "Send to resume" remain available. Direct
extension cloud sync is disabled until verified extension authentication is
implemented. Send a job to the website, sign in, and save it there. Existing
local jobs are preserved; a shared beta code cannot access cloud records.

## Security

Never put a real API key in frontend code, extension code, GitHub, or `.env.example`. Keep real keys in local `.dev.vars` or hosted platform secrets.

For FERPA-sensitive workflows, treat this implementation as a technical starting point rather than a compliance certification. Use explicit consent, data minimization, access controls, retention policies, audit logging, and legal review before collecting education records or student-identifiable data.
