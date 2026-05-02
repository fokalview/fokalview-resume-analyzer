# AI Resume Analyzer

AI Resume Analyzer is a Vite/React app with a server-side artificial intelligence API boundary. It analyzes resume text against a target role and optional job tracker context, then returns ATS-focused scoring, matched/missing keywords, section health, strengths, and prioritized improvements.

## Features

- Resume analyzer UI with upload/paste workflow
- Job tracker handoff support from the companion Edge extension
- Server-side API key handling through environment variables
- Provider-neutral AI config names
- OpenAI Responses API support with strict JSON schema output
- Cloudflare Pages Functions for deployable `/api/health` and `/api/analyze`
- Edge extension source for saving jobs and sending them into the analyzer

## Local Setup

Create `.env` in the project root:

```env
ARTIFICIAL_INTELLIGENCE_PROVIDER=openai
ARTIFICIAL_INTELLIGENCE_API_KEY=your-real-key
ARTIFICIAL_INTELLIGENCE_MODEL=gpt-5.4-mini
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

Add `ARTIFICIAL_INTELLIGENCE_API_KEY` as an encrypted secret in Cloudflare Pages. See `DEPLOY_CLOUDFLARE.md` for the full checklist.

## Security

Never put a real API key in frontend code, extension code, GitHub, or `.env.example`. Keep real keys in local `.env` or hosted platform secrets.
