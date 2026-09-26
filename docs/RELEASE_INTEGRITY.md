# Release integrity implementation

This implements the first phase of the September 26 process audit. It does not complete the evaluation, clarification workflow, telemetry, retention UI or broader reporting changes in phases two and three.

## Assessment provenance

New analysis responses contain an HMAC receipt covering the complete analysis JSON, the authenticated internal user ID, and hashes of the resume, posting and target role. Receipts expire after 24 hours. The signing domain is separate from session-cookie use. `ANALYSIS_SIGNING_SECRET` is preferred; otherwise the existing `WORKOS_COOKIE_PASSWORD` is used. The chosen secret must be at least 32 characters. Never expose these secrets to the client.

Both save endpoints verify receipts before trusting analyzed findings. Resume saves also verify all source hashes and derive the structured profile from the signed result. Opportunity saves verify the posting hash. Arbitrary metadata-only opportunity saves remain supported. New unsigned analyzed writes are rejected, including historical-shaped submissions; existing stored reviews remain readable. Receipts attest which output the server generated; they do not prove that the model interpreted the source correctly.

## Save recovery

Each receipt has a stable random review ID. The resume record primary key is derived from it, so retrying an insert returns the original report. Opportunity history uses a persistent receipt ledger and a D1 batch transaction to apply each review once. A failed history batch rolls back the marker and history update together. Metadata may already be saved; retry reconciles it. This is recoverable multi-step persistence, not one transaction covering the entire workflow.

The candidate app keeps the completed result and original inputs in memory on failure. Retry save skips AI and skips an opportunity save already acknowledged. A lost response can safely be retried. Users can view/download the unsaved report or explicitly discard the pending review. Closing/reloading warns about pending work. This is not durable draft storage: closing the page loses the in-memory pending result. An expired receipt requires a new review unless the result was already saved.

## Administration

Admin reads require a verified WorkOS session and an explicit immutable user-ID allowlist. Configure `ADMIN_USER_IDS` and/or `OWNER_USER_IDS` as comma- or whitespace-separated WorkOS user IDs. Neither email domains nor old shared access codes grant access. Both roles can read the current summary; more granular role permissions are future work. The browser no longer stores or submits shared admin codes.

Each authorized summary read is logged with actor ID, role, action and timestamp. The log contains no search query or resume text. Browser-generated exports use the already-read summary; separate export-event tracking is not implemented here. Raw resume text and the hidden searchableText field are removed from the summary response and raw resume search. Server-side matching uses limited identifiers and profile metadata.

Follow-up matching uses namespaced lead/candidate/contact IDs, never email domains. Readiness rows, historical denominators and empty states no longer interpret v2 null scores as zero. Broader salary/cohort metrics and pagination remain audit follow-ups.

## Deployment prerequisites

1. Apply migrations `0019_review_save_receipts.sql` and `0020_admin_access_events.sql` using the existing migration workflow. Both add new tables/indexes without rewriting candidate records.
2. Configure at least one approved WorkOS administrator/owner user ID. An empty allowlist denies access; there is deliberately no shared-code fallback. Do not deploy the admin change until the intended user's ID is confirmed.
3. Verify the signing secret length and keep the same secret across the analysis and save requests. Rotation invalidates pending receipts, not stored historical results. Test preview with isolated bindings before production.
4. Check a verified review, simulated save retry, historical report read, admin sign-in and audit log write. Existing tabs holding unsigned analyses from the old build cannot newly save those results after upgrade; download them before switching.

No production migrations, environment changes, merge or deployment are performed by this implementation task. PR 4 remains the review point. Assessment completeness and cross-occupation model validation remain required before claiming calibrated readiness.
