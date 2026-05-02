# Artificial Intelligence API Key Setup

The browser extension and React frontend must never contain a real AI provider key.

Use this shape:

```text
Edge extension / React app -> local or hosted backend -> AI provider API
```

## Local `.env`

Create a `.env` file in this project root:

```env
ARTIFICIAL_INTELLIGENCE_PROVIDER=openai
ARTIFICIAL_INTELLIGENCE_API_KEY=your-real-key-here
ARTIFICIAL_INTELLIGENCE_MODEL=gpt-5.4-mini
API_PORT=8787
```

`.env` is ignored by Git. Keep `.env.example` as a template only.

## Provider Options

### OpenAI

```env
ARTIFICIAL_INTELLIGENCE_PROVIDER=openai
ARTIFICIAL_INTELLIGENCE_API_KEY=your-openai-key
ARTIFICIAL_INTELLIGENCE_MODEL=gpt-5.4-mini
```

### OpenAI-Compatible Providers

Use this when a provider exposes a `/chat/completions` endpoint with bearer-token auth.

```env
ARTIFICIAL_INTELLIGENCE_PROVIDER=openai-compatible
ARTIFICIAL_INTELLIGENCE_BASE_URL=https://api.example.com/v1
ARTIFICIAL_INTELLIGENCE_API_KEY=your-provider-key
ARTIFICIAL_INTELLIGENCE_MODEL=provider-model-name
```

Different providers support different JSON/structured-output behavior. If one provider returns messy JSON, add a provider-specific adapter in `server/analyze.mjs` instead of putting secrets in frontend code.

## Health Check

Open:

```text
http://localhost:8787/api/health
```

You should see `hasArtificialIntelligenceApiKey: true` after adding `.env` and restarting the API server.
