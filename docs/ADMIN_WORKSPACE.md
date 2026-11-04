# Admin contact workspace

Open `/admin?view=waitlist`. Waitlist is the default view. The visible release
label includes a short Cloudflare build commit so a refreshed deployment can be
distinguished from an old browser tab. Admin HTML and protected API responses use
`Cache-Control: no-store`. The static header syntax follows
[Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Contacts and submitted answers

Readable email, phone and complete signup/follow-up snapshots were introduced in
migration 0019. Historical email hashes cannot reconstruct an original address.
The admin explicitly distinguishes an old unretained email from a new omitted
optional field. All retained answers remain available in grouped detail views
and labeled CSV/JSON exports, including explicit zero and false values.
Each contact also links to its complete matched survey history, including when
searching by a name that does not appear in the survey itself. Survey rows show
the matched contact's name when a saved identity provides that link.

Signup validation now checks the required organization/company name in every
organization branch. An optional student GPA must be a decimal on the labeled
0–4 scale; invalid input is rejected without silently changing or dropping it.
All provided LinkedIn links are validated, regardless of preferred contact
method, and common `linkedin.com/...` links are normalized to HTTPS. Switching
away from the student branch preserves the local GPA draft without submitting
an inactive field.

## Complete dashboard information

The contact workspace also keeps the earlier operational and institutional
reporting visible. Overview, Institutional reporting, and Main application sit
alongside Waitlist, Follow-ups, and Reports. Session engagement, usage trends,
academic distributions, lead scores, funnels, skill gaps, source breakdowns,
readiness, and retention information remain available. Country and email-domain
breakdowns are explicitly labeled as resume-record cohorts.

The restoration changes presentation only. The existing admin authentication
and access code are unchanged. All original summary properties and record
details remain in the API; no signup, survey, resume, or application records
are deleted or rewritten. Historical outcome responses remain available while
aggregate reporting uses the corrected definitions below.

Main lists show contacts before reporting charts. Local pagination changes the
visible page, not export completeness. Search and filters identify their scope.
The summary retrieves complete source datasets rather than silently limiting
them to the most recent 1,000 records; the analysis list no longer hides records
after the first 20. At larger scale this complete-data endpoint should be replaced
by server-side aggregate queries and cursor-based list/export endpoints together,
so metrics and exports cannot accidentally become page-only totals.

## Outreach and survey responses

`/api/admin/outreach` is protected with the existing admin/owner access code.
It stores an assigned owner, contact status, notes, last contact date and next
follow-up date. These are administrator-entered outreach plans, separate from
participant-submitted outcome surveys. No email or text is sent by saving a plan.

Migration 0020 adds one append-only table and its index. It does not change or
delete signup, survey, resume or application records. Every saved plan is a new
revision. Conditional inserts reject edits based on an outdated revision with
HTTP 409. The full previous history remains available. Shared admin access does
not establish the identity of an individual editor; the owner field indicates
responsibility and is not represented as an authenticated audit identity.

## Reporting definitions

- Placement uses explicit successful status values, not a substring match that
  also catches "Not placed".
- Outcome totals use the latest response for each matched respondent; raw survey
  submissions remain available as history. Repeated cumulative progress reports
  are not summed as independent people.
- Follow-up coverage counts distinct matched contacts within the stated cohort.
  People, records and application/interview/offer events remain separate units.
- Salary summaries are grouped by stated currency and pay period. Mixed units
  are never averaged together or silently annualized. A missing amount differs
  from zero. Currency was not retained in older submissions, so those raw amounts
  remain visible while their averages are unavailable. New responses can include
  an optional three-letter currency code in the existing response snapshot.
- Missing career levels remain Unknown, valid zero GPA values remain visible,
  and each skill is counted once per analysis in affected-record percentages.
- Source query failure is an unavailable response, not a successful empty table.
  The client preserves last successfully loaded data and displays the failure.

## Release and rollback

1. Run unit coverage, production build, Pages function compilation, local
   migrations (including a rerun), and browser integration tests against local
   D1 with synthetic records.
2. Capture a production D1 Time Travel bookmark before applying 0020. Apply only
   the additive 0020 statements; do not replay historical migrations. Verify
   the new schema and unchanged signup/survey counts.
3. Merge the reviewed change only after GitHub quality checks pass. Verify the
   production Pages deployment uses the merged commit, then reload the public
   domain and confirm the same short build identifier.
4. A code rollback can redeploy the prior Pages build; leave the additive table
   in place so any newly saved outreach history remains preserved. Do not restore
   an older database bookmark without separately preserving newer submissions.

CI uses an explicitly synthetic local admin code to exercise the protected
workflow. Real access codes and production contact records must never be copied
into fixtures, screenshots, source control or logs.
