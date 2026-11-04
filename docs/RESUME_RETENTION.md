# Saved resume sources

This release keeps resume sources independently of analysis reports. The original file is saved before browser extraction. An immutable structured snapshot is acknowledged by D1 before an AI request starts. A failed analysis or deletion of a review/opportunity does not delete these sources.

## Downloads and application access

- Student Dashboard → **Saved resumes** lists every retained source, including uploads without a completed analysis.
- Opportunities → an opportunity → **Saved resume versions** lists linked snapshots.
- Admin → **Main application** → **Retained resumes** offers authenticated original, text and JSON downloads.
- Original uploads and extracted/edited versions are separate records. A snapshot references the original without copying or replacing its bytes. Saved job details are attached to each version; later edits to an opportunity do not rewrite them.
- Historical analysis records remain available. Missing historical originals or layout cannot be reconstructed.

`GET /api/resume-sources` uses the verified owner's session. The admin equivalent is `GET /api/admin/resume-sources` with the existing admin access-code header. Both support `?id=...&format=original|text|json`, cursor pagination and opportunity filtering. Download responses are attachments with private/no-store caching. R2 keys are never returned, and the bucket must remain private.

## Structured format

The JSON download envelope contains server provenance, `resumeDocument`, exact `resumeText`, `targetRole`, exact `jobContext`, `position`, and application/source identifiers. `resumeDocument.schemaVersion` is `sagittaiq-resume-v1`.

PDF blocks contain stable IDs within that source version, page number, text, reading order, normalized top-left geometry (`x`, `y`, `width`, `height` from 0–1), original transforms and available font/direction information. Page metadata includes dimensions and rotation. PDF reading order follows the extraction order and is explicitly marked as potentially ambiguous for columns; it is not a guarantee of human reading order or lossless rendering. Use the original PDF for exact appearance.

DOCX/ODT preserve logical paragraph/table paths and runs without inventing rendered page coordinates. Text formats preserve their text and logical order. Scanned or unreadable documents keep the original and expose extraction warnings; this release does not perform OCR. After a user edits extracted text, the new text snapshot has no page geometry, while the original file remains linked and downloadable.

Limits: 10 MiB original file, 100 PDF pages, 50,000 text characters, 5,000 total blocks/runs, 1 MiB structured document, 30,000 job-context characters. Oversized input is rejected visibly instead of being silently truncated. Every retry includes an idempotency key; reuse with different content returns 409.

## Deployment prerequisites

Do not merge/deploy this release until the private file-storage bucket and database migration are ready.

1. The account owner must activate Cloudflare R2 if it is not active. Cloudflare presents subscription terms and usage-based billing; this is an account-owner action.
2. Create private bucket `sagittaiq-resume-files` in the same Cloudflare account as the Pages project. Leave public development URLs/custom-domain access disabled. Do not add automatic expiry rules that would silently remove retained resumes.
3. `wrangler.toml` binds that bucket as `RESUME_FILES`. Use a separate private preview bucket if enabling a preview environment; do not allow preview tests to write production personal data.
4. Record the current D1 recovery bookmark/export using the project's migration procedure. Inspect `PRAGMA table_info(resume_records)` and the migration ledger before applying `migrations/0021_resume_sources.sql` once. It creates the separate source table and adds nullable `resume_records.source_id`; it does not alter existing content. Follow `docs/MIGRATIONS.md` for production preparation.
5. Deploy the tested commit. Verify signed-out rejection, owner access, admin downloads, exact original bytes, saved layout/text/job JSON and source availability after a failed analysis using clearly synthetic records.

If R2 is missing, original uploads return an explicit 503 and the UI blocks analysis of the unconfirmed upload. Pasted text/JSON snapshots can still use D1. Do not report an original file as saved based only on extraction or an attempted request.

## Local verification and rollback

`wrangler.local.toml` has only local D1/R2 bindings and no remote AI binding. Use synthetic credentials and documents. Run `npm run test:coverage`, `npm run build`, `npm run pages:check`, `npm run db:migrate` twice, and `npm run test:e2e`.

Rollback the app to the previous release if necessary; preserve the additive source tables and R2 objects. Never drop retained data as an application rollback. Deletion requests must account for both D1 snapshots and referenced R2 originals; deleting a review alone intentionally does not satisfy such a request.
