# ADR 0004: Server-Side WorkOS AuthKit Integration

- Status: Accepted
- Date: 2026-06-08

## Context

SagittaIQ currently uses a shared beta access code, optional email linkage, and a
self-chosen four-digit PIN. That model enabled rapid beta testing but does not
verify email ownership or support named institutional access, tenant-scoped roles,
secure administrator elevation, or reliable account recovery.

SagittaIQ's current architecture includes:

- React/Vite client-side interface
- Cloudflare Pages Functions written in JavaScript
- Cloudflare D1 storage
- sensitive resume, opportunity, academic, and outcome data
- planned multi-tenant institutional roles

WorkOS AuthKit offers both a client-only React integration and server-side
integration guides. React was initially recommended based on the frontend
framework, but that recommendation was reconsidered after evaluating the complete
security architecture.

## Decision

Use WorkOS AuthKit through a server-side Node.js integration pattern implemented
with Cloudflare Pages Functions. Keep React/Vite as the frontend.

The browser will redirect through SagittaIQ authentication endpoints and receive a
secure HTTP-only session cookie. WorkOS API keys and refresh tokens must remain
server-side.

Expected endpoints:

- `/api/auth/login`
- `/api/auth/callback`
- `/api/auth/session`
- `/api/auth/logout`

## Alternatives Considered

### React Client-Only

Advantages:

- fastest integration
- minimal backend authentication code

Rejected because:

- weaker foundation for institutional authorization
- complicates consistent API-route protection
- increases browser token exposure concerns
- does not align with planned administrator roles and elevated access

### Next.js Or Remix

Advantages:

- strong full-stack authentication patterns

Rejected because:

- would require a broad application rewrite solely to add authentication
- introduces migration risk without enough current benefit

### Ruby Or Python Backend

Rejected because SagittaIQ currently uses JavaScript Cloudflare Functions. A second
backend stack would add operational complexity without solving a present need.

### Standalone WorkOS SSO

Rejected because standalone SSO alone does not provide the full AuthKit identity,
session, and user-management foundation required by SagittaIQ.

## Consequences

- Authentication secrets and long-lived session material remain off the frontend.
- Backend APIs can enforce verified identity and future tenant-scoped permissions.
- More implementation and testing work is required than client-only React AuthKit.
- Cloudflare runtime compatibility and cookie behavior must be verified.
- Existing beta identities require an account-linking migration.
- WorkOS authentication will not replace the need for SagittaIQ authorization,
  membership, retention, and security-audit models.

## Implementation Guardrails

- Never expose `WORKOS_API_KEY` to frontend code.
- Store WorkOS secrets as encrypted Cloudflare secrets.
- Rotate any key visible in screenshots or logs.
- Implement and test session validation before removing the existing beta gate.
- Protect backend endpoints, not only frontend routes.
- Record authentication and authorization changes in the project journal.
