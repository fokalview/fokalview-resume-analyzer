# Job Capture security recheck — 2026-09-24

Scope: Chrome Job Capture 1.0.1, its website import/save path, candidate API identity boundaries, dependencies, and release packaging. Local source review and automated adversarial checks; not a production penetration test or security certification.

## Changes

- Added an origin guard for application/resume/analysis mutations. Cross-origin, opaque-origin and sibling-origin browser requests now receive 403 before the handler. CORS previously did not itself prevent state-changing requests. SameSite cookies still remain in use; existing verified-session checks still authorize all candidate operations. Headerless non-browser clients still require authentication. This specifically closes the sibling-origin browser mutation exposure.
- Fixed a privacy race: a delayed capture could refill and persist a draft after Clear draft. Capture results are now discarded when the user changes or clears the form; sending also invalidates pending captures.
- Tightened extension CSP to block popup network connections, remote resources, base changes, embedded objects and native form submissions. Sending still uses the fixed SagittaIQ tab URL after review.

## Verified boundaries

- Only activeTab, scripting and storage permissions; no persistent website host permissions, external message listener, embedded secrets, remote script loading or background network capture in the Chrome extension.
- Page HTML is converted through an inert template and displayed using text/value bindings. Malicious markup fixture does not execute.
- Handoff has a versioned field whitelist, payload and field bounds, HTTP(S)-only source URLs and removal of URL credentials. User review and verified website login precede saving; imported content does not authorize an action.
- Existing owner-isolation, consent, unauthenticated-access and analysis quota tests pass.
- npm audit: zero known dependency vulnerabilities at review time.
- Production frontend and Pages worker compile successfully. Regression suite: 33 passing tests. Browser suite includes an unpacked extension on Microsoft Edge locally; Chrome-family Chromium is used in Linux CI.

## Release limits

Deploy the companion website fixes and public privacy page before store submission. Store publication and production authentication were not exercised. Job text remains untrusted input to analysis: review AI output, and never interpret posting text as authorization. Local drafts and exported JSON are not encrypted; drafts expire on the next popup visit after 24 hours. The URL fragment is temporarily present in browser history until the website clears it. A compromised device or same-origin website script is outside these protections.

Reference: https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy
