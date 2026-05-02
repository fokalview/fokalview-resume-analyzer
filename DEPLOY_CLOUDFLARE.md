# Deploy To Cloudflare Pages

This project can run on Cloudflare Pages as a React/Vite frontend plus Pages Functions for `/api/health` and `/api/analyze`.

Planned production domain:

```text
https://resume.fokalview.com
```

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
BETA_ACCESS_CODE = your private beta invite code, encrypted as a secret
```

For the API key and beta code, choose the encrypted/secret option. Do not add them as normal plaintext variables.

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
  "hasArtificialIntelligenceApiKey": true,
  "betaAccessEnabled": true
}
```

## Direct Upload Trial

Cloudflare Pages also supports direct upload of prebuilt assets, but Git integration is better for this project because every push can rebuild the frontend and deploy the Functions together.

If you use Direct Upload, build first:

```bash
npm run build
```

Then upload the generated `dist` folder. Confirm the `functions` folder is deployed with the Pages project.

## Docker Note

This repo includes a `Dockerfile`, but Docker is mainly for container hosts like Render, Fly.io, Railway, or a VPS. For Cloudflare Pages, use the Vite build plus the `functions/api` Pages Functions.

## Custom Domain

After the Pages project has a successful production deployment:

1. In Cloudflare, go to **Workers & Pages**.
2. Open the Pages project.
3. Go to **Custom domains**.
4. Select **Set up a domain**.
5. Enter:

```text
resume.fokalview.com
```

6. Continue and activate the domain.

If `fokalview.com` DNS is already managed by Cloudflare, Cloudflare should add the needed DNS record during activation. If DNS is managed elsewhere, create this CNAME record:

```text
Type: CNAME
Name: resume
Target: <your-pages-project>.pages.dev
```

Cloudflare notes that you should add the custom domain through the Pages dashboard, not only by manually creating a CNAME record, or the domain can fail to resolve correctly.

## Edge Extension After Deploy

The Edge extension is already set to open:

```text
https://resume.fokalview.com
```

The extension URL is centralized in:

- `edge-extension/config.js`
