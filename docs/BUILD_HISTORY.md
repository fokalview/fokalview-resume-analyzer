# SagittaIQ Build History

## Purpose And Evidence

This document reconstructs how SagittaIQ was built and how its product direction
changed over time. It is intended to preserve the process, not merely list features.

The dates and implementation details are grounded primarily in:

- Git commit timestamps and commit contents
- database migration creation dates
- Cloudflare deployment and D1 setup troubleshooting
- product and architecture decisions recorded during the build

Git provides exact implementation dates. Strategic conversations are attached to
the nearest verified implementation period when an exact discussion timestamp is
not independently available.

## Executive Summary

SagittaIQ began on May 1, 2026 as a focused AI resume analyzer. In slightly more
than five weeks, it evolved into an early workforce-intelligence platform with:

- candidate resume readiness and opportunity tracking
- structured resume and job qualification data
- waitlist discovery and longitudinal follow-up
- institutional outcome and academic profile reporting
- administrative workforce analytics
- campaign and session measurement
- a Cloudflare-hosted application and D1 database

The central product insight changed during the build. Resume scoring remained an
important candidate-facing workflow, but the larger opportunity became the data
and operating layer around career readiness, applications, advising, and outcomes.

The build moved extremely quickly because decisions, implementation, deployment,
and testing happened in the same working loop. That speed created substantial
product breadth, but it also left security, identity, migration reliability, and
automated testing behind the feature pace. The next phase is therefore not simply
more features. It is turning the working MVP into a reliable institutional platform.

---

## Phase 1: The Resume Analyzer Prototype

### May 1, 2026 - Initial Product Built

Verified commits:

- `f54b61c` - Initial AI resume analyzer app
- `379e6b6` - Add beta access gate and Docker deploy path
- `8c47b8d` - Add beta terms and privacy notice
- `c87d566` - Configure resume subdomain handoff

The first version was already more than a static prototype. It established the
core technical shape that remains today:

- React, TypeScript, and Vite frontend
- server-side AI API boundary
- Cloudflare Pages Functions support
- local Node server option
- Edge browser extension for capturing job context
- upload, results, and feedback workflows
- Cloudflare deployment documentation

The first commit contained approximately 2,594 inserted lines across 32 files.
The AI API was deliberately kept behind a server boundary so the provider key
would not be exposed in frontend code.

The product was immediately placed behind a beta access gate. Docker support was
added as an optional deployment path, while Cloudflare Pages remained the intended
primary host. Terms and privacy language were added during the same first evening,
showing that data handling was recognized as part of the product from the beginning.

The browser extension and resume subdomain handoff established an early version of
the future opportunity workflow: capture a job elsewhere, then bring its context
into the resume analyzer.

### May 2, 2026 - Deployment Reliability And Document Uploads

Verified commits:

- `1237ece` - Fix TypeScript module resolution for Cloudflare build
- `543b26f` - Trigger Cloudflare rebuild
- `8a02131` - Add TypeScript build type dependencies
- `d5571cd` - Support standard resume document uploads

The second day exposed an important operational lesson: a working local product is
not automatically a deployable product. TypeScript module resolution and missing
build-time type dependencies prevented Cloudflare from building successfully.
Those failures were corrected and a rebuild was triggered.

Document support expanded beyond pasted text. The upload workflow gained support
for standard resume document formats, making the product meaningfully easier for
real candidates to use.

At the end of this phase, SagittaIQ was still fundamentally a resume analyzer, but
it had a deployable architecture, a beta gate, privacy language, an extension, and
a realistic upload workflow.

---

## Phase 2: From Resume Feedback To Stored Workforce Data

### May 29, 2026 - The Product Becomes A Data Platform

Verified commits:

- `06d5864` - Add workforce storage and admin dashboard
- `97fbee2` - Configure Cloudflare D1 binding
- `f4b3b09` - Make beta terms cover resume storage
- `17f718c` - Add optional email tracking and usage dashboard
- `c4711eb` - Link applications to resume reports
- `52c38ca` - Add relational user IDs
- `52d9cc7` - Fix report and application build types
- `11b8af9` - Fix report optional analysis type
- `388840a` - Import analyzed jobs into applications
- `4ace47e` - Make applications editable and capture salary
- `1856231` - Add admin search and user analytics buckets

Database migrations created:

- `0001_application_captures.sql`
- `0002_users_relations.sql`
- `0003_application_salary.sql`
- `0004_user_analytics_metadata.sql`

This was the decisive product expansion. The application moved from returning
temporary feedback to storing structured workforce data in Cloudflare D1.

The first D1 schema added:

- application and opportunity captures
- structured resume profiles
- AI analysis records
- optional retained raw resume text
- target roles and job context

An administrative dashboard was introduced to consolidate readiness, applications,
skills, tools, gaps, career levels, and recent records. A second-level admin code
was used as a rapid beta access model.

The user explicitly clarified that resume storage should be part of the beta usage
terms rather than a separate checkbox on every analysis. The product was adjusted
so the terms covered structured profile storage and optional raw resume retention.

Optional email tracking was added so candidates could recover or link their
activity across devices. To avoid displaying email addresses directly, the system
used hashed identity and exposed human-readable candidate IDs. This was useful for
early relational tracking, though later analysis identified it as an inadequate
long-term identity foundation.

The application tracker was connected directly to resume analysis. A job analyzed
against a resume could become an opportunity record automatically. Users could then
edit status, notes, location, salary, and other details after the initial analysis.

The day also included real deployment debugging:

- Cloudflare initially failed TypeScript builds.
- Report and application types were corrected in follow-up commits.
- The D1 database and binding were configured.
- Tables were manually created and verified through the Cloudflare D1 Console.

The most important shift was conceptual: candidate interactions were no longer
only producing feedback. They were generating a longitudinal workforce dataset.

---

## Phase 3: Discovery, Waitlist, And Brand Formation

### May 30, 2026 - Waitlist Discovery And SagittaIQ Identity

Verified commits:

- `6c410c7` - Add waitlist discovery workflow
- `eb08079` - Refresh waitlist landing design
- `b8851d4` - Improve waitlist accessibility contrast
- `87d705e` - Rebrand core workflows for SagittaIQ

Database migration created:

- `0005_waitlist_discovery.sql`

The waitlist stopped being a simple email collection form and became a customer
discovery instrument. It collected:

- user and organization type
- role and location
- current tools
- biggest challenge
- desired features
- interview, beta, pilot, and budget interest
- referral/source information

These fields allowed the admin dashboard to start answering commercial questions,
not only candidate-readiness questions. The waitlist could identify who was
interested, why they were interested, and who might be a pilot or buyer.

The page design was refreshed, followed by a deliberate accessibility contrast
improvement. This established an ongoing product principle: the interface should
be visually compelling without making institutional accessibility an afterthought.

The application was rebranded around SagittaIQ. Language shifted from a narrow
"AI resume analyzer" toward career readiness and workforce intelligence.

---

## Phase 4: Shared IDs, Lead Scoring, And Longitudinal Follow-Up

### June 2, 2026 - The Platform Model Emerges

Verified commits:

- `cba0e40` - Update SagittaIQ page metadata
- `6eedbd5` - Add shared platform IDs and lead scoring
- `7a1540a` - Add opportunity delete action
- `4742dce` - Add expandable opportunity notes
- `14c517e` - Implement branched waitlist intake
- `5f3e86e` - Add waitlist follow-up research workflow
- `b669d68` - Add waitlist outcome visualizations
- `3b4fcb3` - Improve waitlist validation and theme modes
- `f2b4106` - Add waitlist approval popup
- `fdf51a6` - Add candidate readiness dashboard
- `82a3941` - Add user security code beta gate
- `29e5c11` - Add per-user beta PIN gate
- `a6491cf` - Upgrade admin intelligence dashboard
- `c0ea9cf` - Add admin dashboard view switch
- `68d2da8` - Move admin view switch to sidebar
- `b1ec6bb` - Limit admin keyword metrics by default

Database migrations created:

- `0006_shared_ids_lead_scoring.sql`
- `0007_waitlist_branching_intake.sql`
- `0008_waitlist_research_followups.sql`
- `0009_user_security_pin.sql`

This was the largest single day of product expansion.

#### Shared Platform IDs

SagittaIQ added sequential, human-readable IDs for:

- leads
- contacts
- organizations
- candidates
- applications
- pilots
- reports

This created a shared reference language between candidate and admin experiences.
A candidate could provide an ID to an administrator, and the administrator could
relate that person to resumes, opportunities, and follow-up records.

#### Lead Scoring And Branched Intake

The waitlist became adaptive. Different user types could provide different details,
including candidate goals, institutional workflows, populations served, reporting
needs, and buying signals. Lead scores, priorities, and recommended actions were
added to help focus outreach.

#### Follow-Up And Outcomes

A separate follow-up workflow was created to collect longitudinal signals:

- current status
- applications, interviews, and offers
- placement status
- current role and industry
- salary range
- support needed

The admin dashboard gained visualizations for waitlist conversion and follow-up
outcomes. This was the first concrete implementation of SagittaIQ as an outcomes
measurement system rather than only an intake system.

#### Candidate Dashboard And Opportunities

The candidate experience gained its own readiness dashboard. Opportunity records
could be deleted, edited, and expanded to show full notes. This reflected an
important workflow correction: job data imported from an analysis is only a
starting point; candidates need to maintain it over time.

#### Accessibility And Themes

Validation errors were made visible within fields, and light/dark theme modes were
added. A waitlist approval popup provided clear confirmation after submission.

#### Temporary Beta Security

A per-user four-digit PIN was added beneath email and beta access code entry. This
was intended as a lightweight second factor for beta users. It improved casual
account separation, but later security review correctly concluded that a
self-chosen PIN without verified email ownership is not true authentication.

#### Admin Information Architecture

The admin dashboard grew substantially. View switching was first added near the
top, then moved into a sidebar after testing showed that a top switch did not solve
the navigation problem. Large keyword lists were collapsed to a top-ten default
with expansion, reducing scroll burden.

The product was now visibly splitting into connected candidate, discovery,
follow-up, and administrative systems.

---

## Phase 5: Institutional Reporting

### June 3, 2026 - Career Outcomes And Academic Context

Verified commits:

- `d4292d1` - Add institutional reporting fields
- `fb4a272` - Add academic profile reporting fields
- `68fea64` - Add admin follow-up workflow view

Database migrations created:

- `0010_institutional_reporting.sql`
- `0011_academic_profile_fields.sql`

The data model expanded to support the types of reporting commonly performed by
career-development offices and institutional research teams.

New intake and reporting fields included:

- program and major
- degree level and class year
- student and seeking status
- domestic/international classification
- school name
- GPA
- certifications
- employer and job title
- salary amount and period
- outcome date and job location
- outcome source and verification status

The admin dashboard gained a dedicated follow-up workflow view so administrators
could distinguish pending outreach from completed follow-up work.

The product direction was now explicit: candidate resume and application behavior
could reduce manual outcome collection and create earlier indicators than a
traditional end-of-year survey alone.

This phase also introduced a governance tension that remains important. The system
can technically collect extensive academic and career data, but institutional use
requires careful purpose limitation, retention, access control, and legal review.

---

## Phase 6: Usage Measurement And Administrative Command Center

### June 4, 2026 - Measuring Engagement And Improving Administrative Usability

Verified commits:

- `39f874e` - Add session analytics tracking
- `e504ac7` - Clarify job description input label
- `77eb171` - Redesign admin dashboard command center
- `f52d203` - Apply command center across admin views

Database migration created:

- `0012_user_events_session_metrics.sql`

Session analytics were added so SagittaIQ could measure:

- sessions
- page paths
- source and campaign
- duration
- user, candidate, and lead associations

This enabled campaign URLs such as a Handshake pilot link to be attributed through
UTM parameters. It also gave the admin side evidence about whether people merely
visited or actually spent time in the product.

The job-context input was renamed more clearly as the job-description box. This
small copy change reflected a broader UI principle: use language candidates already
understand rather than internal product terminology.

The admin dashboard was redesigned toward a command-center interface and then
applied consistently across administrative views. The goal was to support repeated
work, scanning, and decisions instead of presenting a long wall of raw metrics.

---

## Phase 7: Product Family, Responsive Experience, And Decision Design

### June 5, 2026 - Unifying The Product Experience

Verified commits:

- `c11d1ae` - Add SagittaIQ product family branding
- `c5bb849` - Overhaul responsive UI and admin decision insights
- `c30b00c` - Convert about drawer into public pages
- `9aed8dd` - Unify product experience and decision workflows

SagittaIQ's visual identity expanded into a product family. Related logos and
branding were used to distinguish candidate and institutional experiences while
keeping them visibly connected.

The interface was overhauled to behave better across mobile, common laptops, and
wide screens. Score context was added so a readiness percentage would not appear
as an unexplained number. Administrative insights moved closer to decision support:
what changed, what requires attention, and what action should follow.

An early public-information drawer was replaced by dedicated named pages:

- About
- How It Works
- Data And Privacy
- Product Family

This corrected an important usability issue. Visitors could understand the product
before entering a beta code, and the information became linkable and navigable
rather than hidden inside a secondary window.

The results and workflow experience were unified. Separate feedback presentation
was consolidated into a more coherent readiness report and decision flow.

---

## Phase 8: Stable Scoring And Opportunity Intelligence

### June 6, 2026 - Making Readiness Auditable

Verified commits:

- `1f98715` - Export complete readiness report
- `4599a01` - Link readiness history to opportunities
- `1181185` - Lock readiness scores to fixed rubric
- `ba09906` - Recalibrate fixed readiness rubric
- `5904444` - Add opportunity job description records
- `19664d2` - Extract and lock opportunity qualifications

Database migrations created:

- `0013_opportunity_readiness_tracking.sql`
- `0014_opportunity_job_description.sql`
- `0015_opportunity_job_qualifications.sql`

The complete readiness report was made exportable as one document rather than
requiring separate downloads for results, feedback, and opportunities.

Repeated analysis had revealed a serious trust problem: the AI-generated readiness
score could change each time the same resume and job description were analyzed.
That behavior is unacceptable for longitudinal reporting or institutional use.

SagittaIQ therefore separated AI judgment from numeric scoring:

- AI extracts structured qualifications and produces narrative feedback.
- versioned deterministic code calculates the readiness score.
- extracted qualifications are stored and reused.
- the score and analysis history are linked to the existing opportunity.

The scoring rubric was recalibrated after initial testing. Job descriptions became
dedicated opportunity fields, and AI-extracted qualifications became structured
opportunity data.

This was a meaningful maturity step. The product moved from "AI gives a score" to
"the platform can explain which versioned logic produced the score."

### June 6, 2026 - Architecture And Business Model Clarified

Strategic decisions recorded during this period:

- SagittaIQ should primarily be positioned as B2B workforce-intelligence software,
  with a valuable B2C candidate experience.
- Resume scoring is an acquisition and engagement workflow, not the entire moat.
- Institutional reporting, longitudinal outcomes, and advisor workflow efficiency
  are the strongest sources of value.
- Onboarding can carry an implementation fee, but normal customer configuration
  must not require custom engineering.
- The default architecture should be one multi-tenant platform, not one Docker
  deployment per institution.
- Dedicated deployments should be reserved for premium isolation requirements.
- The target hierarchy is Owner -> Platform Manager -> Manager -> Advisor -> Student.
- Verified identity, tenant-scoped permissions, and audit controls are required
  before claiming full institutional readiness.

### June 6, 2026 - Honest Readiness Audit

A full product and security audit identified the central gap between the current
MVP and a production institutional platform:

- shared codes and optional email/PIN are not sufficient identity
- there is no true multi-tenant authorization boundary
- raw resume access requires stronger governance
- migrations are not reliably replayable
- endpoints need abuse protection
- analytics and security audit events need separation
- admin aggregation queries need scale-safe design
- automated tests and CI are missing

The conclusion was not that the product idea had failed. The conclusion was that
feature development had outpaced platform hardening. SagittaIQ could support a
controlled beta after targeted improvements, but broad institutional deployment
requires a deliberate security and data-governance phase.

### June 6, 2026 - Project Memory Established

The speed of the build created a final operational concern: too much reasoning
lived in conversation history. A durable project-memory system was added:

- dated journal
- architecture reference
- database reference
- Cloudflare operations and recovery runbook
- product roadmap
- architecture decision records
- repeatable timestamped journal-entry command

This build history completes that system by reconstructing the process from the
first verified commit.

---

## How The Product Thesis Evolved

### Original Thesis

Candidates need AI feedback that helps tailor a resume to a job.

### Expanded Thesis

Candidates also need a persistent record of opportunities, readiness, improvements,
applications, interviews, offers, and outcomes.

### Institutional Thesis

Career advisors and workforce organizations spend too much time manually editing
resumes and collecting fragmented outcome data. SagittaIQ can automate readiness
analysis and career-activity capture so advisors can spend more time advising.

### Current Thesis

SagittaIQ is a workforce-intelligence and career-operating platform. Candidate
tools create immediate value and generate structured longitudinal data. Institutions
use the aggregated data to understand readiness, pipelines, interventions, employer
demand, and outcomes.

---

## Major Lessons From The Build

1. A resume analyzer is relatively easy to copy; a trusted longitudinal workforce
   dataset and operating workflow are harder to replace.
2. AI-generated narrative is useful, but important metrics must be deterministic,
   versioned, and explainable.
3. Data collection becomes valuable only when it supports a decision or workflow.
4. Institutional buyers require identity, authorization, governance, and reporting
   rigor that candidate-facing prototypes can temporarily avoid.
5. Fast feature development creates leverage, but undocumented reasoning and
   replay-unsafe infrastructure create hidden dependency.
6. Customer discovery and paid pilots now matter more than another broad feature.
7. Accessibility, responsive behavior, and clear information architecture are part
   of product credibility, especially for institutional software.
8. Implementation fees can be valuable, but onboarding must remain configuration,
   not an expanding custom-development obligation.

## Current Position As Of June 6, 2026

SagittaIQ has a working, unusually broad early MVP. It can demonstrate the complete
story from discovery through candidate readiness, opportunity tracking, follow-up,
and administrative reporting.

The product's next constraint is not whether another feature can be built. The
constraint is proving that institutions will adopt and pay for the workflow while
hardening the system enough to responsibly serve them.

The highest-value next work is:

1. Run controlled pilots and document advisor time saved and candidate outcomes.
2. Replace temporary identity/access methods with verified named accounts.
3. Implement tenant-scoped institutional roles and assignments.
4. Repair migration reliability and add automated tests.
5. Define data retention, access, correction, deletion, and audit procedures.
