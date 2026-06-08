# ADR 0002: Shared Multi-Tenant Institutional Platform

- Status: Proposed
- Date: 2026-06-06

## Context

SagittaIQ needs to onboard schools with delegated staff hierarchies while preserving
implementation revenue and avoiding a separate codebase or deployment for every customer.

## Decision

Use one shared multi-tenant platform by default. Every institutional record and
authorization decision must be scoped through an institution membership. Reserve
dedicated deployments for premium contractual requirements.

## Consequences

- Productized onboarding and updates become practical.
- Tenant isolation and authorization become critical security requirements.
- Institution, membership, invitation, role, assignment, and audit models must be built.
