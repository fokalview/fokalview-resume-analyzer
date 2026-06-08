# ADR 0001: Deterministic Readiness Scoring

- Status: Accepted
- Date: 2026-06-06

## Context

Repeated AI analysis of the same resume and job description produced materially
different readiness scores. That makes trend reporting and institutional use unreliable.

## Decision

AI extracts qualifications and produces narrative guidance. Versioned application
logic calculates the numeric readiness score. Extracted opportunity qualifications
are stored and reused.

## Consequences

- Scores are more stable, explainable, and comparable.
- Rubric changes must create a new scoring version.
- The rubric still requires calibration against advisor judgment and real outcomes.
