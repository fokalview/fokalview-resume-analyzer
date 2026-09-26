# SagittaIQ readiness and screen changes

## Product behavior

New reviews assess evidence against the supplied job description, across occupations and career levels. There is no overall percentage. Historical reviews keep their original scores and are labeled historical; they are never converted into new levels.

The four outcomes are Strong alignment, Promising alignment, Significant gaps, and More information needed. These describe the provided evidence for a particular job, not a person's worth, employability, or probability of being hired.

## Assessment flow

1. Extract distinct requirements, exact posting excerpts, expected scope, and importance (critical, core, preferred, unclear). Preserve alternatives such as degree OR equivalent experience as one requirement. Do not assume degrees, tools, management, or numerical achievements are universal requirements.
2. Extract the candidate profile independently of the job.
3. Evaluate each requirement ID using demonstrated, partial, transferable, mentioned, not-evidenced, unclear, or unmet. Positive and explicitly unmet findings require an exact resume excerpt. Missing evidence is never automatically unmet.
4. Verify excerpt provenance and derive the level and counts in code. The writing stage cannot edit the assessment.
5. Save the assessment with version `sagittaiq-evidence-v2`; score is null. No database schema migration is required for the JSON payloads and existing nullable opportunity score column.

## Initial decision rules

- Invalid source excerpts or duplicate IDs prevent a conclusive outcome. Missing or unverifiable resume evidence becomes unclear.
- A posting must establish at least one core/critical responsibility. A credentials-only posting is insufficient.
- If more than half of core/critical requirements are mentioned only, not evidenced, or unclear, return More information needed.
- Otherwise, all core/critical requirements must be demonstrated, and requirement importance must be clear, for Strong alignment.
- An explicitly unmet critical requirement, or support for fewer than half of core/critical requirements, yields Significant gaps.
- Remaining cases yield Promising alignment. Unresolved critical checks stay visible even in this state.
- Preferred qualifications do not increase or reduce the outcome.
- Partial and transferable evidence count as supported for the promising threshold, but cannot establish strong alignment.

These are transparent initial product rules, not empirically validated cutoffs. In particular, the half-of-requirements rule must be checked against human-reviewed examples. A matching quotation establishes provenance, not whether an AI interpretation is correct. Semantic duplicates and omitted requirements remain model-quality concerns.

## Screen layout

| Screen | New layout |
| --- | --- |
| Dashboard | Latest readiness level and explanation beside the main actions; evidence counts and unresolved critical checks; review history labeled by job and date, without cross-job score comparisons. |
| Resume review | Two input panels: resume and target job. Saved opportunities show their latest assessment label. |
| Report overview | Job title, readiness summary, evidence completeness, unresolved critical count, then prioritized actions and strengths. |
| Opportunity alignment | Requirements grouped into critical, core, preferred, and unclear importance. Expandable rows show the status, explanation, exact job/resume excerpts, and next action. |
| Opportunities | Readiness label in each opportunity row; explanation and critical checks inside review details; older run scores stay historical. |
| PDF export | Same assessment, requirement excerpts and next actions; no new readiness percentage. |
| Administration | New reviews excluded from historical percentage averages and bands; candidate rows show the assessment label. |

Report order:

```text
Job title                         Download report / Open opportunity
Readiness level + explanation
Demonstrated | Partial/transferable | Critical checks unresolved
Evidence completeness

Overview | Priority actions | Opportunity alignment

Next improvements
Supporting strengths
Requirements and evidence (on alignment tab)
```

Layouts fill the available workspace width, wrap count summaries, and use expandable evidence rows rather than an oversized score ring. Small screens stack content. Status is communicated in text; evidence rows support keyboard interaction and focus indicators.

## Verification and rollout

Automated checks cover level derivation, critical checks, missing evidence, exact source verification, invalid IDs, empty postings, save/reload, authenticated ownership, PDF content, and responsive light/dark screens. Cross-occupation synthetic excerpts exercise the shared rules; they do not validate a live model's interpretation.

Before treating the levels as calibrated guidance, evaluate real provider outputs against independently reviewed examples across healthcare, education, trades, service, sales, technical roles, entry-level work, and management. Include career changes, nontraditional experience, sparse postings, and equivalent-qualification alternatives. Assess extraction completeness, false demonstrated findings, and missed mandatory constraints. No production deployment or paid model evaluation is part of this implementation check.

Future improvements: editable requirement importance with an audit trail; follow-up answers distinguished from resume evidence; a separate resume-presentation review; stable requirement IDs across reruns of the same posting. These are not represented as completed features.
