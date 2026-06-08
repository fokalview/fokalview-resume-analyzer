# SagittaIQ Project Journal

This journal records the product's accumulated reasoning and operating history.
Entries are newest first. It is not a changelog: it explains why the work matters,
what was learned, and what still needs attention.

<!-- NEW_ENTRIES_BELOW -->

## 2026-06-08 - Automated Beta-Code WorkOS Invitations

### Objective

Remove the need to manually approve every beta user in the WorkOS dashboard while
keeping public account registration disabled.

### Implemented Flow

1. A user enters the valid SagittaIQ beta access code, email address, and PIN.
2. SagittaIQ validates the existing beta access rules and stores the temporary
   email-linked profile.
3. SagittaIQ checks WorkOS for an existing account or pending invitation.
4. If no account or pending invitation exists, SagittaIQ automatically sends a
   seven-day WorkOS invitation to the submitted email.
5. The user can continue into the temporary beta immediately and use the emailed
   invitation to create a verified account.
6. Existing WorkOS users are sent directly to verified sign-in.

### Security And Operating Decision

- Public WorkOS sign-up remains disabled.
- The shared beta code authorizes the invitation.
- The emailed invitation verifies control of the submitted email address.
- Pending invitations are reused rather than duplicated, preventing repeat beta
  submissions from sending invitation spam to the same address.
- The current beta flow remains available if WorkOS invitation delivery fails.

### Remaining Hardening

- Add rate limiting before sharing the beta code broadly.
- Replace the shared beta code with per-pilot or per-cohort invitation codes.
- Add invitation status and revoke controls to the SagittaIQ admin interface.

## 2026-06-08 - Deployed And Verified Initial WorkOS Authentication

### Deployment

- Applied D1 migration `0016_workos_verified_identity.sql` and verified the
  `workos_user_id`, `auth_provider`, and `verified_at` columns.
- Disabled public WorkOS sign-up for the controlled beta.
- Committed and pushed the initial verified-account implementation in commit
  `26e8254`.
- Cloudflare automatically deployed the commit to `https://sagittaiq.com`.

### Production Verification

- `/api/health` returned HTTP 200.
- `/api/auth/session` returned the expected HTTP 401 without a session cookie.
- `/api/auth/login` returned HTTP 302 to WorkOS AuthKit.
- The production login redirect used
  `https://sagittaiq.com/api/auth/callback`.
- The login endpoint issued a secure, HTTP-only, SameSite=Lax CSRF state cookie.

### Remaining Human Verification

- Complete one hosted AuthKit sign-in.
- Confirm callback creates or links the expected D1 user.
- Confirm the UI displays **Verified account** and the existing candidate ID.
- Confirm session refresh and logout complete successfully.

## 2026-06-08 - Implemented Initial WorkOS Verified-Account Path

### Completed

- Confirmed the Cloudflare production environment contains correctly named
  encrypted `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and `WORKOS_COOKIE_PASSWORD`
  secrets.
- Added the WorkOS Node SDK and Cloudflare `nodejs_compat` configuration.
- Implemented server-side login, callback, session-refresh, and logout endpoints.
- Added CSRF state validation to the hosted authentication redirect flow.
- Added secure HTTP-only, SameSite=Lax sealed-session cookies.
- Added background session refresh before the five-minute access token expires.
- Added D1 migration `0016_workos_verified_identity.sql`.
- Added account linking that reuses an existing email-linked SagittaIQ user and
  candidate ID when possible.
- Added verified-account sign-in and sign-out controls while preserving the
  temporary beta code and PIN flow during migration.
- Allowed verified sessions to access the core analysis, opportunity, resume
  history, and current-user endpoints.

### Rollout Decision

Verified WorkOS authentication is being introduced as an additional access path
before removing the existing beta gate. This makes the rollout reversible and
protects existing candidate records while identity linkage is tested.

### Verification

- New JavaScript endpoint files passed Node syntax checks.
- `git diff --check` passed with only expected Windows line-ending warnings.
- A complete local TypeScript/Vite build could not be run because npm is not
  installed in the local execution environment. Cloudflare's deployment build
  must be reviewed before production testing.

### Required Before Production Login Test

- Apply `migrations/0016_workos_verified_identity.sql` to the production D1
  database.
- Confirm public WorkOS sign-up is disabled for the controlled beta.
- Deploy and verify the Cloudflare build.
- Test existing beta access, verified sign-in, callback, session refresh, linked
  candidate identity, and logout.

## 2026-06-08 - Stored WorkOS API Key In Cloudflare

### Completed

- Created the first WorkOS API key for the SagittaIQ web application.
- Stored the key in Cloudflare as the encrypted `WORKOS_API_KEY` secret.
- Kept the key out of chat, screenshots, source control, and frontend code.

### Next Steps

- Add `WORKOS_CLIENT_ID` using the SagittaIQ WorkOS application client ID.
- Generate and add `WORKOS_COOKIE_PASSWORD` as an encrypted Cloudflare secret.
- Implement and test the server-side authentication endpoints.

## 2026-06-08 - Completed WorkOS Application Redirect And Session Configuration

### Completed

- Configured the production AuthKit callback as
  `https://sagittaiq.com/api/auth/callback`.
- Configured the local development callback as
  `http://localhost:5173/api/auth/callback`.
- Configured the production sign-out destination as `https://sagittaiq.com/`.
- Configured the local sign-out destination as `http://localhost:5173/`.
- Configured the application homepage as `https://sagittaiq.com/`.
- Configured the sign-in endpoint as `https://sagittaiq.com/api/auth/login`.
- Set the maximum session length to 7 days.
- Kept the access-token duration at 5 minutes.
- Set the inactivity timeout to 12 hours.

### Decisions

- Keep WorkOS CORS allowed web origins empty because SagittaIQ will authenticate
  through server-side Cloudflare Pages Functions rather than calling WorkOS
  directly from the browser.
- Leave the application-level Sign-up URL, User invitation URL, and Password reset
  URL unset while hosted AuthKit manages those experiences.
- Use the SagittaIQ waitlist and future **Approve and invite** action to determine
  who receives beta access.

### Next Steps

- Create the first application API key and store it only as an encrypted
  Cloudflare secret. No active application API key existed at the time this
  configuration was completed, so no key rotation was required.
- Add `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and `WORKOS_COOKIE_PASSWORD` as
  encrypted Cloudflare production secrets.
- Implement and test the server-side authentication endpoints.

## 2026-06-08 - Prioritized Low-Touch Waitlist Approval And Invitations

### Objective

Make the controlled beta easier to operate by turning waitlist approval into a
single administrative action that creates a verified SagittaIQ account invitation.

### Decision

The next development milestone after completing the WorkOS AuthKit configuration
is an **Approve and invite** workflow in the waitlist administration area.

The waitlist remains SagittaIQ's source for deciding who receives beta access.
WorkOS AuthKit will provide the verified identity, invitation email, hosted
acceptance flow, and secure authentication lifecycle.

The WorkOS application-level Sign-up URL, User invitation URL, and Password reset
URL will remain unset while hosted AuthKit manages those experiences. These fields
do not determine who is approved from the SagittaIQ waitlist.

### Required Behavior

- An administrator can approve and invite a waitlist lead with one action.
- SagittaIQ sends the approved email address to the WorkOS Invitation API.
- Invitation state is visible as pending, accepted, expired, revoked, or failed.
- The accepted WorkOS user is linked to the existing `lead_id` and `candidate_id`.
- The operation is idempotent and does not create duplicate invitations or users.
- Public sign-up remains disabled during the controlled beta.
- WorkOS handles the invitation email and account-acceptance experience so routine
  approvals do not require separate outreach or manual account creation.

### Why

This preserves the value of the existing waitlist while replacing self-claimed
identity with verified accounts. It also reduces the amount of repetitive
coordination required to admit beta users and creates a clean foundation for
future institutional invitations and role assignments.

### Next Steps

- Finish WorkOS application and session configuration.
- Rotate the exposed staging API key and add encrypted Cloudflare secrets.
- Implement server-side AuthKit endpoints.
- Add invitation-linkage fields and status history to D1.
- Add the **Approve and invite** action to the waitlist admin interface.
- Test approval, acceptance, duplicate prevention, expiry, and revocation.

## 2026-06-08 - Selected Server-Side WorkOS AuthKit Integration

### Objective

Replace SagittaIQ's temporary shared beta-code and email/PIN identity model with
verified authentication that can support candidates, named administrators,
institutional memberships, and future role-based authorization.

### Process

1. WorkOS was selected as the preferred managed identity provider because AuthKit
   supports verified identity, hosted authentication, sessions, MFA, organizations,
   and a future path to institutional SSO.
2. A WorkOS staging environment was created and its branding flow was configured.
3. SagittaIQ platform-brand assets were exported for the WorkOS full-logo and
   square-logo fields.
4. The recommended button colors were set to SagittaIQ teal `#0F766E` with white
   text `#FFFFFF`.
5. The initial WorkOS onboarding flow surfaced the standalone SSO setup. That flow
   was rejected because standalone SSO does not provide the complete AuthKit
   identity and session foundation SagittaIQ needs.
6. After finding AuthKit's framework guides, the React client-only guide was
   initially recommended because SagittaIQ's visible frontend uses React/Vite.
7. The user challenged that recommendation because the earlier architecture
   discussion had selected a server-side authentication model.
8. The architecture was re-evaluated using the complete system rather than only
   the frontend framework: React/Vite frontend, Cloudflare Pages Functions backend,
   D1 data, sensitive resume records, planned multi-tenant roles, and administrative
   access requirements.
9. The React recommendation was explicitly withdrawn. The Node.js/server-side
   AuthKit guide was selected for implementation through Cloudflare Pages Functions.

### Final Decision

SagittaIQ will keep React/Vite for the interface and integrate WorkOS AuthKit
server-side through Cloudflare Pages Functions using the Node.js integration
pattern.

The intended authentication boundary is:

```text
Browser -> SagittaIQ Cloudflare Function -> WorkOS AuthKit
```

The browser should receive a secure HTTP-only session cookie. It should not receive
the WorkOS API key or long-lived refresh token. Proposed application endpoints are:

- `/api/auth/login`
- `/api/auth/callback`
- `/api/auth/session`
- `/api/auth/logout`

Expected encrypted Cloudflare configuration includes:

- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_COOKIE_PASSWORD`

### Why

Client-only React authentication would be faster to integrate, but it is a weaker
foundation for SagittaIQ's planned institutional permissions and sensitive data.
Server-side authentication makes it easier to protect every API route consistently,
use secure HTTP-only cookies, keep secrets and refresh tokens off the browser,
support named staff accounts, and enforce future organization roles.

Rewriting the application into Next.js or Remix solely for authentication would
create unnecessary cost and migration risk. Ruby and Python would add a second
backend stack without solving a current need. The Node.js pattern fits the existing
JavaScript Cloudflare Functions architecture.

### Correction And Lesson

The initial React recommendation was incorrect because it matched WorkOS to the
visible frontend technology instead of evaluating the complete security
architecture. Authentication, authorization, migrations, and data governance must
be treated as system-level architecture decisions. Framework-name matching is not
enough.

The user correctly identified the inconsistency before implementation began. No
React client-only AuthKit integration was installed.

### Security Notes

- WorkOS API keys must never be sent in chat, committed to Git, or placed in
  frontend code.
- The WorkOS application had no active application API keys when its initial
  redirect and session configuration was completed.
- AuthKit does not by itself complete institutional authorization. SagittaIQ still
  needs tenant-scoped memberships, role assignments, API authorization, migration
  of existing users, and security audit events.

### Risks And Open Questions

- Confirm WorkOS SDK compatibility with the Cloudflare Pages Functions runtime.
- Define secure cookie, session refresh, logout, and CSRF behavior.
- Decide how existing device-linked and email/PIN-linked records will attach to
  verified WorkOS users.
- Define the initial beta roles and which endpoints each role may access.
- Create staging and production redirect URIs before deployment.

### Next Steps

- Complete WorkOS AuthKit staging configuration using the Node.js guide.
- Create and securely store the first application API key when implementation
  begins.
- Design the account-linking and D1 identity migration.
- Implement authentication endpoints and protect one low-risk API route first.
- Add tests before replacing the existing beta gate.

### References

- Decision record: `docs/DECISIONS/0004-server-side-workos-authkit.md`
- Brand assets: `brand-assets/workos/`

## 2026-06-06 23:30 ET - Exported WorkOS Authentication Brand Assets

### Objective

Prepare SagittaIQ branding for the future WorkOS AuthKit authentication experience.

### Completed

- Exported a transparent full SagittaIQ platform wordmark for the WorkOS logo field.
- Exported a transparent square platform mark for the WorkOS logo-icon field.
- Added a repeatable export script and asset usage instructions.

### Verification

- Confirmed both PNG files exceed WorkOS's 160x160 minimum dimensions.
- Confirmed both PNG files remain below WorkOS's 100 KB upload limit.
- Visually inspected both exports at their original resolution.

### References

- Relevant files: `brand-assets/workos/`, `scripts/export-workos-brand-assets.py`

## 2026-06-06 23:00 ET - Reconstructed The Full SagittaIQ Build History

### Objective

Preserve how SagittaIQ was built from the first verified commit through its
evolution into a workforce-intelligence platform.

### Completed

- Reconstructed the dated implementation history from 56 Git commits.
- Connected all 15 database migrations to their product phases.
- Documented deployment failures, database setup lessons, workflow corrections,
  product-thesis changes, and institutional architecture decisions.
- Added `docs/BUILD_HISTORY.md` as the long-form historical narrative.

### Why

The feature list alone did not explain how or why the product changed. Preserving
the process protects the founder's accumulated reasoning and makes future technical
or commercial decisions easier to understand.

### Verification

- Compared the narrative against the full reverse Git log, commit statistics,
  migration timestamps, current architecture, and existing journal.

### Risks And Open Questions

- Exact timestamps for some strategic conversations were not independently
  available, so those decisions are attached to their nearest verified build period.

### Next Steps

- Continue adding dated entries as meaningful work and decisions occur.

### References

- Relevant file: `docs/BUILD_HISTORY.md`

## 2026-06-06 22:00 ET - Established Durable Project Memory

### Objective

Reduce founder dependency and make SagittaIQ understandable and recoverable
without relying on conversation history.

### Completed

- Added a dated project journal and reusable entry template.
- Documented the current architecture, database, Cloudflare operations, and roadmap.
- Added architecture decision records for scoring, tenancy, and identity direction.
- Recorded known operational and security risks instead of hiding them.

### Why

The product has advanced quickly across resume analysis, opportunity tracking,
waitlist research, follow-ups, institutional reporting, and admin analytics. The
reasoning was spread across conversations and commits. That speed created a
bus-factor risk: the software existed, but rebuilding the mental model would be
slow and expensive.

### Verification

- Compared documentation against current routes, API files, migrations, Wrangler
  configuration, and recent Git history.

### Risks And Open Questions

- Documentation must be updated as part of future meaningful changes.
- The current authentication and database migration approach still needs hardening.

### Next Steps

- Treat documentation updates as part of completing future product work.
- Build the institutional identity, tenancy, and role-based access foundation.

## 2026-06-06 - Defined Institutional Operating Model

### Objective

Define how SagittaIQ can serve multiple schools without turning every customer
implementation into a separate custom software project.

### Decisions

- Use a shared multi-tenant platform by default.
- Model each institution as an isolated organizational branch.
- Use the hierarchy Owner -> Platform Manager -> Manager -> Advisor -> Student.
- Allow Platform Managers to delegate routine staffing and assignments.
- Reserve dedicated deployments or Docker packages for premium customers with
  contractual isolation, residency, or customer-hosting requirements.
- Productize onboarding as a configuration wizard rather than custom code.

### Why

One deployment per institution would increase maintenance cost, fragment the
codebase, and turn implementation revenue into a consulting trap. A configurable
multi-tenant platform preserves recurring-margin potential while still supporting
paid onboarding.

### Risks And Open Questions

- The current database does not yet implement institutions, memberships, role
  assignments, or tenant-scoped authorization.
- Audit access must distinguish product analytics from security audit events.

### Next Steps

- Design institution, membership, assignment, invitation, and audit-event tables.
- Add verified staff identity and tenant-scoped authorization before broad rollout.

## 2026-06-06 - Completed Level 7 Product And Security Audit

### Objective

Assess whether the current product is ready for institutional deployment.

### Findings

- Product vision and feature breadth are strong for an early MVP.
- Security, governance, testing, and migration reliability remain prototype-grade.
- Email plus a self-chosen four-digit PIN is not verified identity.
- Shared admin and owner codes do not provide meaningful role separation.
- Admin access can expose retained raw resumes.
- Several migrations are not safely replayable because later migrations add
  columns already created by earlier migrations.
- Waitlist, follow-up, and event endpoints need stronger abuse controls.
- Current identity hashes are not a reliable long-term relational identity system.
- Admin summaries can silently undercount at larger volumes because of query limits.
- There are no automated tests or CI quality gates.

### Decision

The product can support a controlled beta after minimum hardening, but it should
not be represented as institution-ready security until verified identity,
tenant-scoped RBAC, audit controls, and migration reliability are implemented.

## 2026-06-06 - Locked Opportunity Readiness Scoring

### Objective

Stop the same resume and job description from receiving materially different
readiness scores across repeated AI runs.

### Completed

- Moved score calculation into deterministic application logic.
- Assigned scoring version `sagittaiq-readiness-v1.2`.
- Used AI to extract structured qualifications and produce narrative feedback.
- Saved extracted opportunity qualifications for reuse.
- Linked readiness history to opportunities instead of creating disconnected scores.
- Added dedicated opportunity job-description and qualification fields.

### Why

An institutional reporting product cannot use a score that changes merely because
an AI model phrased or interpreted the same input differently. AI remains useful
for extraction and feedback, while deterministic logic makes the score auditable.

### References

- Commits: `1181185`, `ba09906`, `5904444`, `19664d2`
- Migrations: `0013`, `0014`, `0015`

## 2026-06-02 to 2026-06-05 - Expanded Workforce Intelligence Workflows

### Completed

- Added waitlist discovery and research follow-up workflows.
- Added institutional reporting fields including programs, majors, degree levels,
  class years, student status, outcomes, employers, titles, and salary signals.
- Added academic profile fields including school, GPA, and certifications.
- Added user session and source/campaign event tracking.
- Added admin command-center views, follow-up workflow, institutional reporting,
  responsive UI improvements, public information pages, and product-family branding.

### Why

The product direction expanded from a resume analyzer into a workforce intelligence
system: career advisors need aggregated signals, follow-up outcomes, and cohort
reporting, while candidates need resume readiness and opportunity tracking.

### Risks And Open Questions

- Several data points currently depend on user input and need clear definitions.
- Outcome metrics require consistent follow-up and verification rules.
- FERPA and privacy obligations depend on institutional use and data handling,
  not merely whether a field is technically collectable.

## 2026-05-25 to 2026-05-29 - Built Initial Resume And Workforce Data MVP

### Completed

- Built Vite/React resume analysis workflow with Cloudflare Pages Functions.
- Added beta access, admin access, D1 resume records, opportunity captures, and users.
- Added structured resume profiles, AI analysis, retained resume text, and an admin dashboard.
- Added optional email-linked tracking, candidate IDs, editable opportunity records,
  salary fields, PDF reports, and relational links between users and records.
- Connected GitHub to Cloudflare Pages and configured the D1 binding.

### Lessons

- Cloudflare D1 Console executes SQL, not migration filenames.
- Cloudflare Pages only deploys what has been committed and pushed to GitHub.
- TypeScript build failures must be fixed before Pages can publish a new deployment.
- The initial shared-code identity model was useful for rapid validation but is not
  the correct long-term institutional authentication design.
