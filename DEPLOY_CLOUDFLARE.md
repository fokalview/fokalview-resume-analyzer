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
ADMIN_ACCESS_CODE = your private admin dashboard code, encrypted as a secret
OWNER_ACCESS_CODE = optional owner override code, encrypted as a secret
```

For the API key and access codes, choose the encrypted/secret option. Do not add them as normal plaintext variables.

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
  "betaAccessEnabled": true,
  "adminAccessEnabled": true
}
```

## Admin Dashboard

The dashboard is available at:

```text
https://your-project.pages.dev/admin
```

It requires `ADMIN_ACCESS_CODE` or `OWNER_ACCESS_CODE`. The browser stores the entered admin code in session storage only, and the backend enforces the code before returning consolidated data from `/api/admin/summary`.

This is a temporary second-level access model. For production student tracking, replace shared admin codes with named user accounts and role-based access control.

## D1 Storage For Captured Job And Resume Context

The app can optionally sync saved job/application context and structured resume workforce profiles to Cloudflare D1. This is off unless the user enables the relevant consent control and provides the private access code.

1. Create a D1 database:

```bash
wrangler d1 create fokalview-resume-analyzer
```

2. Copy the returned database ID into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "fokalview-resume-analyzer"
database_id = "your-real-d1-database-id"
```

3. Apply the migration:

```bash
wrangler d1 migrations apply fokalview-resume-analyzer --remote
```

4. Add an encrypted secret for a server-side hash salt:

```text
APPLICATION_SYNC_SALT = long random secret value
```

5. Redeploy the Pages project.

The `/api/applications` and `/api/resume-records` endpoints require:

- `X-Beta-Access-Code`
- `X-FokalView-Client-ID`
- `consent: true`

Use `consentVersion: ferpa-minimum-necessary-v1` for `/api/applications`.
Use `consentVersion: workforce-resume-profile-v1` for `/api/resume-records`.

It stores job/application context only: title, company, location, status, notes, URL, source, timestamps, consent version, and a hashed client identifier. It does not store resume text.

The `/api/resume-records` endpoint stores:

- structured skills, tools, soft skills, industries, work history, education, certifications, projects, languages, and location signals
- resume analysis score, summary, strengths, improvement actions, keyword matches/gaps, and section health
- target role and job context
- raw resume text only when `retainRawResumeText` is explicitly true

Avoid collecting grades, GPAs, student IDs, birth dates, full mailing addresses, or other education-record details unless you have a reviewed FERPA policy and retention plan for that data.

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
