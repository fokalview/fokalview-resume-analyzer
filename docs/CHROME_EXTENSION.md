# SagittaIQ Job Capture — release and submission guide

## What it does

Chrome Manifest V3 extension, version 1.0.0. Click **Capture this page** on an
individual job posting. Review/edit title, employer, location, salary, employment
type, workplace, full description, company background, requirements, preferred
qualifications, responsibilities, benefits, experience, education, and dates.
Unknown fields stay blank. JSON-LD JobPosting data is preferred; visible-page
fallbacks cover common Indeed, LinkedIn, Workday, Lever, and Greenhouse layouts.
Site layouts vary; fixture tests are not a guarantee for every live job board.

Check the consent box and choose **Review in SagittaIQ**. The website preserves
the draft through verified sign-in and displays a separate review/save step.
**Save & compare resume** saves an opportunity, then opens the resume workflow.
Requirements and preferences stay in labeled context; prose bullets are not
misrepresented as extracted skill names. Analysis receives up to 30,000 characters
of job context. Provider usage can increase for longer postings.

Capture does not bypass logins, CAPTCHAs, paywalls, or site restrictions. Expand
collapsed descriptions first. Chrome internal pages, the Web Store, PDFs, and
cross-origin embedded postings may not be readable. Paste missing text manually.

## Local installation

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select the repository's `chrome-extension` folder
   (or extract the release ZIP and select the folder containing `manifest.json`).
3. Pin **SagittaIQ Job Capture**, open a job posting, then open the extension.
4. Capture, edit, and send. Export JSON provides a local backup without sign-in.

Only `activeTab`, `scripting`, and `storage` are requested. There is no persistent
host access, continuous scraping, remote code, extension analytics, or direct
cloud write. The extension never stores a SagittaIQ password, beta code, or cookie.
The editable draft is local, expires after 24 hours (checked on opening), and is
cleared after a successful handoff. The website draft is per-tab session storage.

## Website release dependency

Deploy the companion website changes before publishing the extension. The older
website does not understand `#sagittaiq-job=...`. The updated site validates the
payload, removes the fragment from browser history, persists the draft through
sign-in, and requires a separate save. The destination is fixed to
`https://sagittaiq.com`; no broad host permissions or shared-code auth are needed.
Fragments are not sent in the HTTP request, but are temporarily present in browser
history until the website imports them. Do not paste personal or confidential
material into captured job fields.

The prior security/reliability repair is a prerequisite. No migration is required
specifically for this extension. No store publication or production deployment is
performed by the packaging scripts.

## Build and verify

```sh
npm ci
npx playwright install chromium
npm run test:coverage
npm run build
npm run pages:check
npm run db:migrate
npm run test:e2e
node scripts/package-chrome-extension.mjs
```

The ZIP is written to `.wrangler/releases`. Pass an output directory as the first
argument to change that location. It contains only the extension runtime, privacy
notice, manifest, and PNG icons, with `manifest.json` at the ZIP root. No app
secrets, dependencies, test fixtures, or developer files are included.

Icons are rasterized from the existing project icon with
`node scripts/extension-assets.mjs`. Recreate demonstration store images with
`node scripts/chrome-store-assets.mjs`; the screenshots label their fictional job.
The full-extension test uses a clean Chromium profile, not your normal browser:
installed Edge on Windows and bundled Chromium on Linux CI. The bundled full
Chromium executable could not launch on the development Windows host; the
headless fixture tests still use bundled Chromium. `EXTENSION_BROWSER_CHANNEL`
can select another supported test channel locally.

## Verification results

- 31 unit/integration checks pass, including bounded Unicode handoff and unsafe-URL rejection.
- 18 browser cases cover five posting-layout fixtures, JSON-LD graphs, ambiguous
  results, executable markup, capture/edit/clear, restricted pages, sign-in handoff,
  explicit saving, and the unpacked extension draft/export/send workflow.
- TypeScript/Vite production build and the Pages Functions bundle compile.
- Packaged runtime excludes source tests, secrets, and node_modules. Store images
  were rendered from the actual form using an explicitly labeled fictional job.
- Live job-board access and real hosted WorkOS sign-in are not automated by these
  tests. Run the release smoke check on the deployed website before submission.

## Chrome Web Store submission

1. Deploy and verify the website import flow and the public privacy notice at
   `https://sagittaiq.com/job-capture-privacy.html`. Keep that notice synchronized
   with `chrome-extension/privacy.html` when data practices change.
2. Create/sign in to your Chrome Web Store developer account and complete its
   registration and publisher contact requirements.
3. Upload `SagittaIQ-Chrome-Extension-1.0.0.zip` as a new item.
4. Use the listing draft in `CHROME_STORE_LISTING.md`, the 128px icon, the
   1280×800 screenshots, and the 440×280 promotional tile.
5. Complete privacy disclosures and permission justifications truthfully. The
   extension handles **website content** and the **current posting URL**. It does
   not collect general browsing history, but disclose that URL under the relevant
   browsing-activity category rather than claiming no URL data is handled.
6. Supply your actual developer support contact and instructions/test access for
   reviewers to exercise the verified SagittaIQ handoff. Do not put test passwords
   in this repository or the public listing.
7. Test a real posting and the full production sign-in/save flow, then submit for
   Google's review. Uploading a ZIP does not guarantee store approval.

Official references:
- [activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Prepare the extension ZIP](https://developer.chrome.com/docs/webstore/prepare)
- [Listing assets](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [User data policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
