# Admin data clarity and preservation

This release improves the existing admin workspace, public signup and progress follow-up forms. All six admin destinations, original answers, saved analyses, outreach revisions, report categories and CSV/JSON exports remain part of the product.

## Data meaning

- Public follow-up answers are self-reported. A respondent's verification claim is retained as a claim, not promoted into independent attestation.
- A response can match a saved contact group, but cannot merge two previously separate signup groups. Contradictory historical responses remain available for review and do not contribute to matched coverage or outcome totals.
- Optional numeric answers preserve missing separately from zero in response snapshots and protected projections. Counts accept only nonnegative integers; pay amounts preserve decimal values. Compensation summaries keep currency and period separate.
- Category aggregation returns the complete category set. Presentation may show an initial subset, but must label its scope and offer the full values and export.
- Average recorded session duration uses sessions with a positive measured duration. The measured and unmeasured populations are reported explicitly. A missing measurement does not establish no engagement.
- An old open application is described by its age, without claiming that no recent activity occurred. Empty populations have an insufficient-evidence state.

## Preservation boundaries

No schema migration, destructive cleanup, contact backfill or historical answer rewrite is required. Existing hashes are internal references; absent original contact details cannot be reconstructed from them. The additional reporting columns observed in production are retained through explicit allowlists where exposed by protected reports. Unknown historical meanings are not used to invent new outcome or activation metrics. Authentication secrets are never part of those reporting envelopes.

The public forms keep their existing audience branches and questions. Searchable suggestions accept custom values. Small option sets remain native selectors. Branch drafts remain available when switching audience; only applicable branch values influence normalized reporting. Original submissions and form version provide context for future interpretation.

## Interface behavior

The workspace uses the existing teal identity, readable system typography, consistent controls, grouped details and responsive layouts. Follow-up work queues are separate from historical progress responses. Reports explain population, data source, freshness and missingness, and retain exact values alongside charts. Keyboard, focus, reduced-motion and light/dark behavior must be verified with functional tests and visual review.

## Release and recovery

1. Run unit coverage, production build and Pages Functions compilation.
2. Rehearse migrations and browser tests in an isolated local checkout using synthetic credentials, a local-only D1 binding and no remote AI binding.
3. Review field preservation, complete exports, numeric/identity edge cases and all six admin views.
4. Publish the reviewed commit through GitHub and verify the matching Cloudflare deployment and live build identifier.
5. If recovery is necessary, redeploy the preceding application commit. Because this release does not change the production schema or rewrite records, application rollback requires no database rollback. Responses newly collected by this release retain their original snapshots.

Cloudflare Pages builds use `.node-version` so the declared Node 24 engine is used instead of the default Node 22 image. See [Cloudflare build-image configuration](https://developers.cloudflare.com/pages/configuration/build-image/).
