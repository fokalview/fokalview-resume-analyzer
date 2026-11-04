# Waitlist contacts and follow-up

New waitlist and follow-up submissions retain readable, normalized email
addresses and supplied phone numbers in D1. The protected admin dashboard
provides contact details, labeled intake answers, follow-up context, and exports.
The public endpoints return submission acknowledgements without contact data.

## Existing records

Older records contain an email hash and domain classification, not the original
address. They remain visible and are explicitly marked as missing retained email.
Names, LinkedIn links, and other previously saved answers remain available.
Do not infer an email address from a person's name or domain. A separate verified
source or a new submission is required to fill the missing address.

Internal hashes and platform IDs remain unchanged. Changing the identity salt or
deleting historical records is unnecessary for this update.

## Deployment order

1. Verify the D1 database ID is `46d1ecde-8112-40fd-a9fc-0a3a1e147886` and
   inspect both waitlist tables. Establish a D1 Time Travel recovery bookmark
   before applying SQL, following the Cloudflare recovery runbook.
2. Confirm the six columns in `0019_waitlist_contact_details.sql` do not already
   exist. Apply only this additive migration to the inspected production schema.
   Preserve any existing migration ledger; do not replay historical migrations
   or claim earlier migrations were applied when no ledger exists.
3. Verify new columns and unchanged record counts. This migration does not
   update or delete existing rows, or reconstruct email addresses.
4. Deploy the matching code from GitHub after tests and build pass. Verify the
   Cloudflare deployment commit and public form notice.
5. Verify protected admin access and contact presentation using synthetic local
   data; do not put real contact records in tests, logs, commits, or screenshots.

For a fresh local database, use `npm run db:migrate`, which prepares the known
historical duplicate-column migrations before applying them locally.

## Access and exports

Readable contact details belong in protected administrative views. Public
submission responses must not echo the email or phone. Contact details are
included in admin exports so an authorized operator can follow up. Treat those
downloads as contact records; the CSV export neutralizes spreadsheet formulas
in user-entered text. JSON exports preserve the structured record.

This change sends no invitations, outreach messages, or marketing emails.
