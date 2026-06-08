# ADR 0003: Verified Identity As Canonical User Foundation

- Status: Accepted
- Date: 2026-06-06

## Context

The current optional email plus self-chosen four-digit PIN helped validate linked
candidate profiles, but it does not verify that a person owns an email address.
Hash-based identity also complicates reliable relationships and outreach.

## Decision

Move to managed verified authentication. Use a stable internal `user_id` as the
canonical relationship key. Keep `candidate_id` as a visible reference identifier.
Use named institution memberships and roles for administrative access.

WorkOS AuthKit is the selected managed identity provider. The server-side
integration architecture is documented in
`0004-server-side-workos-authkit.md`.

## Consequences

- Cross-device identity and staff accountability become reliable.
- Authentication email and recovery workflows move to a managed provider.
- Existing device/email-linked records will need a migration and account-linking plan.
- Hashing may remain useful for lookup or analytics, but not as the primary identity.
