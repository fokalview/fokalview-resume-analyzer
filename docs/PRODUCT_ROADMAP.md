# SagittaIQ Product Roadmap

## Product Direction

SagittaIQ is a workforce-intelligence platform that uses candidate career activity
to help individuals improve readiness and help institutions understand pipelines,
support needs, and outcomes.

The strongest business direction is B2B institutional software with a useful B2C
candidate experience. Resume scoring is an entry workflow, not the full product.

## What Exists Today

### Candidate Experience

- beta access and candidate reference ID
- resume upload/paste and structured AI analysis
- deterministic, versioned readiness score
- strengths, gaps, section health, and prioritized recommendations
- complete readiness PDF export
- editable opportunity tracker with salary, status, notes, job description, and
  extracted qualifications
- opportunity-linked readiness history
- candidate dashboard and session tracking

### Administrative Experience

- workforce intelligence command center
- candidate, resume, opportunity, skill, tool, gap, and readiness analytics
- waitlist discovery, lead scoring, and source signals
- follow-up and reported outcome workflows
- institutional reporting fields and salary/outcome signals
- filters, exports, panel menus, responsive layout, and theme modes

### Platform Foundation

- GitHub source control and Cloudflare automatic deployment
- Cloudflare Pages Functions and D1 storage
- public product/privacy/about pages
- edge extension job handoff
- product-family branding

## Immediate Priority: Controlled Beta Reliability

### Next Development Milestone: Waitlist Approval To Verified Account

Connect the existing waitlist directly to WorkOS AuthKit so beta admission is an
invite-only, low-touch administrative workflow.

Required flow:

1. An administrator reviews a waitlist record and selects **Approve and invite**.
2. SagittaIQ creates a WorkOS invitation for the approved email address.
3. WorkOS sends and manages the secure invitation email and hosted acceptance flow.
4. When the invitation is accepted, SagittaIQ links the verified WorkOS user to the
   existing `lead_id` and `candidate_id` rather than creating a disconnected profile.
5. The waitlist record shows invitation status, sent time, accepted time, and the
   linked verified account.
6. Repeated approval actions must not create duplicate invitations or accounts.

Public sign-up should remain disabled during the controlled beta. The WorkOS
application-level Sign-up URL, User invitation URL, and Password reset URL can
remain unset while hosted AuthKit manages those flows.

This milestone is intended to eliminate separate outreach, manual account setup,
and repeated coordination for each approved beta user.

### Remaining Reliability Work

1. Complete server-side WorkOS AuthKit integration and verified sessions.
2. Replace shared admin codes with named administrative accounts.
3. Add rate limiting and endpoint abuse controls.
4. Create a clean replayable database baseline and migration ledger.
5. Add automated tests and a CI build gate.
6. Define raw-resume retention, deletion, export, and access procedures.
7. Add staging and perform a recovery drill.

## Next Priority: Institutional Foundation

1. Add institution, membership, role, invitation, and assignment models.
2. Enforce tenant scope in every institutional query.
3. Implement Owner -> Platform Manager -> Manager -> Advisor -> Student permissions.
4. Separate product analytics from append-only security audit events.
5. Build a configuration-driven institution onboarding wizard.
6. Add cohort definitions, reporting periods, and metric definitions.

## Product Validation Priority

Before building more large features:

- complete advisor and institutional buyer interviews
- run controlled student pilots
- measure activation, completed analyses, opportunity updates, follow-up response,
  advisor time saved, and verified outcomes
- test willingness to pay for a paid institutional pilot
- document which dashboard decisions institutions actually make

## Deliberately Deferred

- automated resume template rewriting
- complex multi-agent company research
- blockchain-based application verification
- many external ATS integrations
- dedicated deployment per customer by default
- broad marketing automation

These may become valuable, but they should not outrank verified identity, reliable
data, institutional authorization, customer discovery, and paid pilot evidence.

## Commercial Packaging Direction

- Paid implementation: configuration, imports, permissions, training, and launch.
- Annual platform subscription: institutional access, reporting, workflows, and support.
- Premium add-ons: integrations, dedicated deployment, advanced reporting, and
  contractual data-isolation requirements.

Onboarding should be fixed-scope and configuration-driven. One-off customer code
should be treated as expensive custom work, not silently included.
