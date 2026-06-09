# AI Resume Analyzer

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
- Optional email-based tracking identifier for user application tracking across devices
- Invite-only beta welcome screen backed by server-side access-code enforcement
- Beta terms and privacy notice with de-identified analytics disclosure

## Local Setup

Create `.env` in the project root:

```env
ARTIFICIAL_INTELLIGENCE_PROVIDER=openai
ARTIFICIAL_INTELLIGENCE_API_KEY=your-real-key
ARTIFICIAL_INTELLIGENCE_MODEL=gpt-5.4-mini
DAILY_ANALYSIS_LIMIT=10
BETA_ACCESS_CODE=choose-a-private-beta-code
ADMIN_ACCESS_CODE=choose-a-private-admin-code
API_PORT=8787
```

Install dependencies, then run:

```bash
npm run dev
```

The app runs at `http://localhost:5173` and the local API runs at `http://localhost:8787`.

## Cloudflare Pages

This repo includes Pages Functions under `functions/api`.

Build settings:

```text
Build command: npm run build
Build output directory: dist
```

Add `ARTIFICIAL_INTELLIGENCE_API_KEY`, `BETA_ACCESS_CODE`, and `ADMIN_ACCESS_CODE` as encrypted secrets in Cloudflare Pages. See `DEPLOY_CLOUDFLARE.md` for the full checklist.

To enable cloud storage, create a Cloudflare D1 database, bind it as `DB`, and run the migrations in `migrations/`. The sync endpoints require the same beta access code. Job tracker sync stores job/application context. Resume storage saves a structured workforce profile, analysis, and raw resume text under the beta usage terms. User beta PINs are stored as salted hashes in the `users` table after migration `0009_user_security_pin.sql`.

Production AI analysis is protected by a global daily budget. Run migration
`0017_daily_analysis_limit.sql`, then optionally set the Cloudflare Pages variable
`DAILY_ANALYSIS_LIMIT`. It defaults to `10` provider calls per UTC day. Requests
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

Docker is optional. It is useful for container hosts, but Cloudflare Pages should use the included Pages Functions instead.

```bash
docker build -t ai-resume-analyzer .
docker run -p 8787:8787 --env-file .env ai-resume-analyzer
```

The container serves the built app and API from `http://localhost:8787`.

## Security

Never put a real API key in frontend code, extension code, GitHub, or `.env.example`. Keep real keys in local `.env` or hosted platform secrets.

For FERPA-sensitive workflows, treat this implementation as a technical starting point rather than a compliance certification. Use explicit consent, data minimization, access controls, retention policies, audit logging, and legal review before collecting education records or student-identifiable data.
