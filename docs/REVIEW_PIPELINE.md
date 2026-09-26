# Current assessment update

New reviews now use the evidence-based v2 assessment described in [READINESS_V2.md](READINESS_V2.md). The v1.4 scoring discussion below is historical and is no longer used to produce new review scores.

# Review pipeline and internal layout

Four bounded model calls use the configured backend provider: job extraction, profile extraction, opportunity review, and report writing. Code calculates the score between comparison and writing. Each output is validated against its stage schema. The writer only receives narrative fields and the read-only score; unexpected output keys fail validation. Writing failures preserve the original review and are surfaced in the report. There are no autonomous tools or arbitrary web requests in these stages. The Chrome extension remains the user-triggered capture mechanism.

Model outputs are fallible. Exact source quotes are checked against both original documents before being attached to the report; this checks provenance, not whether the interpretation is correct. Never treat recommendations as verified credentials. Missing qualifications are described as missing evidence, not proof the person lacks a skill. The profile stage receives only resume text. Stored profile/score fields cannot be overwritten by the writer. Stored historical reviews remain unchanged.

One review reserves one daily quota unit and makes up to four model calls (previously up to three across two providers). This increases provider usage and latency. Calls do not retry automatically. OpenAI HTTP calls have 45-second timeouts. No paid production evaluation was performed. Profile caching is not introduced: all extraction reruns on review so edits cannot reuse stale results. Current extraction stability and model quality need a representative labeled evaluation before making strong claims about accuracy.

## Proposed readiness rubric (not activated)

- Required qualifications: 35%
- Relevant responsibilities: 25%
- Tools and technologies: 15%
- Demonstrated impact: 10%
- Preferred qualifications: 5%
- Explicit credentials: 5%
- Resume clarity: 5%

This is an editorial product proposal, not an empirically calibrated hiring measure. Exclude unspecified requirements and renormalize applicable weights; do not award the current default 50% for missing categories. Avoid double counting tools also listed as required skills. Do not reward word count or exact job-title repetition. Show unmet mandatory credentials separately. A missing job description should produce a resume-quality review, not a job-alignment percentage. Only compare scores for the same opportunity, rubric, and version. Benchmark against human-reviewed examples before introducing a new scoring version; preserve old reports and never silently rescore history.

The active deterministic v1.4 scoring calculation is unchanged in this change. Its lexical matching is an approximation of evidence, not a prediction of interviews, ATS acceptance, or job performance.

## Internal interface

Resume inputs and target-job inputs are grouped into two panels that stack on smaller screens. Dashboard cards prioritize next steps and activity; dated score values replace unlabeled bars. Report overview leads with prioritized improvements and offers source excerpts when available. Score ring is contained in its own cell. Opportunity history is collapsed initially. Detailed statuses are mapped consistently to displayed interview/offer groups without rewriting stored statuses.
