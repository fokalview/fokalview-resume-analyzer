# Deploy To Cloudflare Pages

This project can run on Cloudflare Pages as a React/Vite frontend plus Pages Functions for `/api/health` and `/api/analyze`.

## Recommended Trial Path: Git Integration

1. Push this project to GitHub.
2. In Cloudflare, go to **Workers & Pages**.
3. Select **Create application > Pages > Import an existing Git repository**.
4. Choose the repository.
5. Use these build settings:

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: /
```

6. Add variables/secrets in **Settings > Variables and Secrets**:

```text
ARTIFICIAL_INTELLIGENCE_PROVIDER = openai
ARTIFICIAL_INTELLIGENCE_MODEL = gpt-5.4-mini
ARTIFICIAL_INTELLIGENCE_API_KEY = your real key, encrypted as a secret
```

For the key, choose the encrypted/secret option. Do not add it as a normal plaintext variable.

7. Redeploy after adding secrets.
8. Test:

```text
https://your-project.pages.dev/api/health
```

You want:

```json
{
  "ok": true,
  "provider": "openai",
  "model": "gpt-5.4-mini",
  "hasArtificialIntelligenceApiKey": true
}
```

## Direct Upload Trial

Cloudflare Pages also supports direct upload of prebuilt assets, but Git integration is better for this project because every push can rebuild the frontend and deploy the Functions together.

If you use Direct Upload, build first:

```bash
npm run build
```

Then upload the generated `dist` folder. Confirm the `functions` folder is deployed with the Pages project.

## Edge Extension After Deploy

After the Pages site is live, update the extension links from:

```text
http://localhost:5173
```

to:

```text
https://your-project.pages.dev
```

Those links are currently in:

- `edge-extension/popup.js`
- `edge-extension/dashboard.js`
